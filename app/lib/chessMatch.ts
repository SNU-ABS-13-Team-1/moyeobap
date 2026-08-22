import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

// 체스 실시간 대전의 "순수 규칙" 모듈입니다. DB·렌더링과 독립된 함수만 두어
// 서버(착수 검증·시간 초과 확정)와 클라이언트(합법수 표시·카운트다운)가 같은
// 로직을 그대로 씁니다. 오목의 omokMatch.ts와 같은 역할입니다.

export type ChessColor = "white" | "black";
export type ChessWinner = ChessColor | "draw" | null;
export type ChessEndReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "insufficient"
  | "fifty_move"
  | "resign"
  | "timeout"
  | "disconnect"
  | "agreement"
  | null;

export const END_REASON_LABEL: Record<NonNullable<ChessEndReason>, string> = {
  checkmate: "체크메이트",
  stalemate: "스테일메이트",
  threefold: "같은 국면 3회 반복",
  insufficient: "기물 부족",
  fifty_move: "50수 규칙",
  resign: "기권",
  timeout: "시간 초과",
  disconnect: "연결 끊김(몰수)",
  agreement: "합의 무승부",
};

/**
 * 시간제. move60 = 한 수마다 60초, totalN = 각자 N분 총 시간제(수를 둘 때마다 내
 * 시간이 줄어듦), none = 제한 없음. 방을 만들 때 고릅니다.
 */
export type TimeControl = "move60" | "total5" | "total10" | "total15" | "none";

export const TIME_CONTROL_OPTIONS: TimeControl[] = ["move60", "total5", "total10", "total15", "none"];

export const TIME_CONTROL_LABEL: Record<TimeControl, string> = {
  move60: "한 수 60초",
  total5: "각자 5분",
  total10: "각자 10분",
  total15: "각자 15분",
  none: "시간 제한 없음",
};

export function isTimeControl(value: unknown): value is TimeControl {
  return typeof value === "string" && (TIME_CONTROL_OPTIONS as string[]).includes(value);
}

export const MOVE_LIMIT_MS = 60_000;
export const TURN_GRACE_MS = 2_000;

/** 총 시간제의 시작 잔여 시간(ms). 총 시간제가 아니면 null. */
export function initialBankMs(timeControl: TimeControl): number | null {
  switch (timeControl) {
    case "total5":
      return 5 * 60_000;
    case "total10":
      return 10 * 60_000;
    case "total15":
      return 15 * 60_000;
    default:
      return null;
  }
}

export type ClockState = {
  timeControl: TimeControl;
  turn: Color;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  turnStartedAt: string | null;
};

export function colorToTurn(color: ChessColor): Color {
  return color === "white" ? "w" : "b";
}

export function turnToColor(turn: Color): ChessColor {
  return turn === "w" ? "white" : "black";
}

export function opposite(color: ChessColor): ChessColor {
  return color === "white" ? "black" : "white";
}

/** 저장된 수순(SAN 배열)을 처음부터 다시 두어 현재 국면을 만듭니다. 3회 반복 같은 이력 기반 판정에 필요합니다. */
export function replayGame(moves: string[]): Chess | null {
  const game = new Chess();
  for (const san of moves) {
    try {
      game.move(san);
    } catch {
      return null;
    }
  }
  return game;
}

export type ApplyMoveResult =
  | {
      ok: true;
      san: string;
      fen: string;
      moves: string[];
      turn: Color;
      from: Square;
      to: Square;
      finished: boolean;
      winner: ChessWinner;
      endReason: ChessEndReason;
    }
  | { ok: false; error: string };

/**
 * 수를 적용해 봅니다. 규칙에 맞지 않으면 error, 맞으면 새 국면과 종료 여부를
 * 돌려줍니다. 서버가 DB에 쓰기 전에 이 결과만 믿습니다.
 */
