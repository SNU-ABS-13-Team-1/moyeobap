import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { ChatMessageView, User } from '../../types/moyeobap';
import { fetcher } from '../../lib/fetcher';
import { getSupabase } from '../../lib/supabase';
import { getErrorMessage, requestJson } from '../../lib/api-client';

interface ChatPanelProps {
  potId: string;
  currentUser: User;
}

export function ChatPanel({ potId, currentUser }: ChatPanelProps) {
  const { data, error: loadError, mutate } = useSWR<{ messages: ChatMessageView[] }>(
    `/api/pots/${potId}/messages`,
    fetcher,
    { refreshInterval: 3000 },
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  // Supabase Realtime 구독 설정 (새 메시지가 수신되면 Polling 대기 없이 즉시 화면 업데이트)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`chat-pot-${potId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pot_id=eq.${potId}`,
        },
        () => {
          mutate();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [potId, mutate]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSendError(null);
    setText('');

    // 낙관적 UI 업데이트 (0ms 즉시 화면 반영)
    const optimisticMsg: ChatMessageView = {
      id: `temp-${Date.now()}`,
      authorName: currentUser.name,
      text: trimmed,
      createdAt: new Date().toISOString(),
      kind: 'text',
      isMine: true,
    };

    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    setSending(true);
    try {
      await requestJson(`/api/pots/${potId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      await mutate();
    } catch (error) {
      setSendError(getErrorMessage(error, '메시지를 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  async function handleShareAccount() {
    if (sending) return;
    setSending(true);
    setSendError(null);

    const accountText = `${currentUser.bankName} ${currentUser.accountNumber}`;
    const optimisticMsg: ChatMessageView = {
      id: `temp-${Date.now()}`,
      authorName: currentUser.name,
      text: accountText,
      createdAt: new Date().toISOString(),
      kind: 'account',
      isMine: true,
    };

    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    try {
      await requestJson(`/api/pots/${potId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareAccount: true }),
      });
      await mutate();
    } catch (error) {
      setSendError(getErrorMessage(error, '계좌번호를 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__list" ref={listRef}>
        {loadError && (
          <p className="chat-panel__error" role="alert">대화를 불러오지 못했어요.</p>
        )}
        {!loadError && messages.length === 0 && (
          <p className="chat-panel__empty">아직 대화가 없어요. 첫 메시지를 남겨보세요!</p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`chat-panel__message ${m.isMine ? 'chat-panel__message--mine' : ''}`}
          >
            {!m.isMine && (
              <span className="chat-panel__author">{m.authorName}</span>
            )}
            <span
              className={`chat-panel__bubble ${m.kind === 'account' ? 'chat-panel__bubble--account' : ''}`}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>
      {currentUser.bankName && currentUser.accountNumber && (
        <button
          type="button"
          className="chat-panel__account-btn"
          onClick={handleShareAccount}
          disabled={sending}
        >
          💳 계좌번호 전송
        </button>
      )}
      {sendError && <p className="chat-panel__error" role="alert">{sendError}</p>}
      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          aria-label="메시지"
          type="text"
          className="chat-panel__input"
          placeholder="메시지 보내기"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="chat-panel__send" disabled={!text.trim() || sending}>
          보내기
        </button>
      </form>
    </div>
  );
}
