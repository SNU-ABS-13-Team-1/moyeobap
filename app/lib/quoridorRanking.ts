import { getSupabase } from "./supabase";
import { currentWeekKey } from "./gameWeek";
import { DEFAULT_RATING, computeEloDeltas } from "./quoridorElo";
import type { QuoridorRoom } from "./quoridorRoom";

// 쿼리도 주간 Elo 랭킹(알까기와 같은 구조). 계산은 quoridorElo.ts의 순수 함수가 합니다.

export type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
};

type RatingRow = { user_id: string; user_name: string; rating: number; wins: number; losses: number };

/**
 * 승자가 정해진 판이 끝난 직후 한 번 호출됩니다. 판에 자리가 있던 모든 사람(기권·시간 초과로
 * 나간 사람 포함)을 계산에 넣습니다. 전적을 먼저 남기고(같은 판은 UNIQUE로 한 번만),
 * 그게 성공했을 때만 점수를 반영해 이중 반영을 막습니다.
 */
export async function recordMatchResult(room: QuoridorRoom): Promise<void> {
  const supabase = getSupabase();
  const winnerId = room.winnerId;
  if (!supabase || !winnerId || !room.startedAt) return;

  const seated = room.players.filter((p) => p.seat !== null);
  if (!seated.some((p) => p.id === winnerId) || seated.length < 2) return;
  const weekKey = currentWeekKey();

  const { data: rows, error: readError } = await supabase
    .from("quoridor_ratings")
    .select("user_id, user_name, rating, wins, losses")
    .eq("week_key", weekKey)
    .in("user_id", seated.map((p) => p.id));
  if (readError) {
    console.error("quoridor recordMatchResult(read) error:", readError);
    return;
  }
  const byId = new Map(((rows ?? []) as RatingRow[]).map((r) => [r.user_id, r]));
  const before = Object.fromEntries(seated.map((p) => [p.id, byId.get(p.id)?.rating ?? DEFAULT_RATING]));
  const deltas = computeEloDeltas(before, winnerId, room.mode);

  const { error: matchError } = await supabase.from("quoridor_matches").insert({
    room_id: room.id,
    mode: room.mode,
    players: seated.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      left: p.left,
      ratingBefore: before[p.id],
      ratingAfter: before[p.id] + (deltas[p.id] ?? 0),
    })),
    winner_id: winnerId,
    end_reason: room.endReason,
    moves: room.moves,
    started_at: room.startedAt,
  });
  if (matchError) {
    // 23505 = 이미 기록된 판(UNIQUE). 점수는 그때 반영됐으므로 여기서 멈춥니다.
    if (matchError.code !== "23505") console.error("quoridor recordMatchResult(match) error:", matchError);
    return;
  }

  const now = new Date().toISOString();
  const { error: ratingError } = await supabase.from("quoridor_ratings").upsert(
    seated.map((p) => {
      const prev = byId.get(p.id);
      const won = p.id === winnerId;
      return {
        week_key: weekKey,
        user_id: p.id,
        user_name: p.name,
        rating: before[p.id] + (deltas[p.id] ?? 0),
        wins: (prev?.wins ?? 0) + (won ? 1 : 0),
        losses: (prev?.losses ?? 0) + (won ? 0 : 1),
        updated_at: now,
      };
    }),
    { onConflict: "user_id,week_key" },
  );
  if (ratingError) console.error("quoridor recordMatchResult(rating) error:", ratingError);
}

/** 이번 주 랭킹을 rating → wins → 이름 순으로 돌려줍니다. limit이 없으면 전부. */
export async function getRanking(limit?: number, weekKey = currentWeekKey()): Promise<RankingEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("quoridor_ratings")
    .select("user_id, user_name, rating, wins, losses")
    .eq("week_key", weekKey)
    .order("rating", { ascending: false })
    .order("wins", { ascending: false })
    .order("user_name", { ascending: true });
  if (limit !== undefined) query = query.limit(limit);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("quoridor getRanking error:", error);
    return [];
  }
  return (data as RatingRow[]).map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    rating: r.rating,
    wins: r.wins,
    losses: r.losses,
  }));
}
