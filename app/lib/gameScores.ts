import { getSupabase } from "./supabase";
import { currentWeekKey, weekRangeUtc } from "./gameWeek";
import { ensurePrevWeekSnapshot, type HallEntry } from "./gameHall";

export type ScoreEntry = {
  userId: string;
  userName: string;
  bestScore: number;
};

export async function submitGameScore(
  game: string,
  userId: string,
  userName: string,
  score: number,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from("game_scores").insert({
    game,
    user_id: userId,
    user_name: userName,
    score,
  });

  if (error) {
    console.error("submitGameScore error:", error);
    return false;
  }
  return true;
}

/** 특정 주(week key)의 사용자별 최고 점수 순위. */
async function leaderboardForWeek(game: string, weekKey: string, limit: number): Promise<ScoreEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { startIso, endIso } = weekRangeUtc(weekKey);

  const { data, error } = await supabase
    .from("game_scores")
    .select("user_id, user_name, score")
    .eq("game", game)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("score", { ascending: false });

  if (error || !data) {
    if (error) console.error("getLeaderboard error:", error);
    return [];
  }

  const bestByUser = new Map<string, ScoreEntry>();
  for (const row of data) {
    const existing = bestByUser.get(row.user_id);
    if (!existing || row.score > existing.bestScore) {
      bestByUser.set(row.user_id, {
        userId: row.user_id,
        userName: row.user_name,
        bestScore: row.score,
      });
    }
  }

  return [...bestByUser.values()]
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, limit);
}

/** 이번 주 랭킹. 겸사겸사 지난주 상위 3명을 명예의 전당에 남깁니다(이미 있으면 통과). */
export async function getLeaderboard(game: string, limit = 10): Promise<ScoreEntry[]> {
  await ensurePrevWeekSnapshot(game, async (weekKey) => {
    const top: HallEntry[] = (await leaderboardForWeek(game, weekKey, 3)).map((e) => ({ userId: e.userId, userName: e.userName, value: e.bestScore }));
    return top;
  });
  return leaderboardForWeek(game, currentWeekKey(), limit);
}
