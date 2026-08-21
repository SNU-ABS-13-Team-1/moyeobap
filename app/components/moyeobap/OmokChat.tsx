'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

type OmokChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// 메시지를 보낸 시점이 아니라 "지금" 이 방에서 그 사람이 흑/백/관전자
// 무엇인지 계산합니다. 흑/백 전환 기능과 맞물려 있어, 전환 후에는 과거
// 메시지의 표시도 최신 배정을 따릅니다(별도 이력 컬럼을 추가하지 않은
// 의도적인 단순화입니다).
function roleLabel(authorId: string, blackId: string, whiteId: string | null): string {
  if (authorId === blackId) return '흑';
  if (whiteId && authorId === whiteId) return '백';
  return '관전자';
}

export function OmokChat({
  roomId,
  canPost,
  blackId,
  whiteId,
}: {
  roomId: string;
  canPost: boolean;
  blackId: string;
  whiteId: string | null;
}) {
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ messages: OmokChatMessage[] }>(
    `/api/games/omok/rooms/${roomId}/chat`,
    fetcher,
    { refreshInterval: 3000 },
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const channel = supabase
      .channel(`omok-chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'omok_chat_messages', filter: `room_id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || !currentUser) return;

    setSendError(null);
    setText('');

    const optimisticMsg: OmokChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/chat`, {
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

  return (
    <div className="omok-chat">
      <div className="omok-chat__list" ref={listRef}>
        {error && <p className="omok-chat__error">대화를 불러오지 못했어요.</p>}
        {!error && messages.length === 0 && (
          <p className="omok-chat__empty">아직 대화가 없어요.</p>
        )}
        {messages.map((m) => (
          <div
            className={`omok-chat__message ${m.authorId === currentUser?.id ? 'omok-chat__message--mine' : ''}`}
            key={m.id}
          >
            <span className="omok-chat__meta">
              [{formatTime(m.createdAt)}] [{roleLabel(m.authorId, blackId, whiteId)}] {m.authorName}
            </span>
            <span className="omok-chat__bubble">{m.text}</span>
          </div>
        ))}
      </div>

      {sendError && <p className="omok-chat__error">{sendError}</p>}

      {canPost ? (
        <form className="omok-chat__form" onSubmit={handleSubmit}>
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
      ) : (
        <p className="omok-chat__spectator-note">로그인하면 채팅할 수 있어요.</p>
      )}
    </div>
  );
}
