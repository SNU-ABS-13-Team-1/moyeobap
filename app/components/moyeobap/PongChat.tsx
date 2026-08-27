'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { GAME_CHAT_EMOJIS, isChatEmojiPath, type ChatEmoji } from '../../data/chat-emojis';
import { isChatAtBottom } from '../../lib/chatScroll';
import { useAuth } from './AuthProvider';

// 퐁 채팅은 공용 GameChat을 쓰지 않습니다 — 화면 배색(pong-chat__*)이 게임과
// 맞춰져 있고, 관전자는 읽기만 되는 규칙이 여기에만 있습니다. 이모티콘 UI만
// 같은 클래스(chat-panel__emoji-*)를 빌려 씁니다.

type PongChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  /** 이모티콘 메시지는 'image'. 이 기능 이전 메시지는 undefined입니다. */
  kind?: 'text' | 'image';
  imageUrl?: string;
  createdAt: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function PongChat({ roomId, canPost }: { roomId: string; canPost: boolean }) {
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ messages: PongChatMessage[] }>(
    `/api/games/pong/rooms/${roomId}/chat`,
    fetcher,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    },
  );
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
      .channel(`pong-chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pong_chat_messages', filter: `room_id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

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

    const optimisticMsg: PongChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      text: trimmed,
      kind: 'text',
      createdAt: new Date().toISOString(),
    };
    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/chat`, {
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

    const optimisticMsg: PongChatMessage = {
      id: `temp-emoji-${crypto.randomUUID()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      text: emoji.src,
      kind: 'image',
      imageUrl: emoji.src,
      createdAt: new Date().toISOString(),
    };
    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/chat`, {
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
    <div className="pong-chat">
      <div className="pong-chat__header">CHAT</div>
      <div className="pong-chat__list" onScroll={handleListScroll} ref={listRef}>
        {error && <p className="pong-chat__error">대화를 불러오지 못했어요.</p>}
        {!error && messages.length === 0 && (
          <p className="pong-chat__empty">아직 대화가 없어요.</p>
        )}
        {messages.map((m) => (
          <div
            className={`pong-chat__message ${m.authorId === currentUser?.id ? 'pong-chat__message--mine' : ''}`}
            key={m.id}
          >
            <span className="pong-chat__meta">
              [{formatTime(m.createdAt)}] {m.authorName}
            </span>
            {m.kind === 'image' && m.imageUrl && isChatEmojiPath(m.imageUrl) ? (
              <span className="chat-panel__bubble--emoji">
                <span className="chat-panel__image-wrap chat-panel__image-wrap--emoji">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="이모티콘" className="chat-panel__emoji-message-image" src={m.imageUrl} />
                </span>
              </span>
            ) : (
              <span className="pong-chat__bubble">{m.text}</span>
            )}
          </div>
        ))}
      </div>

      {sendError && <p className="pong-chat__error">{sendError}</p>}

      {canPost && isEmojiPickerOpen && (
        <div aria-label="모여밥 이모티콘 선택" className="chat-panel__emoji-picker" id="pong-chat-emoji-picker">
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

      {canPost ? (
        <form className="pong-chat__form" onSubmit={handleSubmit}>
          <button
            aria-controls="pong-chat-emoji-picker"
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
          <input
            aria-label="메시지"
            className="pong-chat__input"
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="메시지 입력..."
            type="text"
            value={text}
          />
          <button className="pong-chat__send" disabled={!text.trim() || sending} type="submit">
            SEND
          </button>
        </form>
      ) : (
        <p className="pong-chat__spectator-note">참여자만 채팅할 수 있어요.</p>
      )}
    </div>
  );
}
