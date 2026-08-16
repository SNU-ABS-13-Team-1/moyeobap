import { type FormEvent, useState } from 'react';
import { Modal } from './Modal';

interface FeedbackModalProps {
  onClose: () => void;
  onSubmit: (content: string) => Promise<string | null>;
}

export function FeedbackModal({ onClose, onSubmit }: FeedbackModalProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmedContent = content.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmedContent.length < 5 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(trimmedContent);
      if (result) setError(result);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="피드백 보내기">
      <form className="feedback__form" onSubmit={handleSubmit}>
        <div>
          <strong>사용하면서 불편했던 점을 알려주세요.</strong>
          <p>짧게 적어도 괜찮아요. 현재 페이지 주소도 함께 전송돼요.</p>
        </div>
        <label>
          <span>피드백</span>
          <textarea
            autoFocus
            maxLength={1000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="예: 마감된 팟을 날짜별로 보고 싶어요."
            rows={6}
            value={content}
          />
        </label>
        <div className="feedback__count">{content.length} / 1,000</div>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <button
          className="create__submit-btn"
          disabled={trimmedContent.length < 5 || submitting}
          type="submit"
        >
          {submitting ? '보내는 중...' : '피드백 보내기'}
        </button>
      </form>
    </Modal>
  );
}
