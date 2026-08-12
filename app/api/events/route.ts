import { NextResponse } from "next/server";
import { listEvents } from "@/app/lib/backend";

/**
 * 행동/Event 기록을 그대로 돌려줍니다.
 * 인기 매장 순위, 모집 성공률, 시간대별 현황 같은 집계는 이 목록을 받아
 * 화면 쪽에서 계산합니다. 어떤 차트를 그릴지 아직 정하지 않아서, 여기서
 * 미리 특정 집계 모양으로 굳히지 않았습니다.
 */
export async function GET() {
  const events = await listEvents();
  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      potId: event.potId,
      restaurantId: event.restaurantId,
      participantCount: event.participantCount,
      createdAt: event.createdAt,
    })),
  });
}
