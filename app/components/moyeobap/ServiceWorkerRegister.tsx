'use client';

import { useEffect } from 'react';

// PWA 설치 가능 조건(manifest + 서비스워커) 중 서비스워커 등록만 담당합니다.
// 화면에는 아무것도 그리지 않습니다.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('service worker 등록 실패:', error);
    });
  }, []);

  return null;
}
