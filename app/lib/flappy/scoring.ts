// 파이프 통과 판정과 콤보 배율 계산입니다. 순수 함수라 FlappyGame.tsx에서
// "새가 파이프를 지나쳤다"는 이벤트가 발생할 때마다 호출합니다.

import { COMBO_MULTIPLIER_TIERS, EDGE_BONUS_RATIO, EDGE_BONUS_RATIO_HIGH, PERFECT_RATIO } from './constants';

export type PassResult = {
  basePoints: number;
  bonusPoints: number;
  perfect: boolean;
  multiplier: number;
  totalPoints: number;
};

export function getComboMultiplier(combo: number): number {
  for (const tier of COMBO_MULTIPLIER_TIERS) {
    if (combo >= tier.combo) return tier.multiplier;
  }
  return 1;
}

/**
 * birdY와 파이프 통과 구간(gapY~gapY+gapHeight)의 관계로 점수를 계산합니다.
 * - 중심에 아주 가깝게 지나가면 PERFECT(+3)
 * - 가장자리에 가깝게(위험하게) 지나가면 보너스(+1 또는 +2)
 * - nextCombo(이번 통과까지 반영한 콤보 수)로 배율을 정합니다.
 */
export function evaluatePass(birdY: number, gapY: number, gapHeight: number, nextCombo: number): PassResult {
  const center = gapY + gapHeight / 2;
  const distanceRatio = Math.abs(birdY - center) / (gapHeight / 2);

  let bonusPoints = 0;
  let perfect = false;
  if (distanceRatio <= PERFECT_RATIO) {
    perfect = true;
    bonusPoints = 3;
  } else if (distanceRatio >= EDGE_BONUS_RATIO_HIGH) {
    bonusPoints = 2;
  } else if (distanceRatio >= EDGE_BONUS_RATIO) {
    bonusPoints = 1;
  }

  const basePoints = 1;
  const multiplier = getComboMultiplier(nextCombo);
  const totalPoints = Math.round((basePoints + bonusPoints) * multiplier);

  return { basePoints, bonusPoints, perfect, multiplier, totalPoints };
}
