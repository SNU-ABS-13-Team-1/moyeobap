'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // document.body는 서버에 없어서, 포털을 붙일 수 있는 마운트 이후에만
  // 렌더링합니다 (SSR/hydration 불일치를 피하려고 일부러 effect에 둡니다).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  if (!mounted) return null;

  // 모달 안에서 다른 모달(예: 데이터 이용 안내)을 열 때, 부모 모달의 DOM
  // 트리 안에 그대로 렌더링하면 부모 `.modal`의 CSS transform이 새로운
  // containing block을 만들어서 이 모달의 `position: fixed`가 전체 화면이
  // 아니라 부모 모달 박스 안에 갇혀버립니다. body에 직접 포털로 붙여서
  // 항상 실제 뷰포트 기준으로 뜨게 합니다.
  return createPortal(
    <div className="modal-overlay modal-overlay--active" onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>{title}</h2>
          <button
            aria-label="닫기"
            className="modal__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </section>
    </div>,
    document.body,
  );
}
