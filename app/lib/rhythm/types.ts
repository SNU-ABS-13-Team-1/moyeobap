export type ChartNote = {
  id: number;
  time: number; // ms, 곡 시작 기준
  lane: number;
};

export type JudgmentTier = 'perfect' | 'great' | 'good' | 'miss';
