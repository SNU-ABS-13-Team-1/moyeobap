// 파이프(장애물) 생성을 담당합니다. difficulty.ts의 곡선값을 바탕으로
// "패턴이 다양하면서도, 새가 flap 힘으로 실제 도달 가능한 위치에만" 다음
// 파이프를 배치합니다 — "완전히 통과 불가능한 상황은 절대 생성하지 않는다"는
// 요구사항을 확률이 아니라 매 파이프 생성 시점의 클램프로 강제합니다.

import { CANVAS_HEIGHT, CANVAS_WIDTH, FLAP_VELOCITY, PIPE_HORIZONTAL_SPACING } from './constants';
import { getMovingObstacleChance, getPipeGap, getPipeSpeed, isMovingObstacleUnlocked } from './difficulty';

export type PipePattern = 'random' | 'high' | 'low' | 'alternating';

export type Pipe = {
  id: number;
  x: number;
  gapY: number; // 통과 구간 상단 y좌표
  gapHeight: number;
  scored: boolean;
  hasMovingObstacle: boolean;
  movingObstaclePhase: number;
};

const GAP_MARGIN = 40; // 화면 위/아래 끝에서 통과 구간까지 최소 여백
const PATTERNS: PipePattern[] = ['random', 'high', 'low', 'alternating'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickNextPattern(exclude: PipePattern): PipePattern {
  const options = PATTERNS.filter((p) => p !== exclude);
  return options[Math.floor(Math.random() * options.length)];
}

export function createObstacleGenerator() {
  let nextId = 1;
  let lastGapY = CANVAS_HEIGHT / 2 - 80;
  let pattern: PipePattern = 'random';
  let patternPipesLeft = 0;
  let alternateUp = true;

  function next(score: number): Pipe {
    if (patternPipesLeft <= 0) {
      pattern = pickNextPattern(pattern);
      patternPipesLeft = 4 + Math.floor(Math.random() * 4); // 패턴 4~7개 단위로 로테이션
    }
    patternPipesLeft -= 1;

    const gapHeight = getPipeGap(score);
    const minY = GAP_MARGIN;
    const maxY = CANVAS_HEIGHT - GAP_MARGIN - gapHeight;

    // 다음 파이프까지 도달하는 데 걸리는 시간 동안, flap 힘으로 실제 오를 수
    // 있는 최대 수직 이동 거리(여유를 두어 90%만 허용).
    const speed = getPipeSpeed(score);
    const travelTime = PIPE_HORIZONTAL_SPACING / speed;
    const maxReachableDelta = Math.abs(FLAP_VELOCITY) * travelTime * 0.9;

    let targetY: number;
    if (pattern === 'high') {
      targetY = minY + gapHeight * 0.25;
    } else if (pattern === 'low') {
      targetY = maxY - gapHeight * 0.25;
    } else if (pattern === 'alternating') {
      targetY = alternateUp ? minY + gapHeight * 0.35 : maxY - gapHeight * 0.35;
      alternateUp = !alternateUp;
    } else {
      targetY = minY + Math.random() * (maxY - minY);
    }

    let gapY = clamp(targetY, lastGapY - maxReachableDelta, lastGapY + maxReachableDelta);
    gapY = clamp(gapY, minY, maxY);

    // 직전 파이프와 높이가 지나치게 비슷하면(같은 패턴이 alternating이
    // 아닌 이상) 살짝 밀어내서 다양한 상하 이동을 유도합니다.
    if (pattern !== 'alternating' && Math.abs(gapY - lastGapY) < gapHeight * 0.25) {
      const pushDirection = gapY >= lastGapY ? 1 : -1;
      gapY = clamp(gapY + pushDirection * gapHeight * 0.4, minY, maxY);
      gapY = clamp(gapY, lastGapY - maxReachableDelta, lastGapY + maxReachableDelta);
    }

    lastGapY = gapY;

    const hasMovingObstacle = isMovingObstacleUnlocked(score) && Math.random() < getMovingObstacleChance(score);

    return {
      id: nextId++,
      x: CANVAS_WIDTH,
      gapY,
      gapHeight,
      scored: false,
      hasMovingObstacle,
      movingObstaclePhase: Math.random() * Math.PI * 2,
    };
  }

  function reset() {
    lastGapY = CANVAS_HEIGHT / 2 - 80;
    pattern = 'random';
    patternPipesLeft = 0;
    alternateUp = true;
  }

  return { next, reset };
}

export type ObstacleGenerator = ReturnType<typeof createObstacleGenerator>;
