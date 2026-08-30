'use client';

import { useCallback, useMemo } from 'react';
import type { ChatEmoji } from '../../data/chat-emojis';
import {
  orderByRecent,
  readRecentEmojiIds,
  rememberEmojiUse,
  type EmojiPickerScope,
} from '../../lib/recentEmojis';

/**
 * 피커 목록을 "최근 쓴 것 먼저"로 돌려줍니다.
 *
 * 순서는 피커를 **열 때** 한 번 정해지고, 열려 있는 동안에는 그대로입니다.
 * 고르는 도중에 칸이 움직이면 엉뚱한 걸 누르게 되기 때문입니다. 방금 보낸
 * 것은 다음에 열 때 앞으로 옵니다(세 채팅 모두 보내면 피커가 닫힙니다).
 *
 * 닫혀 있을 때는 기본 순서를 그대로 돌려줍니다. 서버 렌더와 첫 페인트에서
 * localStorage를 읽지 않게 되어 hydration도 어긋나지 않습니다.
 */
export function useEmojiPickerOrder(
  scope: EmojiPickerScope,
  list: readonly ChatEmoji[],
  isOpen: boolean,
) {
  const emojis = useMemo(
    () => (isOpen ? orderByRecent(list, readRecentEmojiIds(scope)) : list),
    [isOpen, list, scope],
  );

  const remember = useCallback(
    (id: string) => {
      rememberEmojiUse(scope, id);
    },
    [scope],
  );

  return { emojis, remember };
}
