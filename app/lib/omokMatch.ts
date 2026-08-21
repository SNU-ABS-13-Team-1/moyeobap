// 대국 진행 규칙(착수 시계, 재대국 흑백 교대)입니다. 착수 자체의 규칙인
// omokForbidden.ts와 마찬가지로 렌더링·DB와 독립된 순수 함수 모듈이라
// 클라이언트(카운트다운 표시)와 서버(시간 초과 확정) 양쪽이 같은 로직을
// 그대로 씁니다.

/** 한 수에 주어지는 시간입니다. */
export const TURN_LIMIT_MS = 30_000;

/**
 * 서버가 시간 초과를 확정할 때만 얹는 여유분입니다. 클라이언트 카운트다운이
 * 0이 되는 순간 곧바로 /timeout을 호출하는데, 브라우저와 DB의 시계가 조금씩
 * 어긋나 있으면 서버 기준으로는 아직 30초가 안 됐을 수 있습니다. 그때
 * 요청이 거절되고 다음 폴링까지 판정이 밀리는 걸 막기 위한 완충입니다.
 * 화면에 보여주는 남은 시간에는 반영하지 않습니다.
 */
export const TURN_GRACE_MS = 2_000;

function startedAtMs(turnStartedAt: string | null): number | null {
  if (!turnStartedAt) return null;
  const parsed = Date.parse(turnStartedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 현재 차례가 시간 초과인지 판정합니다. 서버가 DB의 turn_started_at을 근거로
 * 다시 계산하는 지점이라, 클라이언트가 아무리 빨리 호출해도 실제로 시간이
 * 지나지 않았으면 false입니다.
 *
 * turn_started_at이 없는 방(이 기능 이전에 시작된 대국)은 기준 시각을 알 수
 * 없으므로 시간 초과로 보지 않습니다. 진행 중이던 대국이 갑자기 몰수패로
 * 끝나는 것보다 시계가 안 걸리는 편이 낫습니다.
 */
export function isTurnExpired(turnStartedAt: string | null, now: number): boolean {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return false;
  return now - started >= TURN_LIMIT_MS + TURN_GRACE_MS;
}

/**
 * 화면에 표시할 남은 시간(ms)입니다. 0 아래로 내려가거나 제한 시간을 넘겨
 * 표시되지 않도록 잘라냅니다(클라이언트 시계가 앞서거나 뒤처진 경우).
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
 * 재대국 때 흑/백을 통째로 맞바꾼 DB 컬럼 값을 돌려줍니다. id와 name이
 * 짝을 잃지 않도록 한 곳에서만 처리합니다.
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
