import { getSupabase } from "./supabase";

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

export async function getLeaderboard(game: string, limit = 10): Promise<ScoreEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("game_scores")
    .select("user_id, user_name, score")
    .eq("game", game)
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
