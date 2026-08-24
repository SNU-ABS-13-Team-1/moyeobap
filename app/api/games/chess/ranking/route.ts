import { NextResponse } from "next/server";
import { getChessRanking, getRecentChessMatches } from "@/app/lib/chessRanking";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("chess", async (weekKey) =>
    (await getChessRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.rating })),
  );
  const [ranking, recent, hall] = await Promise.all([getChessRanking(20), getRecentChessMatches(10), getHall("chess")]);
  return NextResponse.json({ ranking, recent, hall, week: currentWeekInfo() });
}
