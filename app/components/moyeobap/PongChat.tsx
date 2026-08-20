'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

type PongChatMessage = {
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

export function PongChat({ roomId, canPost }: { roomId: string; canPost: boolean }) {
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ messages: PongChatMessage[] }>(
    `/api/games/pong/rooms/${roomId}/chat`,
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || !currentUser) return;

    setSendError(null);
    setText('');

    const optimisticMsg: PongChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      text: trimmed,
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

  return (
    <div className="pong-chat">
      <div className="pong-chat__header">CHAT</div>
      <div className="pong-chat__list" ref={listRef}>
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
            <span className="pong-chat__bubble">{m.text}</span>
          </div>
        ))}
      </div>

      {sendError && <p className="pong-chat__error">{sendError}</p>}

      {canPost ? (
        <form className="pong-chat__form" onSubmit={handleSubmit}>
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
