import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import {
  getAnyRestaurant,
  getPotChatSummaries,
  listPots,
  logEvent,
  savePot,
  toPotView,
  type ServerPot,
} from "@/app/lib/backend";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET() {
  try {
    const user = await getSession();
    const pots = await listPots();
    const sessionSupabase = user ? await createSupabaseServerClient() : undefined;
    const chatSummaries = await getPotChatSummaries(pots, user, sessionSupabase).catch(() => new Map());
    const visible = pots
      .filter((pot) => pot.status !== "failed" && pot.participants.length > 0)
      .map((pot) => toPotView(pot, user, chatSummaries.get(pot.id)));
    return NextResponse.json({ pots: visible });
  } catch (error) {
    console.error("GET /api/pots error:", error);
    return NextResponse.json({ pots: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const restaurantId = typeof body?.restaurantId === "string" ? body.restaurantId : "";
    const minutes = Number(body?.minutes);
    const maxParticipantsRaw = body?.maxParticipants;
    const maxParticipants =
      maxParticipantsRaw === null || maxParticipantsRaw === undefined || maxParticipantsRaw === ""
        ? null
        : Number(maxParticipantsRaw);

    const restaurant = await getAnyRestaurant(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "존재하지 않는 매장이에요." }, { status: 404 });
    }
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
      return NextResponse.json({ error: "마감 시간은 5분~24시간 사이로 설정해주세요." }, { status: 400 });
    }
    if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 50)) {
      return NextResponse.json({ error: "정원은 2~50명 사이로 설정해주세요." }, { status: 400 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + minutes * 60_000);

    const existingPot = (await listPots()).find((candidate) => (
      candidate.status === "active"
      && candidate.restaurantId === restaurantId
      && new Date(candidate.deadline).getTime() === deadline.getTime()
    ));
    if (existingPot) {
      return NextResponse.json({ pot: toPotView(existingPot, user), reused: true });
    }

    const pot: ServerPot = {
      id: randomUUID(),
      restaurantId,
      deadline: deadline.toISOString(),
      participants: [{ ...user, joinedAt: now.getTime() }],
      status: "active",
      maxParticipants,
      createdAt: now.toISOString(),
      creatorId: user.id,
      managerId: user.id,
      orderCompletedAt: null,
      orderCompletedBy: null,
    };

    const saved = await savePot(pot);
    if (!saved) {
      return NextResponse.json(
        { error: "팟을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
        { status: 503 },
      );
    }
    await logEvent("pot_created", pot, user.id).catch(() => null);
    return NextResponse.json({ pot: toPotView(pot, user), reused: false }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pots exception:", error);
    return NextResponse.json(
      { error: "팟 생성 중 오류가 발생했어요. 잠시 뒤 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
