import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastNotice } from '../types/moyeobap';

export function useToastNotice(durationMs = 3000) {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastNotice['type'] = 'success') => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setToast({ message, type });
      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return { toast, showToast };
}
