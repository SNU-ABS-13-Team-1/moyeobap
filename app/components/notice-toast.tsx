"use client";

import { usePrototype } from "@/app/prototype-context";

export function NoticeToast() {
  const { notice, clearNotice } = usePrototype();
  if (!notice) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{notice}</span>
      <button type="button" onClick={clearNotice} aria-label="알림 닫기">
        ×
      </button>
    </div>
  );
}
