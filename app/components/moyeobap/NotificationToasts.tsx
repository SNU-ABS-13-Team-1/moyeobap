'use client';

import { useRouter } from 'next/navigation';
import { useNotifications } from './NotificationProvider';

// 화면 오른쪽 아래에 잠깐 떴다 사라지는 알림. 게임 중에는 헤더를 보고 있지
// 않으므로, 배지만으로는 새 팟이나 채팅을 놓칩니다.

export function NotificationToasts() {
  const router = useRouter();
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="notice-toasts">
      {toasts.map((toast) => (
        <button
          className={`notice-toast notice-toast--${toast.kind}`}
          key={toast.key}
          onClick={() => {
            dismissToast(toast.key);
            router.push(toast.href);
          }}
          type="button"
        >
          <span aria-hidden="true" className="notice-toast__icon">
            {toast.kind === 'pot' ? '🍚' : '💬'}
          </span>
          <span className="notice-toast__text">{toast.text}</span>
        </button>
      ))}
    </div>
  );
}
