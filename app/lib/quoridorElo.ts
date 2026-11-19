// 쿼리도 주간 Elo 계산(순수 함수). DB 반영은 quoridorRanking.ts가 합니다.
//
// 2인전은 표준 Elo입니다. 4인전은 승자 한 명만 정해지므로 "승자 대 패자 3명"을
// 각각 한 판으로 보고, 쌍이 3개 생기니 쌍마다 K를 32/3으로 나눕니다. 그래야 4인전 1승의
// 변동 폭이 2인전 1승과 비슷해집니다. 모든 변동은 시작 전 점수로 계산하고, 반올림은
// 플레이어당 마지막에 한 번만 합니다.

export const ELO_K = 32;
export const DEFAULT_RATING = 1200;

function expected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** 시작 전 점수 → 플레이어별 정수 변동. 패자끼리는 비교하지 않습니다. */
export function computeEloDeltas(ratings: Record<string, number>, winnerId: string, mode: 2 | 4): Record<string, number> {
  const k = ELO_K / (mode === 4 ? 3 : 1);
  const winner = ratings[winnerId] ?? DEFAULT_RATING;
  const deltas: Record<string, number> = {};
  let winnerDelta = 0;
  for (const [id, rating] of Object.entries(ratings)) {
    if (id === winnerId) continue;
    winnerDelta += k * (1 - expected(winner, rating));
    deltas[id] = Math.round(k * (0 - expected(rating, winner)));
  }
  return { [winnerId]: Math.round(winnerDelta), ...deltas };
}
