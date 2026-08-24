import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/rummyOnline";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("rummy", async (weekKey) =>
    (await getRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.points })),
  );
  const [ranking, hall] = await Promise.all([getRanking(20), getHall("rummy")]);
  return NextResponse.json({ ranking, hall, week: currentWeekInfo() });
}
