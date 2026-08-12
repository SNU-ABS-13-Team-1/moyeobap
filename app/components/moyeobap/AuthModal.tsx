import { useState } from 'react';
import { Modal } from './Modal';

interface AuthModalProps {
  onClose: () => void;
  onLogin: () => Promise<string | null>;
}

export function AuthModal({ onClose, onLogin }: AuthModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onLogin();
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
        <p className="auth__desc">
          Google 계정으로 로그인하면<br />팟에 참여하고 새 팟을 만들 수 있어요.
        </p>

        <button
          className="auth__google-btn"
          disabled={submitting}
          onClick={handleLogin}
          type="button"
        >
          <span aria-hidden="true" className="auth__google-icon">G</span>
          {submitting ? 'Google로 이동 중...' : 'Google 계정으로 계속하기'}
        </button>
        {error && <p className="auth__error" role="alert">{error}</p>}

        <div className="auth__divider"><span>안내</span></div>
        <p className="auth__guest-note">
          누구나 가입할 수 있으며, 로그인 없이도 진행 중인 팟은 볼 수 있어요.
        </p>
      </div>
    </Modal>
  );
}
