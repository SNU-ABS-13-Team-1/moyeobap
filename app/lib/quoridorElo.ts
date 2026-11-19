// 쿼리도 주간 Elo 계산(순수 함수). DB 반영은 quoridorRanking.ts가 합니다.
//
// 등수끼리 모든 쌍을 한 판씩으로 봅니다(위 등수가 이김). 쌍마다 K를 32/(인원-1)로 나눠
// 2인전은 표준 Elo(K=32)와 같고, 4인전 1위의 변동 폭이 2인전 1승과 비슷해집니다.
// 넷의 점수가 같으면 1위 +16, 2위 +5, 3위 -5, 4위 -16. 모든 변동은 시작 전 점수로
// 계산하고, 반올림은 플레이어당 마지막에 한 번만 합니다.

export const ELO_K = 32;
export const DEFAULT_RATING = 1200;

function expected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** 시작 전 점수와 등수(1이 최고) → 플레이어별 정수 변동. */
export function computeEloDeltas(ratings: Record<string, number>, ranks: Record<string, number>): Record<string, number> {
  const ids = Object.keys(ratings);
  const k = ELO_K / Math.max(1, ids.length - 1);
  const deltas: Record<string, number> = {};
  for (const id of ids) {
    let sum = 0;
    for (const other of ids) {
      if (other === id) continue;
      const score = (ranks[id] ?? ids.length) < (ranks[other] ?? ids.length) ? 1 : 0;
      sum += k * (score - expected(ratings[id], ratings[other]));
    }
    deltas[id] = Math.round(sum);
  }
  return deltas;
}
