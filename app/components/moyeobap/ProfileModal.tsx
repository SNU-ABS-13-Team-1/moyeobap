import { type FormEvent, useState } from 'react';
import type { User } from '../../types/moyeobap';
import { DataNoticeModal } from './DataNoticeModal';
import { Modal } from './Modal';

export interface ProfileInput {
  displayName: string;
  bankName: string;
  accountNumber: string;
}

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (input: ProfileInput) => Promise<string | null>;
  onLogout: () => Promise<void>;
  onOpenFeedback: () => void;
}

export function ProfileModal({ user, onClose, onSave, onLogout, onOpenFeedback }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.name);
  const [bankName, setBankName] = useState(user.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(user.accountNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showDataNotice, setShowDataNotice] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSave({ displayName, bankName, accountNumber });
      if (result) setError(result);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);
    try {
      await onLogout();
    } catch {
      setError('로그아웃하지 못했어요. 잠시 뒤 다시 시도해주세요.');
      setLoggingOut(false);
    }
  }

  return (
    <Modal onClose={onClose} title="내 프로필">
      <form className="profile__form" onSubmit={handleSubmit}>
        <div className="profile__identity">
          {user.avatarUrl ? (
            // Google 계정의 프로필 이미지를 표시합니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="profile__avatar" src={user.avatarUrl} />
          ) : (
            <div className="profile__avatar profile__avatar--fallback">{user.initial}</div>
          )}
          <div>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>
        </div>

        <label className="profile__field">
          <span>표시 이름</span>
          <input
            className="auth__input"
            maxLength={40}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            type="text"
            value={displayName}
          />
        </label>
        <div className="profile__account-group">
          <div>
            <strong>정산 계좌</strong>
            <p>
              선택 사항이며, 직접 공유한 팟의 참여자에게만 보여요. 통계·분석
              대상에서는 제외돼요.{' '}
              <button
                className="auth__link-btn"
                onClick={() => setShowDataNotice(true)}
                type="button"
              >
                데이터 이용 안내
              </button>
            </p>
          </div>
          <label className="profile__field">
            <span>은행명</span>
            <input
              className="auth__input"
              maxLength={30}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="예: 카카오뱅크"
              type="text"
              value={bankName}
            />
          </label>
          <label className="profile__field">
            <span>계좌번호</span>
            <input
              className="auth__input"
              inputMode="numeric"
              maxLength={40}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="숫자와 하이픈만 입력"
              type="text"
              value={accountNumber}
            />
          </label>
        </div>

        {error && <p className="auth__error" role="alert">{error}</p>}
        <button
          className="profile__feedback-btn"
          disabled={submitting || loggingOut}
          onClick={onOpenFeedback}
          type="button"
        >
          피드백 보내기
        </button>
        <button className="create__submit-btn" disabled={submitting || loggingOut} type="submit">
          {submitting ? '저장 중...' : '프로필 저장'}
        </button>
        <button
          className="profile__logout-btn"
          disabled={submitting || loggingOut}
          onClick={handleLogout}
          type="button"
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </form>
      {showDataNotice && <DataNoticeModal onClose={() => setShowDataNotice(false)} />}
    </Modal>
  );
}
