import { NextResponse } from "next/server";
import { getChessRanking, getRecentChessMatches } from "@/app/lib/chessRanking";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("chess", async (weekKey) =>
    (await getChessRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.rating })),
  );
  // 20위에서 자르지 않고 이번 주에 둔 사람을 전부 보여줍니다.
  const [ranking, recent, hall] = await Promise.all([getChessRanking(), getRecentChessMatches(10), getHall("chess")]);
  return NextResponse.json({ ranking, recent, hall, week: currentWeekInfo() });
}
