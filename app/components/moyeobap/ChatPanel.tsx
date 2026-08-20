import { type FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { ChatMessageView, User } from '../../types/moyeobap';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import {
  CHAT_EMOJIS,
  getChatEmojiBySrc,
  isChatEmojiPath,
  type ChatEmoji,
} from '../../data/chat-emojis';
import { useAuth } from './AuthProvider';

interface ChatPanelProps {
  potId: string;
  currentUser: User;
  isActive?: boolean;
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

export function ChatPanel({ potId, currentUser, isActive = true }: ChatPanelProps) {
  const { openProfile } = useAuth();
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
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [orderLinkUrl, setOrderLinkUrl] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const scrolledPotIdRef = useRef<string | null>(null);
  const wasActiveRef = useRef(false);
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

  // 메시지 로드 및 추가 시 최하단 스크롤 (PC 진입 및 모바일 탭 전환 시 즉시 하단 포커싱, 이후 새 메시지는 부드러운 스크롤)
  useEffect(() => {
    if (!listRef.current || messages.length === 0) return;

    // 모바일에서는 isActive(채팅 탭 활성화 여부)를 따르고, PC(화면폭 > 768px)에서는 항상 활성 상태로 간주
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    const effectiveActive = isDesktop || Boolean(isActive);

    const isBecomingActive = effectiveActive && !wasActiveRef.current;
    const isNewPot = scrolledPotIdRef.current !== potId;

    if (isNewPot || isBecomingActive) {
      if (effectiveActive) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
        listRef.current.style.opacity = '1';
        scrolledPotIdRef.current = potId;
        wasActiveRef.current = true;

        // 이미지/이모티콘 렌더링 높이 보정용 이중 타이머
        const timer1 = window.setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        }, 50);
        const timer2 = window.setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        }, 180);

        return () => {
          window.clearTimeout(timer1);
          window.clearTimeout(timer2);
        };
      }
    } else if (effectiveActive) {
      // 이후 새 메시지가 올 때 부드러운 스크롤
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }

    wasActiveRef.current = effectiveActive;
  }, [messages.length, potId, isActive]);

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

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSendError('5MB 이하의 이미지만 업로드할 수 있어요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setImagePreview(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSendImage() {
    if (!imagePreview || sending) return;

    setSending(true);
    setSendError(null);
    const dataUrl = imagePreview;
    setImagePreview(null);

    const optimisticMsg: ChatMessageView = {
      id: `temp-${Date.now()}`,
      authorName: currentUser.name,
      text: dataUrl,
      createdAt: new Date().toISOString(),
      kind: 'image',
      imageUrl: dataUrl,
      isMine: true,
    };

    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    try {
      await requestJson(`/api/pots/${potId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: dataUrl }),
      });
      await mutate();
    } catch (error) {
      setSendError(getErrorMessage(error, '사진을 보내지 못했어요.'));
      await mutate();
    } finally {
      setSending(false);
    }
  }

  async function handleSendEmoji(emoji: ChatEmoji) {
    if (sending) return;

    setSending(true);
    setSendError(null);
    setIsEmojiPickerOpen(false);

    const optimisticMsg: ChatMessageView = {
      id: `temp-emoji-${emoji.id}`,
      authorName: currentUser.name,
      text: emoji.src,
      createdAt: new Date().toISOString(),
      kind: 'image',
      imageUrl: emoji.src,
      isMine: true,
    };

    mutate((prev) => ({ messages: [...(prev?.messages ?? []), optimisticMsg] }), false);

    try {
      await requestJson(`/api/pots/${potId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emojiId: emoji.id }),
      });
      await mutate();
    } catch (error) {
      setSendError(getErrorMessage(error, '이모티콘을 보내지 못했어요.'));
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
      <div
        className="chat-panel__list"
        ref={listRef}
        style={{
          transition: 'opacity 0.12s ease',
        }}
      >
        {loadError && (
          <p className="chat-panel__error" role="alert">대화를 불러오지 못했어요.</p>
        )}
        {!loadError && !data && (
          <div className="chat-panel__empty" style={{ opacity: 0.6 }}>대화를 불러오는 중...</div>
        )}
        {!loadError && data && messages.length === 0 && (
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
                  : m.kind === 'image' && isChatEmojiPath(m.imageUrl)
                  ? 'chat-panel__bubble--emoji'
                  : m.kind === 'image'
                  ? 'chat-panel__bubble--image'
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
              ) : m.kind === 'image' && m.imageUrl ? (
                <div className={`chat-panel__image-wrap ${
                  isChatEmojiPath(m.imageUrl) ? 'chat-panel__image-wrap--emoji' : ''
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.imageUrl}
                    alt={getChatEmojiBySrc(m.imageUrl)?.label ?? '공유된 사진'}
                    className={
                      isChatEmojiPath(m.imageUrl)
                        ? 'chat-panel__emoji-message-image'
                        : 'chat-panel__image-thumb'
                    }
                    onClick={
                      isChatEmojiPath(m.imageUrl)
                        ? undefined
                        : () => setViewingImage(m.imageUrl ?? null)
                    }
                  />
                </div>
              ) : (
                renderMessageText(m.text)
              )}
            </span>
          </div>
        ))}
      </div>

      {imagePreview && (
        <div className="chat-panel__preview-box">
          <div className="chat-panel__preview-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="선택한 사진 미리보기" className="chat-panel__preview-img" />
            <div className="chat-panel__preview-actions">
              <button
                type="button"
                className="chat-panel__preview-send"
                onClick={handleSendImage}
                disabled={sending}
              >
                {sending ? '전송 중...' : '사진 전송'}
              </button>
              <button
                type="button"
                className="chat-panel__preview-cancel"
                onClick={() => setImagePreview(null)}
                disabled={sending}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingImage && (
        <div className="chat-panel__image-modal" onClick={() => setViewingImage(null)}>
          <div className="chat-panel__image-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingImage} alt="원본 사진" className="chat-panel__image-modal-img" />
            <button
              type="button"
              className="chat-panel__image-modal-close"
              onClick={() => setViewingImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      {isEmojiPickerOpen && (
        <div
          className="chat-panel__emoji-picker"
          id="chat-emoji-picker"
          aria-label="모여밥 이모티콘 선택"
        >
          {CHAT_EMOJIS.map((emoji) => (
            <button
              type="button"
              className="chat-panel__emoji-option"
              key={emoji.id}
              onClick={() => handleSendEmoji(emoji)}
              disabled={sending}
              title={`${emoji.label} 보내기`}
              aria-label={`${emoji.label} 보내기`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emoji.src} alt={emoji.label} />
            </button>
          ))}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      <div className="chat-panel__toolbar">
        <button
          type="button"
          className="chat-panel__tool-chip chat-panel__tool-chip--photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="사진 첨부하기"
          aria-label="사진 첨부하기"
        >
          📷 사진
        </button>
        <button
          type="button"
          className={`chat-panel__tool-chip chat-panel__tool-chip--emoji ${isEmojiPickerOpen ? 'chat-panel__tool-chip--active' : ''}`}
          onClick={() => {
            setIsEmojiPickerOpen((prev) => !prev);
            setIsOrderLinkModalOpen(false);
          }}
          disabled={sending}
          title="모여밥 이모티콘 선택"
          aria-label="모여밥 이모티콘 선택"
          aria-expanded={isEmojiPickerOpen}
          aria-controls="chat-emoji-picker"
        >
          🍚 이모티콘
        </button>
        <button
          type="button"
          className={`chat-panel__tool-chip chat-panel__tool-chip--link ${isOrderLinkModalOpen ? 'chat-panel__tool-chip--active' : ''}`}
          onClick={() => {
            setIsOrderLinkModalOpen((prev) => !prev);
            setIsEmojiPickerOpen(false);
          }}
          disabled={sending}
          title="배달앱 주문 링크 공유"
          aria-label="배달앱 주문 링크 공유"
        >
          🔗 주문 링크
        </button>
        {currentUser.bankName && currentUser.accountNumber ? (
          <button
            type="button"
            className="chat-panel__tool-chip chat-panel__tool-chip--account"
            onClick={handleShareAccount}
            disabled={sending}
            title="내 계좌번호 공유"
            aria-label="내 계좌번호 공유"
          >
            💳 계좌 전송
          </button>
        ) : (
          <button
            type="button"
            className="chat-panel__tool-chip chat-panel__tool-chip--account"
            onClick={openProfile}
            disabled={sending}
            title="정산용 계좌번호 등록"
          >
            💳 계좌 등록
          </button>
        )}
      </div>

      {sendError && <p className="chat-panel__error" role="alert">{sendError}</p>}
      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          aria-label="메시지"
          type="text"
          className="chat-panel__input"
          placeholder="메시지 보내기..."
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="chat-panel__send" disabled={!text.trim() || sending}>
          전송
        </button>
      </form>
    </div>
  );
}
