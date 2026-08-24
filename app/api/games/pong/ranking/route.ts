import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/pongRanking";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("pong", async (weekKey) =>
    (await getRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.rating })),
  );
  const [ranking, hall] = await Promise.all([getRanking(20), getHall("pong")]);
  return NextResponse.json({ ranking, hall, week: currentWeekInfo() });
}
