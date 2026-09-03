import { getSupabase } from "./supabase";
import { currentWeekKey, prevWeekKey, weekLabel } from "./gameWeek";

// 명예의 전당: 게임별로 지난주 상위 3명을 남깁니다.
// 스케줄러 없이, 새 주에 누군가 랭킹을 볼 때 지난주 스냅샷이 없으면 그때 만들어 넣습니다.

export type HallEntry = { userId: string; userName: string; value: number };
export type HallWeek = { weekKey: string; label: string; entries: HallEntry[] };

type HallRow = { week_key: string; entries: HallEntry[] };

/** 지난주 스냅샷이 없으면 compute()로 상위 3명을 계산해 저장합니다(있으면 아무것도 안 함). */
export async function ensurePrevWeekSnapshot(game: string, compute: (weekKey: string) => Promise<HallEntry[]>): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const week = prevWeekKey(currentWeekKey());
  const { data } = await supabase.from("game_week_hall").select("week_key").eq("game", game).eq("week_key", week).maybeSingle();
  if (data) return;
  try {
    const entries = (await compute(week)).slice(0, 3);
    if (entries.length === 0) return; // 기록이 없던 주는 남기지 않음
    const { error } = await supabase.from("game_week_hall").upsert({ game, week_key: week, entries }, { onConflict: "game,week_key", ignoreDuplicates: true });
    if (error) console.error("hall snapshot error:", error);
  } catch (err) {
    console.error("hall snapshot compute error:", err);
  }
}

const cachedHalls = new Map<string, { data: HallWeek[]; cachedAt: number }>();
const HALL_TTL_MS = 60_000;

/** 최근 몇 주의 명예의 전당(최신 주부터). */
export async function getHall(game: string, limit = 8): Promise<HallWeek[]> {
  const now = Date.now();
  const cached = cachedHalls.get(game);
  if (limit === 8 && cached && now - cached.cachedAt < HALL_TTL_MS) {
    return cached.data;
  }

  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("game_week_hall")
    .select("week_key, entries")
    .eq("game", game)
    .order("week_key", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const result = (data as HallRow[]).map((row) => ({
    weekKey: row.week_key,
    label: weekLabel(row.week_key),
    entries: Array.isArray(row.entries) ? row.entries : [],
  }));
  if (limit === 8) {
    cachedHalls.set(game, { data: result, cachedAt: now });
  }
  return result;
}
