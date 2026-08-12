import { type FormEvent, useState } from 'react';
import { Modal } from './Modal';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (email: string, name: string, bankAccount: string) => Promise<string | null>;
}

export function AuthModal({ onClose, onLogin }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await onLogin(email, name, bankAccount);
      if (result) setError(result);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="로그인">
          <div className="auth__content">
            <div className="auth__emoji">🍚</div>
            <h3 className="auth__title">모여밥에 오신 걸 환영해요!</h3>
            <p className="auth__desc">이메일과 이름을 입력하면<br />팟에 참여하고 새 팟을 만들 수 있어요.</p>

            <form className="auth__form" onSubmit={handleSubmit}>
              <input
                aria-label="이메일"
                type="email"
                required
                placeholder="이메일"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="auth__input"
              />
              <input
                aria-label="이름"
                type="text"
                required
                placeholder="이름"
                value={name}
                onChange={e => setName(e.target.value)}
                className="auth__input"
              />
              <input
                aria-label="계좌번호"
                type="text"
                placeholder="계좌번호 (선택, 예: 카카오뱅크 3333-01-1234567)"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                className="auth__input"
              />
              <p className="auth__field-hint">
                등록하면 채팅방에서 버튼 한 번으로 계좌번호를 공유할 수 있어요. 나중에 다시
                로그인하면서 바꿀 수 있어요.
              </p>
              {error && <p className="auth__error">{error}</p>}
              <button type="submit" className="create__submit-btn" disabled={submitting}>
                {submitting ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className="auth__divider">
              <span>또는</span>
            </div>
            <p className="auth__guest-note">로그인 없이도 현재 진행중인 팟을 구경할 수 있어요 👀</p>
          </div>
    </Modal>
  );
}
