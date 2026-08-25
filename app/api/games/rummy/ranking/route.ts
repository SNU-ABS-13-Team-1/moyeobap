import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/rummyOnline";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  await ensurePrevWeekSnapshot("rummy", async (weekKey) =>
    (await getRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.points })),
  );
  // 20위에서 자르지 않고 이번 주에 한 사람을 전부 보여줍니다.
  const [ranking, hall] = await Promise.all([getRanking(), getHall("rummy")]);
  return NextResponse.json({ ranking, hall, week: currentWeekInfo() });
}
