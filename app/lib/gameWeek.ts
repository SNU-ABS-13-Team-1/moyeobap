// 미니게임 랭킹의 "주" 계산 (한국 시간, 월요일 시작).
// 주의 키(week key)는 그 주 월요일의 KST 날짜 문자열("2026-08-24")로, DB에도 이 값이 저장됩니다.
// 매주 월요일 0시(KST)에 랭킹이 새로 시작하고, 지난주 상위 3명은 명예의 전당에 남습니다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임이 없어 고정 +9시간

function kstParts(ms: number): { y: number; m: number; d: number; day: number } {
  const d = new Date(ms + KST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), day: d.getUTCDay() };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 해당 시각이 속한 주의 키(그 주 월요일의 KST 날짜, "YYYY-MM-DD"). */
export function weekKeyOf(ms: number): string {
  const { y, m, d, day } = kstParts(ms);
  const sinceMonday = (day + 6) % 7; // 월=0 … 일=6
  const monday = new Date(Date.UTC(y, m, d - sinceMonday));
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

export function currentWeekKey(now = Date.now()): string {
  return weekKeyOf(now);
}

export function prevWeekKey(weekKey: string): string {
  const [y, m, d] = weekKey.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d - 7));
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

/** 주의 시작·끝을 UTC ISO로(DB created_at 필터용). [start, end) */
export function weekRangeUtc(weekKey: string): { startIso: string; endIso: string } {
  const [y, m, d] = weekKey.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d) - KST_OFFSET_MS; // 월요일 0시 KST
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(startMs + 7 * 24 * 60 * 60 * 1000).toISOString() };
}

/** 화면 표기용: "8/24 ~ 8/30 주". */
export function weekLabel(weekKey: string): string {
  const [y, m, d] = weekKey.split("-").map(Number);
  const sunday = new Date(Date.UTC(y, m - 1, d + 6));
  return `${m}/${d} ~ ${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()} 주`;
}

export type WeekInfo = { key: string; label: string };

export function currentWeekInfo(now = Date.now()): WeekInfo {
  const key = currentWeekKey(now);
  return { key, label: weekLabel(key) };
}
