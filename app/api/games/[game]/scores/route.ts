import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getLeaderboard, submitGameScore } from "@/app/lib/gameScores";
import { getHall } from "@/app/lib/gameHall";
import { currentWeekInfo } from "@/app/lib/gameWeek";
import { isPracticeGame } from "@/app/lib/practiceGames";

const MAX_SCORE = 1_000_000;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ game: string }> },
) {
  const { game } = await context.params;
  // 연습 모드는 랭킹이 없습니다. 화면에서 안 보여주는 것만으로는 주소를 직접
  // 치면 그만이라, 여기서도 닫습니다.
  if (isPracticeGame(game)) {
    return NextResponse.json({ error: "연습 모드에는 랭킹이 없어요." }, { status: 404 });
  }

  const user = await getSession();
  const leaderboard = await getLeaderboard(game);
  const hall = await getHall(game);

  return NextResponse.json({
    leaderboard,
    hall,
    week: currentWeekInfo(),
    myRank: user ? (leaderboard.find((entry) => entry.userId === user.id)?.rank ?? null) : null,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ game: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { game } = await context.params;
  if (isPracticeGame(game)) {
    return NextResponse.json({ error: "연습 모드 점수는 기록하지 않아요." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const score = Number(body?.score);

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: "올바르지 않은 점수예요." }, { status: 400 });
  }

  const saved = await submitGameScore(game, user.id, user.name, score);
  if (!saved) {
    return NextResponse.json({ error: "점수를 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." }, { status: 503 });
  }

  const leaderboard = await getLeaderboard(game);
  return NextResponse.json({
    leaderboard,
    week: currentWeekInfo(),
    myRank: leaderboard.find((entry) => entry.userId === user.id)?.rank ?? null,
  });
}
