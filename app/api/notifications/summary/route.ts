import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import {
  getAnyRestaurant,
  getPotChatSummaries,
  listPots,
} from "@/app/lib/backend";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

/** 내려보낼 모집 중 팟의 상한. 현황판이 이보다 붐빌 일은 없습니다. */
const MAX_OPEN_POTS = 30;

/**
 * 헤더 배지와 토스트에 필요한 최소한만 내려보냅니다(15초마다 호출됩니다).
 *
 * "무엇이 새 팟인가"는 여기서 정하지 않습니다. 기준 시각이 브라우저
 * localStorage에 있어서, 그걸 질의에 넣으면 응답이 바뀔 때마다 요청 키가
 * 흔들려 폴링이 스스로를 다시 부르게 됩니다. 서버는 목록만 주고, 판정은
 * 클라이언트가 selectNewPots로 합니다.
 */
export async function GET() {
  const now = new Date();
  const empty = {
    openPots: [],
    myPotIds: [],
    unread: [],
    unreadTotal: 0,
    serverTime: now.toISOString(),
  };

  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const pots = await listPots();
    const openPots = pots
      .filter((pot) => pot.status === "active" && new Date(pot.deadline).getTime() > now.getTime())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_OPEN_POTS);

    const myPots = pots.filter((pot) =>
      pot.participants.some((participant) => participant.id === user.id),
    );

    const sessionSupabase = await createSupabaseServerClient();
    const chatSummaries = await getPotChatSummaries(myPots, user, sessionSupabase).catch(
      () => new Map(),
    );

    const named = new Map<string, string>();
    const needNames = new Map<string, string>();
    for (const pot of openPots) needNames.set(pot.id, pot.restaurantId);
    for (const pot of myPots) {
      if ((chatSummaries.get(pot.id)?.unreadMessageCount ?? 0) > 0) {
        needNames.set(pot.id, pot.restaurantId);
      }
    }
    await Promise.all(
      [...needNames].map(async ([potId, restaurantId]) => {
        const restaurant = await getAnyRestaurant(restaurantId).catch(() => undefined);
        named.set(potId, restaurant?.name ?? "이름 없는 팟");
      }),
    );

    const unread = myPots
      .map((pot) => ({
        potId: pot.id,
        name: named.get(pot.id) ?? "",
        count: chatSummaries.get(pot.id)?.unreadMessageCount ?? 0,
      }))
      .filter((entry) => entry.count > 0);

    return NextResponse.json({
      openPots: openPots.map((pot) => ({
        id: pot.id,
        name: named.get(pot.id) ?? "새 팟",
        createdAt: pot.createdAt,
        creatorId: pot.creatorId,
        status: pot.status,
        deadline: pot.deadline,
      })),
      myPotIds: myPots.map((pot) => pot.id),
      unread,
      unreadTotal: unread.reduce((sum, entry) => sum + entry.count, 0),
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/notifications/summary error:", error);
    // 알림은 부가 기능이라, 실패해도 화면이 깨지지 않도록 빈 요약을 돌려줍니다.
    return NextResponse.json(empty);
  }
}
