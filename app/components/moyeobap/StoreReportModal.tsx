'use client';

import { type FormEvent, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from './AuthProvider';

// /api/feedback가 content를 1000자로 잘라내므로, 접두사까지 포함해 이 길이를 넘지 않아야 합니다.
const FEEDBACK_MAX_LENGTH = 1000;

interface StoreReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  onSuccess?: (message: string) => void;
}

export function StoreReportModal({
  isOpen,
  onClose,
  restaurantName,
  onSuccess,
}: StoreReportModalProps) {
  const { currentUser, openAuth } = useAuth();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmedContent = content.trim();
  const reportPrefix = `[매장 정보 수정 제보: ${restaurantName}] `;
  const maxContentLength = Math.max(0, FEEDBACK_MAX_LENGTH - reportPrefix.length);

  if (!isOpen) return null;

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) {
      openAuth();
      return;
    }

    if (trimmedContent.length < 5 || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${reportPrefix}${trimmedContent}`,
          pagePath: `${window.location.pathname}${window.location.search}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '제보를 보내지 못했어요.');
      }

      setContent('');
      onClose();
      if (onSuccess) {
        onSuccess('소중한 제보 감사합니다! 검토 후 반영할게요. 💌');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '제보 전송 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={handleClose} title="매장 정보 수정 제보">
      <form className="feedback__form" onSubmit={handleSubmit}>
        <div>
          <strong>{restaurantName}의 달라진 정보를 알려주세요.</strong>
          <p>예: 메뉴 가격 변동, 최소주문금액이나 영업시간 변경 등</p>
        </div>
        <label>
          <span>제보 내용</span>
          <textarea
            autoFocus
            maxLength={maxContentLength}
            onChange={(event) => {
              setContent(event.target.value);
              if (error) setError(null);
            }}
            placeholder="예: 순대국밥 가격이 10,000원에서 11,000원으로 올랐어요."
            rows={5}
            value={content}
            disabled={submitting}
          />
        </label>
        <div className="feedback__count">
          {content.length} / {maxContentLength.toLocaleString()} (최소 5자)
        </div>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <button
          className="create__submit-btn"
          disabled={trimmedContent.length < 5 || submitting}
          type="submit"
        >
          {submitting ? '보내는 중...' : '수정 제보하기'}
        </button>
      </form>
    </Modal>
  );
}
