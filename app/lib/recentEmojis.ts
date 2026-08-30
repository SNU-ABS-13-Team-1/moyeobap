/**
 * 최근에 쓴 이모티콘을 피커 맨 앞으로.
 *
 * 피커 격자는 높이가 220px로 묶여 있어(입력줄이 밖으로 밀려나지 않게)
 * 스크롤 없이 보이는 건 PC 7~10개, 폰 5~6개뿐입니다. 목록이 30종을 넘으면
 * 자주 쓰는 것도 매번 스크롤해서 찾아야 합니다.
 *
 * 그래서 방금 쓴 것 네 개(=PC 기준 한 줄)를 맨 앞에 둡니다. 목록이 앞으로
 * 더 늘어도 첫 줄은 늘 자기가 쓰던 것이라 체감 개수가 늘지 않습니다.
 *
 * 이 값은 브라우저 밖으로 나가지 않습니다. 다른 기기에서 보면 없고, 방문
 * 기록을 지우면 같이 사라집니다. 그래도 되는 값만 여기 둡니다.
 */

/** 팟 채팅과 게임방은 목록도 맥락도 달라 따로 기억합니다. */
export type EmojiPickerScope = 'pot' | 'game';

const PREFIX = 'moyeobap:emoji:recent:';

/** PC 피커가 4열이라 딱 한 줄. 늘리면 첫 화면을 최근 것만으로 덮게 됩니다. */
export const RECENT_EMOJI_LIMIT = 4;

/** 브라우저가 저장을 막아 둔 경우(시크릿 창 등)에도 채팅은 그대로 돌아가야 합니다. */
export function readRecentEmojiIds(scope: EmojiPickerScope): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + scope);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, RECENT_EMOJI_LIMIT);
  } catch {
    return [];
  }
}

/** 방금 쓴 것을 맨 앞에 놓고 저장합니다. 저장에 실패해도 새 목록은 돌려줍니다. */
export function rememberEmojiUse(scope: EmojiPickerScope, id: string): string[] {
  const next = [id, ...readRecentEmojiIds(scope).filter((seen) => seen !== id)].slice(
    0,
    RECENT_EMOJI_LIMIT,
  );
  try {
    localStorage.setItem(PREFIX + scope, JSON.stringify(next));
  } catch {
    // 저장을 못 해도 이번 화면에서는 앞으로 당겨 보여줍니다.
  }
  return next;
}

/**
 * 최근 쓴 것을 앞으로 당깁니다. 나머지는 원래 순서 그대로입니다.
 *
 * 피커에서 빠진 이모티콘 id가 기록에 남아 있을 수 있어(게임방에서 쓴 걸
 * 팟에서 읽는 경우, 목록을 정리한 경우) 실제 목록에 있는 것만 씁니다.
 */
export function orderByRecent<T extends { id: string }>(
  list: readonly T[],
  recentIds: readonly string[],
): readonly T[] {
  if (recentIds.length === 0) return list;
  const wanted = new Set(recentIds);
  const recent = recentIds
    .map((id) => list.find((item) => item.id === id))
    .filter((item): item is T => item !== undefined);
  if (recent.length === 0) return list;
  return [...recent, ...list.filter((item) => !wanted.has(item.id))];
}
