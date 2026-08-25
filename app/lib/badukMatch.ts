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

// ---------- 계가 신청 ----------

/** 계가 신청에 대해 할 수 있는 행동입니다. */
export type ScoreOfferAction = "offer" | "accept" | "decline";

/** 계가 신청 판정에 필요한 방 정보만 추린 모양입니다. */
export type ScoreOfferRoom = {
  status: string;
  blackId: string;
  whiteId: string | null;
  scoreOfferBy: string | null;
};

/**
 * 계가 신청/수락/거절이 지금 가능한지 판정합니다. 통과하면 null을, 막히면
 * 그대로 사용자에게 보여줄 이유를 돌려줍니다.
 *
 * DB를 타지 않는 순수 함수로 떼어 둔 이유는, 신청이 걸린 사이에 상대가
 * 수를 두거나 기권해서 방 상태가 먼저 바뀌는 경우의 수가 많아서입니다.
 * 그 조합을 테스트로 고정해 두고, baduk.ts는 이 판정을 가져다 쓰기만 합니다.
 *
 * 거절만 status를 따지지 않습니다. 신청이 걸린 채로 상대가 착수·기권해서
 * 대국이 끝나 있을 수 있는데, 그때 누른 거절이 에러로 보이면 신청 표시를
 * 치울 방법이 없어지기 때문입니다.
 */
export function checkScoreOffer(
  room: ScoreOfferRoom,
  userId: string,
  action: ScoreOfferAction,
): string | null {
  if (room.blackId !== userId && room.whiteId !== userId) {
    return "참여자만 계가를 신청할 수 있어요.";
  }

  if (action === "decline") {
    if (!room.scoreOfferBy) return "물릴 계가 신청이 없어요.";
    return null;
  }

  if (room.status !== "playing") {
    return action === "offer" ? "대국 중에만 계가를 신청할 수 있어요." : "대국 중이 아니에요.";
  }

  if (action === "offer") {
    if (room.scoreOfferBy === userId) return "이미 계가를 신청했어요.";
    if (room.scoreOfferBy) return "상대가 이미 계가를 신청했어요. 수락하거나 거절해주세요.";
    return null;
  }

  if (!room.scoreOfferBy) return "계가 신청이 없어요.";
  if (room.scoreOfferBy === userId) return "상대의 답을 기다리는 중이에요.";
  return null;
}