export function applyChessMove(
  moves: string[],
  mover: ChessColor,
  from: string,
  to: string,
  promotion?: string,
): ApplyMoveResult {
  const game = replayGame(moves);
  if (!game) return { ok: false, error: "저장된 수순이 손상됐어요." };
  if (game.isGameOver()) return { ok: false, error: "이미 끝난 대국이에요." };
  if (game.turn() !== colorToTurn(mover)) return { ok: false, error: "상대 차례예요." };

  const promo: PieceSymbol | undefined =
    promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined;

  let moved;
  try {
    moved = game.move({ from: from as Square, to: to as Square, promotion: promo ?? "q" });
  } catch {
    return { ok: false, error: "둘 수 없는 수예요." };
  }
  if (!moved) return { ok: false, error: "둘 수 없는 수예요." };

  let winner: ChessWinner = null;
  let endReason: ChessEndReason = null;
  if (game.isCheckmate()) {
    winner = mover;
    endReason = "checkmate";
  } else if (game.isStalemate()) {
    winner = "draw";
    endReason = "stalemate";
  } else if (game.isThreefoldRepetition()) {
    winner = "draw";
    endReason = "threefold";
  } else if (game.isInsufficientMaterial()) {
    winner = "draw";
    endReason = "insufficient";
  } else if (game.isDraw()) {
    winner = "draw";
    endReason = "fifty_move";
  }

  return {
    ok: true,
    san: moved.san,
    fen: game.fen(),
    moves: [...moves, moved.san],
    turn: game.turn(),
    from: moved.from,
    to: moved.to,
    finished: winner !== null,
    winner,
    endReason,
  };
}

function startedAtMs(turnStartedAt: string | null): number | null {
  if (!turnStartedAt) return null;
  const parsed = Date.parse(turnStartedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

function elapsedMs(state: ClockState, now: number): number {
  const started = startedAtMs(state.turnStartedAt);
  if (started === null) return 0;
  return Math.max(0, now - started);
}

/**
 * `color` 쪽의 남은 시간(ms). 제한이 없으면 null. 총 시간제에서는 지금 둘
 * 차례인 쪽만 시간이 줄어들고, 상대의 시간은 멈춰 있습니다.
 */
export function remainingMsFor(state: ClockState, color: Color, now: number): number | null {
  if (state.timeControl === "none") return null;
  const ticking = state.turn === color;
  const elapsed = ticking ? elapsedMs(state, now) : 0;

  if (state.timeControl === "move60") {
    return ticking ? Math.max(0, MOVE_LIMIT_MS - elapsed) : MOVE_LIMIT_MS;
  }

  const bank = color === "w" ? state.whiteTimeMs : state.blackTimeMs;
  if (bank === null) return null;
  return Math.max(0, bank - elapsed);
}

/**
 * 지금 둘 차례인 쪽이 시간 초과인지. 서버가 DB 값으로 다시 판정하는 지점이라
 * 클라이언트가 빨리 호출해도 실제로 시간이 지나지 않았으면 false입니다.
 */
export function isClockExpired(state: ClockState, now: number): boolean {
  if (state.timeControl === "none") return false;
  if (startedAtMs(state.turnStartedAt) === null) return false;
  const elapsed = elapsedMs(state, now);
  if (state.timeControl === "move60") return elapsed >= MOVE_LIMIT_MS + TURN_GRACE_MS;
  const bank = state.turn === "w" ? state.whiteTimeMs : state.blackTimeMs;
  if (bank === null) return false;
  return elapsed >= bank + TURN_GRACE_MS;
}

/** 수를 둔 직후 양쪽 잔여 시간(총 시간제만 줄어듦). */
export function banksAfterMove(state: ClockState, now: number): { white_time_ms: number | null; black_time_ms: number | null } {
  if (initialBankMs(state.timeControl) === null) return { white_time_ms: null, black_time_ms: null };
  const elapsed = elapsedMs(state, now);
  const white = state.whiteTimeMs ?? 0;
  const black = state.blackTimeMs ?? 0;
  return state.turn === "w"
    ? { white_time_ms: Math.max(0, white - elapsed), black_time_ms: black }
    : { white_time_ms: white, black_time_ms: Math.max(0, black - elapsed) };
}

/** 재대국 때 백/흑을 통째로 맞바꾼 DB 컬럼 값. */
export function swappedColors(room: {
  whiteId: string;
  whiteName: string;
  blackId: string | null;
  blackName: string | null;
}): { white_id: string; white_name: string; black_id: string; black_name: string } {
  if (!room.blackId || !room.blackName) {
    throw new Error("상대가 없는 방은 백흑을 교대할 수 없습니다.");
  }
  return {
    white_id: room.blackId,
    white_name: room.blackName,
    black_id: room.whiteId,
    black_name: room.whiteName,
  };
}
