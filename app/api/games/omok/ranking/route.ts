import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/omokRanking";
import { ensurePrevWeekSnapshot, getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";

export async function GET() {
  // 새 주에 처음 열람할 때 지난주 상위 3명을 명예의 전당에 남깁니다.
  await ensurePrevWeekSnapshot("omok", async (weekKey) =>
    (await getRanking(3, weekKey)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.rating })),
  );
  const [ranking, hall] = await Promise.all([getRanking(20), getHall("omok")]);
  return NextResponse.json({ ranking, hall, week: currentWeekInfo() });
}
