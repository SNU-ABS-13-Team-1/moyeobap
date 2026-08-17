import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { ChatMessageView, User } from '../../types/moyeobap';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';

interface ChatPanelProps {
  potId: string;
  currentUser: User;
}

function renderMessageText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-panel__link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
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
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [isOrderLinkModalOpen, setIsOrderLinkModalOpen] = useState(false);
  const [orderLinkUrl, setOrderLinkUrl] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const messages = data?.messages ?? [];
  const pinnedAccount = messages.findLast((message) => message.kind === 'account');
  const pinnedOrderLink = messages.findLast((message) => message.kind === 'order_link');

  function getAccountText(message: ChatMessageView) {
    const marker = '계좌번호:';
    const markerIndex = message.text.indexOf(marker);
    return markerIndex >= 0
      ? message.text.slice(markerIndex + marker.length).trim()
      : message.text.replace(/^💳\s*/, '').trim();
  }

  // Supabase Realtime 구독 설정 (새 메시지가 수신되면 Polling 대기 없이 즉시 화면 업데이트)
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      // Supabase 미설정 로컬 환경에서는 기존 3초 polling만 사용합니다.
      return;
    }

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

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  async function handleCopyAccount(message: ChatMessageView) {
    try {
      await navigator.clipboard.writeText(getAccountText(message));
      setCopiedAccountId(message.id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedAccountId(null), 1600);
    } catch {
      setSendError('계좌번호를 복사하지 못했어요. 직접 선택해 복사해주세요.');
    }
  }

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

  async function handleShareOrderLink(e: FormEvent) {
    e.preventDefault();
    const trimmed = orderLinkUrl.trim();
    if (!trimmed || sending) return;

    if (!/^https?:\/\//i.test(trimmed)) {
      setSendError('올바른 웹 링크(http:// 또는 https://)를 입력해주세요.');
      return;
    }

    setSending(true);
    setSendError(null);
    setIsOrderLinkModalOpen(false);
    setOrderLinkUrl('');

    const optimisticMsg: ChatMessageView = {
      id: `temp-${Date.now()}`,
      authorName: currentUser.name,
      text: trimmed,
      createdAt: new Date().toISOString(),
      kind: 'order_link',
      isMine: true,
    };

    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    try {
      await requestJson(`/api/pots/${potId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderLink: trimmed }),
      });
      await mutate();
    } catch (error) {
      setSendError(getErrorMessage(error, '주문 링크를 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      {pinnedOrderLink && (
        <div className="chat-panel__pinned-order-link">
          <div>
            <span>🛒 주문 링크 · {pinnedOrderLink.authorName}</span>
            <strong>{pinnedOrderLink.text}</strong>
          </div>
          <div className="chat-panel__pinned-actions">
            <a
              href={pinnedOrderLink.text}
              target="_blank"
              rel="noopener noreferrer"
              className="chat-panel__link-btn"
            >
              열기 ↗
            </a>
          </div>
        </div>
      )}
      {pinnedAccount && (
        <div className="chat-panel__pinned-account">
          <div>
            <span>💳 정산 계좌 · {pinnedAccount.authorName}</span>
            <strong>{getAccountText(pinnedAccount)}</strong>
          </div>
          <button onClick={() => handleCopyAccount(pinnedAccount)} type="button">
            {copiedAccountId === pinnedAccount.id ? '복사됨 ✓' : '복사'}
          </button>
        </div>
      )}
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
              className={`chat-panel__bubble ${
                m.kind === 'account'
                  ? 'chat-panel__bubble--account'
                  : m.kind === 'order_link'
                  ? 'chat-panel__bubble--order-link'
                  : ''
              }`}
            >
              {m.kind === 'order_link' ? (
                <div className="chat-panel__order-link-content">
                  <span className="chat-panel__order-link-badge">🛒 주문 링크</span>
                  <a
                    href={m.text}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-panel__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {m.text} ↗
                  </a>
                </div>
              ) : (
                renderMessageText(m.text)
              )}
            </span>
          </div>
        ))}
      </div>

      {isOrderLinkModalOpen && (
        <form className="chat-panel__link-form" onSubmit={handleShareOrderLink}>
          <div className="chat-panel__link-input-wrap">
            <input
              type="url"
              className="chat-panel__input chat-panel__link-input"
              placeholder="공유할 주문 링크 URL을 입력하세요 (https://...)"
              value={orderLinkUrl}
              onChange={(e) => setOrderLinkUrl(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="chat-panel__link-submit"
              disabled={!orderLinkUrl.trim() || sending}
            >
              공유
            </button>
            <button
              type="button"
              className="chat-panel__link-cancel"
              onClick={() => {
                setIsOrderLinkModalOpen(false);
                setOrderLinkUrl('');
              }}
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="chat-panel__quick-actions">
        <button
          type="button"
          className="chat-panel__quick-btn chat-panel__order-link-btn"
          onClick={() => setIsOrderLinkModalOpen((prev) => !prev)}
          disabled={sending}
        >
          🔗 주문 링크 공유
        </button>
        {currentUser.bankName && currentUser.accountNumber && (
          <button
            type="button"
            className="chat-panel__quick-btn chat-panel__account-btn"
            onClick={handleShareAccount}
            disabled={sending}
          >
            💳 계좌번호 전송
          </button>
        )}
      </div>

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
