'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
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
};

export type GameChatMessage<Role extends string> = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role | null;
  text: string;
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || !currentUser) return;

    setSendError(null);
    setText('');

    const optimisticMsg: GameChatMessage<Role> = {
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

  return (
    <div className="omok-chat">
      <div className="omok-chat__list" ref={listRef}>
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
