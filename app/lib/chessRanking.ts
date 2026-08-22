import { getSupabase } from "./supabase";
import type { ChessRoom } from "./chessOnline";

// 오목(omokRanking.ts)과 같은 K=32 ELO입니다. 테이블만 chess_*를 씁니다.
const K_FACTOR = 32;
const DEFAULT_RATING = 1200;

export type ChessRankingEntry = {
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
  const fallback: RatingRow = { user_id: userId, user_name: userName, rating: DEFAULT_RATING, wins: 0, losses: 0, draws: 0 };
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("chess_ratings")
    .select("user_id, user_name, rating, wins, losses, draws")
    .eq("user_id", userId)
    .maybeSingle<RatingRow>();
  return data ?? fallback;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export async function recordChessMatchResult(room: ChessRoom, winner: "white" | "black" | "draw"): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !room.blackId || !room.blackName) return;

  const { error: matchError } = await supabase.from("chess_matches").insert({
    room_id: room.id,
    white_id: room.whiteId,
    white_name: room.whiteName,
    black_id: room.blackId,
    black_name: room.blackName,
    winner,
    end_reason: room.endReason,
    move_count: room.moveCount,
    started_at: room.startedAt ?? room.createdAt,
  });
  if (matchError) console.error("recordChessMatchResult(match) error:", matchError);

  const white = await getOrDefaultRating(room.whiteId, room.whiteName);
  const black = await getOrDefaultRating(room.blackId, room.blackName);

  const whiteScore = winner === "white" ? 1 : winner === "draw" ? 0.5 : 0;
  const blackScore = winner === "black" ? 1 : winner === "draw" ? 0.5 : 0;

  const nextWhite = Math.round(white.rating + K_FACTOR * (whiteScore - expectedScore(white.rating, black.rating)));
  const nextBlack = Math.round(black.rating + K_FACTOR * (blackScore - expectedScore(black.rating, white.rating)));
  const now = new Date().toISOString();

  const { error: ratingError } = await supabase.from("chess_ratings").upsert([
    {
      user_id: room.whiteId,
      user_name: room.whiteName,
      rating: nextWhite,
      wins: white.wins + (winner === "white" ? 1 : 0),
      losses: white.losses + (winner === "black" ? 1 : 0),
      draws: white.draws + (winner === "draw" ? 1 : 0),
      updated_at: now,
    },
    {
      user_id: room.blackId,
      user_name: room.blackName,
      rating: nextBlack,
      wins: black.wins + (winner === "black" ? 1 : 0),
      losses: black.losses + (winner === "white" ? 1 : 0),
      draws: black.draws + (winner === "draw" ? 1 : 0),
      updated_at: now,
    },
  ]);
  if (ratingError) console.error("recordChessMatchResult(rating) error:", ratingError);
}

export async function getChessRanking(limit = 20): Promise<ChessRankingEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chess_ratings")
    .select("user_id, user_name, rating, wins, losses, draws")
    .order("rating", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getChessRanking error:", error);
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
