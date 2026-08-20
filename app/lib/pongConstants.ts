// Pong 게임/물리 상수를 한 곳에서 관리합니다. 클라이언트(호스트 물리 루프,
// 게스트 렌더링)와 서버(app/lib/pong.ts의 목표 점수 판정)가 이 값을 함께
// import해서 씁니다. supabase 등 서버 전용 모듈을 import하지 않는 순수
// 상수 파일이라 'use client' 컴포넌트에서도 안전하게 쓸 수 있습니다.

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 400;

export const PADDLE_WIDTH = 10;
export const PADDLE_HEIGHT = 65;
export const PADDLE_MARGIN = 20; // 좌우 벽에서 패들까지 거리
export const PADDLE_SPEED = 360; // px/second

export const BALL_RADIUS = 8;
export const BALL_START_SPEED = 480; // px/second
export const BALL_MAX_SPEED = 900; // px/second
export const BALL_SPEED_INCREMENT = 34; // 패들에 맞을 때마다 증가폭

export const TARGET_SCORE = 5;

export const BROADCAST_INTERVAL_MS = 50; // 호스트 → 상대 상태 방송 주기(~20Hz)
export const COUNTDOWN_SECONDS = 3;
export const DISCONNECT_CLAIM_DELAY_MS = 60_000;
