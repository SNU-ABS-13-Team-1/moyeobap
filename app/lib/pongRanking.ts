import { getSupabase } from "./supabase";
import { currentWeekKey } from "./gameWeek";
import type { PongRoom } from "./pong";

const K_FACTOR = 32;
const DEFAULT_RATING = 1000;

export type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
};

type RatingRow = {
  user_id: string;
  user_name: string;
  rating: number;
  wins: number;
  losses: number;
};

async function getOrDefaultRating(userId: string, userName: string): Promise<RatingRow> {
  const supabase = getSupabase();
  const fallback: RatingRow = {
    user_id: userId,
    user_name: userName,
    rating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
  };
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("pong_ratings")
    .select("user_id, user_name, rating, wins, losses")
    .eq("week_key", currentWeekKey())
    .eq("user_id", userId)
    .maybeSingle<RatingRow>();

  return data ?? fallback;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * 대전이 끝난 직후(정상 승부, 기권, 몰수승 전부 포함) 한 번 호출됩니다.
 * 전적을 한 줄 기록하고, 표준적인 K=32 ELO 공식으로 두 사람의 Rating을
 * 함께 갱신합니다. Pong은 무승부가 없어 승/패 이분법으로만 계산합니다.
 */
export async function recordMatchResult(
  room: PongRoom,
  winner: "player1" | "player2",
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !room.player2Id || !room.player2Name) return;

  const { error: matchError } = await supabase.from("pong_matches").insert({
    room_id: room.id,
    player1_id: room.player1Id,
    player1_name: room.player1Name,
    player2_id: room.player2Id,
    player2_name: room.player2Name,
    winner,
    score1: room.score1,
    score2: room.score2,
    started_at: room.startedAt ?? room.createdAt,
  });
  if (matchError) console.error("recordMatchResult(match) error:", matchError);

  const p1 = await getOrDefaultRating(room.player1Id, room.player1Name);
  const p2 = await getOrDefaultRating(room.player2Id, room.player2Name);

  const p1Score = winner === "player1" ? 1 : 0;
  const p2Score = winner === "player2" ? 1 : 0;

  const p1Expected = expectedScore(p1.rating, p2.rating);
  const p2Expected = expectedScore(p2.rating, p1.rating);

  const nextP1Rating = Math.round(p1.rating + K_FACTOR * (p1Score - p1Expected));
  const nextP2Rating = Math.round(p2.rating + K_FACTOR * (p2Score - p2Expected));

  const { error: ratingError } = await supabase.from("pong_ratings").upsert([
    {
      week_key: currentWeekKey(),
      user_id: room.player1Id,
      user_name: room.player1Name,
      rating: nextP1Rating,
      wins: p1.wins + (winner === "player1" ? 1 : 0),
      losses: p1.losses + (winner === "player2" ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
    {
      week_key: currentWeekKey(),
      user_id: room.player2Id,
      user_name: room.player2Name,
      rating: nextP2Rating,
      wins: p2.wins + (winner === "player2" ? 1 : 0),
      losses: p2.losses + (winner === "player1" ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
  ], { onConflict: "user_id,week_key" });
  if (ratingError) console.error("recordMatchResult(rating) error:", ratingError);
}

export async function getRanking(limit = 20, weekKey = currentWeekKey()): Promise<RankingEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("pong_ratings")
    .select("user_id, user_name, rating, wins, losses")
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
  }));
}

// 결과 화면에서 "Rating +18" 같은 변동폭을 보여주기 위해, 방 입장 시점과
// 종료 후 시점의 내 Rating을 클라이언트가 비교할 수 있게 제공합니다.
export async function getMyRating(userId: string, userName: string): Promise<RankingEntry> {
  const row = await getOrDefaultRating(userId, userName);
  return { userId: row.user_id, userName: row.user_name, rating: row.rating, wins: row.wins, losses: row.losses };
}
