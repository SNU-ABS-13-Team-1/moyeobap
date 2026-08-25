'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { GAME_CHAT_EMOJIS, isChatEmojiPath, type ChatEmoji } from '../../data/chat-emojis';
import { isChatAtBottom } from '../../lib/chatScroll';
import { useAuth } from './AuthProvider';

// 실시간 대전 방 공용 채팅. 오목·체스가 API 경로·Realtime 테이블·역할 이름만 다르게
// 넘겨서 같이 씁니다(OmokChat / ChessChat은 이 컴포넌트의 얇은 껍데기).

export type GameChatConfig<Role extends string> = {
  /** 예: /api/games/omok/rooms/{id}/chat 의 앞부분 */
  apiBase: string;
  /** Realtime INSERT를 구독할 테이블 */
  table: string;
  /** Realtime 채널 이름 접두사 */
  channelPrefix: string;
  /** 메시지에 붙는 역할 배지 라벨 */
  roleLabel: Record<Role, string>;
  /**
   * 모여밥 이모티콘 버튼을 띄울지. 채팅 테이블에 kind 컬럼이 있고 API가
   * emojiId를 받는 게임에서만 켭니다(오목·바둑·체스·퐁·루미큐브·갈틱폰).
   */
  emojis?: boolean;
};

export type GameChatMessage<Role extends string> = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role | null;
  text: string;
  /** 이모티콘 메시지는 'image'. 이 기능 이전 메시지·미지원 게임은 undefined입니다. */
  kind?: 'text' | 'image';
  imageUrl?: string;
  createdAt: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function GameChat<Role extends string>({
  roomId,
  myRole,
  config,
}: {
  roomId: string;
  /** 낙관적으로 먼저 그리는 내 메시지에 붙일 역할(서버 저장값과 같음). */
  myRole: Role;
  config: GameChatConfig<Role>;
}) {
  const { currentUser } = useAuth();
  const url = `${config.apiBase}/${roomId}/chat`;
  const { data, error, mutate } = useSWR<{ messages: GameChatMessage<Role>[] }>(url, fetcher, {
    refreshInterval: 3000,
  });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /** 하단을 보고 있는지. 이 값이 참일 때만 새 메시지를 따라 내려갑니다. */
  const followBottomRef = useRef(true);
  const messages = data?.messages ?? [];

  function handleListScroll() {
    if (listRef.current) followBottomRef.current = isChatAtBottom(listRef.current);
  }

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const channel = supabase
      .channel(`${config.channelPrefix}-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: config.table, filter: `room_id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate, config.channelPrefix, config.table]);

  // 새 메시지를 따라 내려가되, 위로 올려 지난 대화를 읽는 중이면 그대로 둡니다.
  // 부드러운 스크롤 대신 즉시 이동입니다 — 애니메이션이 도는 300ms 사이에 다음
  // 메시지가 오면 중간 위치를 "하단 아님"으로 읽어 그때부터 따라가지 못합니다.
  useEffect(() => {
    if (!followBottomRef.current || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || !currentUser) return;

    setSendError(null);
    setText('');
    // 내가 보낸 것은 위로 올려둔 상태였더라도 보여줍니다.
    followBottomRef.current = true;

    const optimisticMsg: GameChatMessage<Role> = {
      id: `temp-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: myRole,
      text: trimmed,
      kind: 'text',
      createdAt: new Date().toISOString(),
    };
    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      await mutate();
    } catch (err) {
      setSendError(getErrorMessage(err, '메시지를 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  async function handleSendEmoji(emoji: ChatEmoji) {
    if (sending || !currentUser) return;

    setSendError(null);
    setIsEmojiPickerOpen(false);
    followBottomRef.current = true;

    const optimisticMsg: GameChatMessage<Role> = {
      id: `temp-emoji-${crypto.randomUUID()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: myRole,
      text: emoji.src,
      kind: 'image',
      imageUrl: emoji.src,
      createdAt: new Date().toISOString(),
    };
    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emojiId: emoji.id }),
      });
      await mutate();
    } catch (err) {
      setSendError(getErrorMessage(err, '이모티콘을 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="omok-chat">
      <div className="omok-chat__list" onScroll={handleListScroll} ref={listRef}>
        {error && <p className="omok-chat__error">대화를 불러오지 못했어요.</p>}
        {!error && messages.length === 0 && <p className="omok-chat__empty">아직 대화가 없어요.</p>}
        {messages.map((m) => (
          <div
            className={`omok-chat__message ${m.authorId === currentUser?.id ? 'omok-chat__message--mine' : ''}`}
            key={m.id}
          >
            <span className="omok-chat__meta">
              [{formatTime(m.createdAt)}] {m.authorName}
              {m.authorRole && (
                <span className={`omok-chat__role omok-chat__role--${m.authorRole}`}>{config.roleLabel[m.authorRole]}</span>
              )}
            </span>
            {m.kind === 'image' && m.imageUrl && isChatEmojiPath(m.imageUrl) ? (
              <span className="chat-panel__bubble--emoji">
                <span className="chat-panel__image-wrap chat-panel__image-wrap--emoji">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="이모티콘" className="chat-panel__emoji-message-image" src={m.imageUrl} />
                </span>
              </span>
            ) : (
              <span className="omok-chat__bubble">{m.text}</span>
            )}
          </div>
        ))}
      </div>

      {sendError && <p className="omok-chat__error">{sendError}</p>}

      {config.emojis && isEmojiPickerOpen && (
        <div aria-label="모여밥 이모티콘 선택" className="chat-panel__emoji-picker" id={`${config.channelPrefix}-emoji-picker`}>
          {GAME_CHAT_EMOJIS.map((emoji) => (
            <button
              aria-label={`${emoji.label} 보내기`}
              className="chat-panel__emoji-option"
              disabled={sending}
              key={emoji.id}
              onClick={() => handleSendEmoji(emoji)}
              title={`${emoji.label} 보내기`}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={emoji.label} src={emoji.src} />
            </button>
          ))}
        </div>
      )}

      <form className="omok-chat__form" onSubmit={handleSubmit}>
        {config.emojis && (
          <button
            aria-controls={`${config.channelPrefix}-emoji-picker`}
            aria-expanded={isEmojiPickerOpen}
            aria-label="모여밥 이모티콘 선택"
            className={`chat-panel__tool-chip chat-panel__tool-chip--emoji ${isEmojiPickerOpen ? 'chat-panel__tool-chip--active' : ''}`}
            disabled={sending}
            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
            title="모여밥 이모티콘 선택"
            type="button"
          >
            🍚
          </button>
        )}
        <input
          aria-label="메시지"
          className="omok-chat__input"
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 보내기..."
          type="text"
          value={text}
        />
        <button className="omok-chat__send" disabled={!text.trim() || sending} type="submit">
          전송
        </button>
      </form>
    </div>
  );
}
