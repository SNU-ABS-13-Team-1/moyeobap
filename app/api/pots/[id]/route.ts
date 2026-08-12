import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import {
  deriveStatus,
  getAnyRestaurant,
  getPot,
  logEvent,
  savePot,
  toPotView,
} from "@/app/lib/backend";

const MIN_DEADLINE_MINUTES = 5;
const MAX_DEADLINE_MINUTES = 24 * 60;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  const { id } = await context.params;

  if (process.env.NODE_ENV === "development" && id === "preview") {
    const deadline = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    return NextResponse.json({
      pot: {
        id: "preview",
        restaurantId: "preview-restaurant",
        deadline,
        participantCount: 4,
        participants: null,
        isParticipating: false,
        isManaging: false,
        status: "active",
        maxParticipants: 8,
        orderCompletedAt: null,
        latestMessage: null,
        unreadMessageCount: 0,
      },
      restaurant: {
        id: "preview-restaurant",
        name: "모여밥 키친 배곧점",
        emoji: "🍱",
        category: "lunch",
        subCategory: "한식",
        minOrder: 18000,
        deliveryTime: "30~40분",
        menus: [
          { name: "직화 제육 덮밥", price: "10,900원" },
          { name: "소불고기 덮밥", price: "12,900원" },
          { name: "닭갈비 덮밥", price: "11,900원" },
        ],
        address: "경기 시흥시 배곧동",
      },
    });
  }

  const pot = await getPot(id);

  if (!pot) {
    return NextResponse.json({ error: "존재하지 않는 팟이에요." }, { status: 404 });
  }

  const status = deriveStatus(pot);
  const currentPot = status === pot.status ? pot : { ...pot, status };
  if (currentPot !== pot) await savePot(currentPot);

  if (currentPot.status === "failed") {
    return NextResponse.json({ error: "종료된 팟이에요." }, { status: 410 });
  }

  const restaurant = await getAnyRestaurant(currentPot.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ error: "매장 정보를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ pot: toPotView(currentPot, user), restaurant });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const pot = await getPot(id);
  if (!pot) {
    return NextResponse.json({ error: "존재하지 않는 팟이에요." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const currentStatus = deriveStatus(pot);
  if (currentStatus !== pot.status) {
    pot.status = currentStatus;
    const statusSaved = await savePot(pot);
    if (!statusSaved) {
      return NextResponse.json(
        { error: "팟 상태를 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
        { status: 503 },
      );
    }
    await logEvent(currentStatus === "closed" ? "pot_closed" : "pot_failed", pot);
  }

  if (pot.managerId !== user.id) {
    return NextResponse.json({ error: "현재 모집 관리자만 변경할 수 있어요." }, { status: 403 });
  }

  if (body?.action === "complete_order") {
    if (pot.status !== "closed") {
      return NextResponse.json({ error: "모집 마감 후 주문 완료를 확인할 수 있어요." }, { status: 409 });
    }
    if (pot.orderCompletedAt) {
      return NextResponse.json({ pot: toPotView(pot, user) });
    }

    pot.orderCompletedAt = new Date().toISOString();
    pot.orderCompletedBy = user.id;
    const saved = await savePot(pot);
    if (!saved) {
      return NextResponse.json(
        { error: "주문 완료 기능의 데이터베이스 마이그레이션을 먼저 적용해주세요." },
        { status: 503 },
      );
    }
    await logEvent("order_completed", pot, user.id);
    return NextResponse.json({ pot: toPotView(pot, user) });
  }

  if (pot.status !== "active") {
    return NextResponse.json({ error: "이미 마감된 팟은 변경할 수 없어요." }, { status: 409 });
  }

  if (body?.action === "update_deadline") {
    const deadline = typeof body.deadline === "string" ? new Date(body.deadline) : null;
    const now = Date.now();
    const deadlineTime = deadline?.getTime() ?? Number.NaN;
    const minDeadline = now + MIN_DEADLINE_MINUTES * 60_000;
    const maxDeadline = now + MAX_DEADLINE_MINUTES * 60_000;

    if (!Number.isFinite(deadlineTime) || deadlineTime < minDeadline || deadlineTime > maxDeadline) {
      return NextResponse.json(
        { error: "마감 시간은 현재부터 5분~24시간 사이로 설정해주세요." },
        { status: 400 },
      );
    }

    pot.deadline = new Date(deadlineTime).toISOString();
    const saved = await savePot(pot);
    if (!saved) {
      return NextResponse.json(
        { error: "마감 시간을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
        { status: 503 },
      );
    }
    await logEvent("pot_deadline_updated", pot, user.id);
    return NextResponse.json({ pot: toPotView(pot, user) });
  }

  if (body?.action === "close_now") {
    pot.deadline = new Date().toISOString();
    pot.status = pot.participants.length >= 2 ? "closed" : "failed";
    const saved = await savePot(pot);
    if (!saved) {
      return NextResponse.json(
        { error: "모집 마감을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
        { status: 503 },
      );
    }
    await logEvent(pot.status === "closed" ? "pot_closed" : "pot_failed", pot, user.id);
    return NextResponse.json({ pot: toPotView(pot, user) });
  }

  return NextResponse.json({ error: "지원하지 않는 마감 관리 요청이에요." }, { status: 400 });
}
