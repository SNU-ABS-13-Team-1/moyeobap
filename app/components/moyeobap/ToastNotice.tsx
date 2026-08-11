import React from 'react';
import { ToastNotice as ToastNoticeType } from '../../types/moyeobap';

interface ToastNoticeProps {
  toast: ToastNoticeType | null;
}

export const ToastNotice: React.FC<ToastNoticeProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.type}`}>
      {toast.message}
    </div>
  );
};
