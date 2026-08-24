// 대국 진행 규칙(착수 시계, 재대국 흑백 교대)입니다. 순수 함수 모듈이라
// 클라이언트(카운트다운 표시)와 서버(시간 초과 확정) 양쪽이 같은 로직을
// 그대로 씁니다. app/lib/omokMatch.ts와 같은 모양이고, 19x19는 한 수에
// 필요한 고민 시간이 오목(15x15, 30초)보다 길어서 제한 시간만 60초로 둡니다.

/** 한 수에 주어지는 시간입니다. */
export const TURN_LIMIT_MS = 60_000;

/**
 * 서버가 시간 초과를 확정할 때만 얹는 여유분입니다. 클라이언트와 DB의
 * 시계가 조금씩 어긋나 있어도 곧바로 패배 처리되지 않도록 하는 완충이고,
 * 화면에 보여주는 남은 시간에는 반영하지 않습니다.
 */
export const TURN_GRACE_MS = 2_000;

function startedAtMs(turnStartedAt: string | null): number | null {
  if (!turnStartedAt) return null;
  const parsed = Date.parse(turnStartedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 현재 차례가 시간 초과인지 판정합니다. turn_started_at이 없는 방(마이그레이션
 * 이전 데이터)은 기준 시각을 알 수 없으므로 시간 초과로 보지 않습니다.
 */
export function isTurnExpired(turnStartedAt: string | null, now: number): boolean {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return false;
  return now - started >= TURN_LIMIT_MS + TURN_GRACE_MS;
}

/**
 * 화면에 표시할 남은 시간(ms)입니다. 0 아래로 내려가거나 제한 시간을 넘겨
 * 표시되지 않도록 잘라냅니다.
 */
export function remainingTurnMs(turnStartedAt: string | null, now: number): number {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return TURN_LIMIT_MS;
  const elapsed = now - started;
  if (elapsed <= 0) return TURN_LIMIT_MS;
  if (elapsed >= TURN_LIMIT_MS) return 0;
  return TURN_LIMIT_MS - elapsed;
}

/**
 * 재대국 때 흑/백을 통째로 맞바꾼 DB 컬럼 값을 돌려줍니다.
 */
export function swappedColors(room: {
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
}): { black_id: string; black_name: string; white_id: string; white_name: string } {
  if (!room.whiteId || !room.whiteName) {
    throw new Error("상대가 없는 방은 흑백을 교대할 수 없습니다.");
  }
  return {
    black_id: room.whiteId,
    black_name: room.whiteName,
    white_id: room.blackId,
    white_name: room.blackName,
  };
}
