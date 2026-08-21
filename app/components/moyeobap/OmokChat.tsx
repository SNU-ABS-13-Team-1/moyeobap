'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

type OmokChatAuthorRole = 'black' | 'white' | 'spectator';

type OmokChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: OmokChatAuthorRole | null;
  text: string;
  createdAt: string;
};

// 메시지를 쓴 시점의 역할입니다. 이 기능 이전에 쌓인 메시지는 역할이 없어서
// (null) 아무 표시도 붙이지 않습니다.
const ROLE_LABEL: Record<OmokChatAuthorRole, string> = {
  black: '흑',
  white: '백',
  spectator: '관전',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// myRole은 낙관적으로 먼저 그리는 내 메시지에 붙일 역할입니다. 서버가
// 저장하는 값과 같아서, 다음 갱신 때 배지가 바뀌어 보이지 않습니다.
export function OmokChat({ roomId, myRole }: { roomId: string; myRole: OmokChatAuthorRole }) {
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
      authorRole: myRole,
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
              [{formatTime(m.createdAt)}] {m.authorName}
              {m.authorRole && (
                <span className={`omok-chat__role omok-chat__role--${m.authorRole}`}>
                  {ROLE_LABEL[m.authorRole]}
                </span>
              )}
            </span>
            <span className="omok-chat__bubble">{m.text}</span>
          </div>
        ))}
      </div>

      {sendError && <p className="omok-chat__error">{sendError}</p>}

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
    </div>
  );
}
