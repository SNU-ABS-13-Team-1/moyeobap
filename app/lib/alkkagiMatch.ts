// 한 턴의 시계와 재대국 흑백 교대입니다. 순수 함수 모듈이라 클라이언트
// (카운트다운 표시)와 서버(시간 초과 확정) 양쪽이 같은 로직을 그대로 씁니다.
// app/lib/omokMatch.ts·badukMatch.ts와 같은 모양이고, 알까기만의 차이가 둘
// 있습니다.
//
// 1. 제한 시간이 45초입니다. 오목(30초)보다 넉넉한 건 돌을 끌어 각도와
//    세기를 맞추는 데 생각할 시간이 필요해서입니다.
// 2. **turn_started_at이 미래일 수 있습니다.** 내가 쏘는 순간 상대 차례가
//    시작되는데 상대 화면에서는 돌이 아직 굴러가는 중이라, 서버가 "돌이 다
//    멈추는 시각"을 찍어둡니다(app/lib/alkkagi.ts의 submitShot). 아래 두
//    함수는 경과가 음수인 경우를 제한 시간이 그대로 남은 것으로 다뤄
//    그 경우를 자연스럽게 처리합니다.

/** 한 턴에 주어지는 시간입니다. */
export const TURN_LIMIT_MS = 45_000;

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
 * 현재 차례가 시간 초과인지 판정합니다. turn_started_at이 없는 방은 기준
 * 시각을 알 수 없으므로 시간 초과로 보지 않습니다.
 */
export function isTurnExpired(turnStartedAt: string | null, now: number): boolean {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return false;
  return now - started >= TURN_LIMIT_MS + TURN_GRACE_MS;
}

/**
 * 화면에 표시할 남은 시간(ms)입니다. 0 아래로 내려가거나 제한 시간을 넘겨
 * 표시되지 않도록 잘라냅니다(돌이 아직 구르는 중이라 시작 시각이 미래인
 * 경우도 여기서 제한 시간 그대로가 됩니다).
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
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
}): { black_id: string; black_name: string; white_id: string; white_name: string } {
  if (!room.blackId || !room.blackName || !room.whiteId || !room.whiteName) {
    throw new Error("상대가 없는 방은 흑백을 교대할 수 없습니다.");
  }
  return {
    black_id: room.whiteId,
    black_name: room.whiteName,
    white_id: room.blackId,
    white_name: room.blackName,
  };
}
