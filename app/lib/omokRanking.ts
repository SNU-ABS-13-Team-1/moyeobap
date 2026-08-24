import { getSupabase } from "./supabase";
import { currentWeekKey } from "./gameWeek";
import type { OmokRoom } from "./omok";

const K_FACTOR = 32;
const DEFAULT_RATING = 1200;

export type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

type RatingRow = {
  user_id: string;
  user_name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

async function getOrDefaultRating(userId: string, userName: string): Promise<RatingRow> {
  const supabase = getSupabase();
  const fallback: RatingRow = {
    user_id: userId,
    user_name: userName,
    rating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
  };
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("omok_ratings")
    .select("user_id, user_name, rating, wins, losses, draws")
    .eq("week_key", currentWeekKey())
    .eq("user_id", userId)
    .maybeSingle<RatingRow>();

  return data ?? fallback;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * 대국이 끝난 직후(정상 승부, 기권, 몰수승 전부 포함) 한 번 호출됩니다.
 * 전적을 한 줄 기록하고, 표준적인 K=32 ELO 공식으로 두 사람의 Rating을
 * 함께 갱신합니다.
 */
export async function recordMatchResult(
  room: OmokRoom,
  winner: "black" | "white" | "draw",
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !room.blackId || !room.blackName || !room.whiteId || !room.whiteName) return;

  const { error: matchError } = await supabase.from("omok_matches").insert({
    room_id: room.id,
    black_id: room.blackId,
    black_name: room.blackName,
    white_id: room.whiteId,
    white_name: room.whiteName,
    winner,
    started_at: room.startedAt ?? room.createdAt,
  });
  if (matchError) console.error("recordMatchResult(match) error:", matchError);

  const black = await getOrDefaultRating(room.blackId, room.blackName);
  const white = await getOrDefaultRating(room.whiteId, room.whiteName);

  const blackScore = winner === "black" ? 1 : winner === "draw" ? 0.5 : 0;
  const whiteScore = winner === "white" ? 1 : winner === "draw" ? 0.5 : 0;

  const blackExpected = expectedScore(black.rating, white.rating);
  const whiteExpected = expectedScore(white.rating, black.rating);

  const nextBlackRating = Math.round(black.rating + K_FACTOR * (blackScore - blackExpected));
  const nextWhiteRating = Math.round(white.rating + K_FACTOR * (whiteScore - whiteExpected));

  const { error: ratingError } = await supabase.from("omok_ratings").upsert([
    {
      week_key: currentWeekKey(),
      user_id: room.blackId,
      user_name: room.blackName,
      rating: nextBlackRating,
      wins: black.wins + (winner === "black" ? 1 : 0),
      losses: black.losses + (winner === "white" ? 1 : 0),
      draws: black.draws + (winner === "draw" ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
    {
      week_key: currentWeekKey(),
      user_id: room.whiteId,
      user_name: room.whiteName,
      rating: nextWhiteRating,
      wins: white.wins + (winner === "white" ? 1 : 0),
      losses: white.losses + (winner === "black" ? 1 : 0),
      draws: white.draws + (winner === "draw" ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
  ], { onConflict: "user_id,week_key" });
  if (ratingError) console.error("recordMatchResult(rating) error:", ratingError);
}

export async function getRanking(limit = 20, weekKey = currentWeekKey()): Promise<RankingEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("omok_ratings")
    .select("user_id, user_name, rating, wins, losses, draws")
    .eq("week_key", weekKey)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getRanking error:", error);
    return [];
  }

  return (data as RatingRow[]).map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
  }));
}
