import { COMBO_MULTIPLIER_TIERS, GOOD_WINDOW_MS, GREAT_WINDOW_MS, JUDGMENT_POINTS, PERFECT_WINDOW_MS } from './constants';
import type { JudgmentTier } from './types';

/** 노트 시각(noteTime)과 실제 입력 시각(hitTime)의 차이(ms)로 판정 등급을
 * 매깁니다. GOOD_WINDOW_MS를 넘으면 애초에 판정 후보에서 제외되어야 하지만
 * (호출부 책임), 안전하게 'miss'를 반환합니다. */
export function judgeHit(noteTime: number, hitTime: number): JudgmentTier {
  const diff = Math.abs(hitTime - noteTime);
  if (diff <= PERFECT_WINDOW_MS) return 'perfect';
  if (diff <= GREAT_WINDOW_MS) return 'great';
  if (diff <= GOOD_WINDOW_MS) return 'good';
  return 'miss';
}

export function isWithinHitWindow(noteTime: number, hitTime: number): boolean {
  return Math.abs(hitTime - noteTime) <= GOOD_WINDOW_MS;
}

export function getComboMultiplier(combo: number): number {
  for (const tier of COMBO_MULTIPLIER_TIERS) {
    if (combo >= tier.combo) return tier.multiplier;
  }
  return 1;
}

/** combo는 이번 판정까지 반영한 값입니다. miss는 항상 0점. */
export function getJudgmentPoints(tier: JudgmentTier, combo: number): number {
  if (tier === 'miss') return 0;
  return Math.round(JUDGMENT_POINTS[tier] * getComboMultiplier(combo));
}
