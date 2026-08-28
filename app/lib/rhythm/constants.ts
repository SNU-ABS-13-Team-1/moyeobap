// 정밀 노트 리듬게임의 튜닝 값입니다. 'use client' 컴포넌트와 순수 함수
// 모듈(chart/judgment) 양쪽에서 안전하게 import해서 씁니다.

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 520;

export const LANE_COUNT = 4;
export const LANE_KEYS = ['d', 'f', 'j', 'k'] as const;
export const LANE_LABELS = ['D', 'F', 'J', 'K'] as const;

export const JUDGMENT_LINE_Y = CANVAS_HEIGHT - 90;
export const NOTE_RADIUS = 16;
export const NOTE_TRAVEL_MS = 900; // 노트가 화면 위에서 판정선까지 내려오는 데 걸리는 시간

// 판정 허용 오차(ms). PERFECT가 가장 좁고, GOOD을 넘어서면 자동 MISS 처리.
export const PERFECT_WINDOW_MS = 40;
export const GREAT_WINDOW_MS = 80;
export const GOOD_WINDOW_MS = 140;

export const COMBO_MULTIPLIER_TIERS: { combo: number; multiplier: number }[] = [
  { combo: 60, multiplier: 2.5 },
  { combo: 30, multiplier: 2.0 },
  { combo: 15, multiplier: 1.5 },
  { combo: 5, multiplier: 1.2 },
];

export const JUDGMENT_POINTS: Record<'perfect' | 'great' | 'good', number> = {
  perfect: 100,
  great: 70,
  good: 30,
};
