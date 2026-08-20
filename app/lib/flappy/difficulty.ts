// 점수에 따른 난이도 곡선입니다. 전부 순수 함수라 obstacles.ts와
// FlappyGame.tsx 양쪽에서 같은 값을 계산할 수 있습니다.

import {
  MOVING_OBSTACLE_START_SCORE,
  PIPE_GAP_MAX,
  PIPE_GAP_MIN,
  PIPE_GAP_MIN_SCORE,
  PIPE_SPEED_MAX,
  PIPE_SPEED_MAX_SCORE,
  PIPE_SPEED_MIN,
} from './constants';

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 점진적으로 빨라지다가 PIPE_SPEED_MAX_SCORE 이후로는 최대 속도를 유지합니다.
export function getPipeSpeed(score: number): number {
  return lerp(PIPE_SPEED_MIN, PIPE_SPEED_MAX, clamp01(score / PIPE_SPEED_MAX_SCORE));
}

// 점수가 오를수록 통과 구간이 좁아지다가 PIPE_GAP_MIN_SCORE 이후로는
// 최소 간격(항상 통과 가능하도록 보장된 하한선)으로 고정됩니다.
export function getPipeGap(score: number): number {
  return lerp(PIPE_GAP_MAX, PIPE_GAP_MIN, clamp01(score / PIPE_GAP_MIN_SCORE));
}

export function isMovingObstacleUnlocked(score: number): boolean {
  return score >= MOVING_OBSTACLE_START_SCORE;
}

// 이동 장애물이 등장할 확률. 처음 등장 시점엔 낮게 시작해서 점수가 오를수록
// 점점 자주 나오다가 절반 정도에서 상한을 둡니다.
export function getMovingObstacleChance(score: number): number {
  if (!isMovingObstacleUnlocked(score)) return 0;
  const progress = clamp01((score - MOVING_OBSTACLE_START_SCORE) / 60);
  return lerp(0.25, 0.55, progress);
}
