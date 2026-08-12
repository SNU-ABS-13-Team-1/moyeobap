import type { ToastNotice as ToastNoticeType } from '../../types/moyeobap';

interface ToastNoticeProps {
  toast: ToastNoticeType | null;
}

export function ToastNotice({ toast }: ToastNoticeProps) {
  if (!toast) return null;

  return (
    <div aria-live="polite" className={`toast toast--${toast.type}`} role="status">
      {toast.message}
    </div>
  );
}
