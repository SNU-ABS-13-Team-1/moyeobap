'use client';

import dynamic from 'next/dynamic';

// 덱을 무작위로 섞는 게임이라 서버 렌더 결과와 브라우저 결과가 달라 hydration 오류가 납니다.
// 게임 화면은 브라우저에서만 그리도록 SSR을 끕니다.
const RummyGame = dynamic(() => import('./RummyGame').then((m) => m.RummyGame), {
  ssr: false,
  loading: () => <p className="rummy__loading">타일을 섞는 중…</p>,
});

export function RummyGameClient() {
  return <RummyGame />;
}
