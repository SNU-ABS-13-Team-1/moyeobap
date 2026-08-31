'use client';

import { Fragment } from 'react';
import type { ChatEmoji, ChatEmojiSection } from '../../data/chat-emojis';

interface EmojiPickerGridProps {
  id: string;
  sections: readonly ChatEmojiSection[];
  disabled: boolean;
  onPick: (emoji: ChatEmoji) => void;
}

/**
 * 팟 채팅·게임방·퐁이 함께 쓰는 이모티콘 격자.
 *
 * 섹션 제목("최근 사용", "모여밥", "김프랫·김프로그")은 격자 한 줄을 통째로
 * 차지합니다. 같은 이모티콘이 "최근 사용"과 테마 양쪽에 나올 수 있어
 * key에 섹션 제목을 함께 넣습니다.
 */
export function EmojiPickerGrid({ id, sections, disabled, onPick }: EmojiPickerGridProps) {
  return (
    <div aria-label="모여밥 이모티콘 선택" className="chat-panel__emoji-picker" id={id}>
      {sections.map((section) => (
        <Fragment key={section.title}>
          <div className="chat-panel__emoji-picker-title">{section.title}</div>
          {section.emojis.map((emoji) => (
            <button
              aria-label={`${emoji.label} 보내기`}
              className="chat-panel__emoji-option"
              disabled={disabled}
              key={`${section.title}:${emoji.id}`}
              onClick={() => onPick(emoji)}
              title={`${emoji.label} 보내기`}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={emoji.label} src={emoji.src} />
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
