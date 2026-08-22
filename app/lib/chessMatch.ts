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
};

/** 한 수에 주어지는 시간. 오목(30초)보다 생각할 게 많아 60초로 둡니다. */
export const CHESS_TURN_LIMIT_MS = 60_000;
export const TURN_GRACE_MS = 2_000;

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

export function isTurnExpired(turnStartedAt: string | null, now: number): boolean {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return false;
  return now - started >= CHESS_TURN_LIMIT_MS + TURN_GRACE_MS;
}

export function remainingTurnMs(turnStartedAt: string | null, now: number): number {
  const started = startedAtMs(turnStartedAt);
  if (started === null) return CHESS_TURN_LIMIT_MS;
  const elapsed = now - started;
  if (elapsed <= 0) return CHESS_TURN_LIMIT_MS;
  if (elapsed >= CHESS_TURN_LIMIT_MS) return 0;
  return CHESS_TURN_LIMIT_MS - elapsed;
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
