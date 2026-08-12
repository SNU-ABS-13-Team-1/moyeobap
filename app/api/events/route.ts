import { NextResponse } from "next/server";
import { listEvents } from "@/app/lib/backend";

/**
 * 행동/Event 기록을 돌려줍니다.
 * 인기 매장 순위, 모집 성공률, 시간대별 현황 같은 집계는 이 목록을 받아
 * 화면 쪽에서 계산합니다. 어떤 차트를 그릴지 아직 정하지 않아서, 여기서
 * 미리 특정 집계 모양으로 굳히지 않았습니다.
 *
 * userId는 이메일이라 응답에서 뺍니다 — 위 집계는 전부 "누가"가 필요 없고,
 * 공개 엔드포인트에서 행동 기록이 개인 단위로 추적되면 안 됩니다(AGENTS.md 6장).
 */
export async function GET() {
  const events = await listEvents();
  const anonymized = events.map(({ userId: _userId, ...rest }) => rest);
  return NextResponse.json({ events: anonymized });
}
