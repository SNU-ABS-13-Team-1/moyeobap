'use client';

import { useCallback, useMemo } from 'react';
import type { ChatEmojiSection } from '../../data/chat-emojis';
import {
  pickRecent,
  readRecentEmojiIds,
  rememberEmojiUse,
  type EmojiPickerScope,
} from '../../lib/recentEmojis';

/**
 * 피커에 보여줄 섹션 목록: 최근 쓴 것 한 줄 + 테마별 묶음.
 *
 * 최근 쓴 것은 테마 자리에서 빼 오지 않고 위에 "최근 사용" 줄로 복사해
 * 얹습니다. 빼 오면 테마 묶음이 흐트러지기 때문입니다.
 *
 * 최근 줄은 피커를 **열 때** 한 번 정해지고, 열려 있는 동안에는 그대로입니다.
 * 고르는 도중에 칸이 움직이면 엉뚱한 걸 누르게 되기 때문입니다. 방금 보낸
 * 것은 다음에 열 때 올라옵니다(세 채팅 모두 보내면 피커가 닫힙니다).
 *
 * 닫혀 있을 때는 테마 섹션만 돌려줍니다. 서버 렌더와 첫 페인트에서
 * localStorage를 읽지 않게 되어 hydration도 어긋나지 않습니다.
 */
export function useEmojiPickerOrder(
  scope: EmojiPickerScope,
  themeSections: readonly ChatEmojiSection[],
  isOpen: boolean,
) {
  const sections = useMemo(() => {
    if (!isOpen) return themeSections;
    const all = themeSections.flatMap((section) => section.emojis);
    const recent = pickRecent(all, readRecentEmojiIds(scope));
    if (recent.length === 0) return themeSections;
    return [{ title: '최근 사용', emojis: recent }, ...themeSections];
  }, [isOpen, scope, themeSections]);

  const remember = useCallback(
    (id: string) => {
      rememberEmojiUse(scope, id);
    },
    [scope],
  );

  return { sections, remember };
}
