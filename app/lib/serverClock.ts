// 서버 시각 보정. 남은 시간을 "서버가 찍은 턴 시작 시각"과 "내 컴퓨터 시계"로 계산하면
// 컴퓨터마다 시계가 몇 초씩 달라 사람마다 다른 초가 보입니다. 응답의 serverTime으로
// 내 시계와 서버 시계의 차이를 재서 보정합니다. 왕복이 짧은 측정일수록 정확하므로 그걸 씁니다.

export type ClockSample = { offsetMs: number; rttMs: number };

/** 요청을 보낸 시각(t0)·받은 시각(t1)과 서버 시각으로 차이를 잽니다. 서버 시각은 왕복의 가운데라고 봅니다. */
export function clockSample(sentAt: number, receivedAt: number, serverTime: unknown): ClockSample | null {
  if (typeof serverTime !== 'string') return null;
  const server = Date.parse(serverTime);
  if (!Number.isFinite(server) || receivedAt < sentAt) return null;
  return { offsetMs: server - (sentAt + receivedAt) / 2, rttMs: receivedAt - sentAt };
}

/** 왕복이 더 짧은(오차가 작은) 측정을 고릅니다. */
export function betterSample(current: ClockSample | null, next: ClockSample | null): ClockSample | null {
  if (!next) return current;
  if (!current) return next;
  return next.rttMs <= current.rttMs ? next : current;
}
