import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/pongRanking";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("pong", async (weekKey) =>
    (await getRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.rating })),
  );
  // 20위에서 자르지 않고 이번 주에 친 사람을 전부 보여줍니다.
  const [ranking, hall] = await Promise.all([getRanking(), getHall("pong")]);
  return NextResponse.json({ ranking, hall, week: currentWeekInfo() });
}
