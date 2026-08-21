// 흑 전용 금수(禁手) 판정입니다. 렌더링·DB 코드와 완전히 독립된 순수
// 함수 모듈이라 클라이언트(마우스 오버 미리보기)와 서버(app/lib/omok.ts의
// submitMove, 실제 착수 확정 여부를 가르는 지점) 양쪽에서 같은 로직을
// 그대로 재사용합니다.
//
// 계약: 아래 함수들은 모두 "판정하려는 자리에 이미 돌을 놓은 보드"를
// 입력으로 받습니다. 호출하는 쪽에서 임시 보드를 만들어 넘겨주세요.

export type Stone = "black" | "white" | null;
export type ForbiddenReason = "overline" | "double-three" | null;

const AXES: readonly [number, number][] = [
  [0, 1], // 가로
  [1, 0], // 세로
  [1, 1], // 대각선 \
  [1, -1], // 대각선 /
];

const OVERLINE_THRESHOLD = 6;
const OPEN_THREE_LENGTH = 3;

function inBounds(board: Stone[][], row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board.length;
}

function isEmptyCell(board: Stone[][], row: number, col: number): boolean {
  return inBounds(board, row, col) && board[row][col] === null;
}

function isPlayerStone(board: Stone[][], row: number, col: number, player: Stone): boolean {
  return inBounds(board, row, col) && board[row][col] === player;
}

type Run = { length: number; startRow: number; startCol: number; endRow: number; endCol: number };

// (row, col)을 지나는 axis 방향의 연속된 player 돌 구간을 양쪽으로 뻗어가며
// 찾습니다. 착수 지점에서만 출발하므로 보드 전체를 훑지 않습니다.
function runThrough(board: Stone[][], row: number, col: number, player: Stone, dr: number, dc: number): Run {
  let length = 1;
  let startRow = row;
  let startCol = col;
  let endRow = row;
  let endCol = col;

  let r = row - dr;
  let c = col - dc;
  while (isPlayerStone(board, r, c, player)) {
    length += 1;
    startRow = r;
    startCol = c;
    r -= dr;
    c -= dc;
  }

  r = row + dr;
  c = col + dc;
  while (isPlayerStone(board, r, c, player)) {
    length += 1;
    endRow = r;
    endCol = c;
    r += dr;
    c += dc;
  }

  return { length, startRow, startCol, endRow, endCol };
}

/** 해당 착수로 6목 이상(연속)이 만들어지는지 검사합니다. */
export function isOverline(board: Stone[][], row: number, col: number, player: Stone): boolean {
  if (!player) return false;
  for (const [dr, dc] of AXES) {
    if (runThrough(board, row, col, player, dr, dc).length >= OVERLINE_THRESHOLD) return true;
  }
  return false;
}

/**
 * 해당 착수로 새로 만들어진 "열린 3"의 개수를 셉니다. 열린 3은 정확히 3개
 * 연속된 돌이고, 그 구간의 양쪽 바로 바깥 칸이 (보드 안에서) 둘 다 비어
 * 있는 경우만 인정합니다. 한쪽이라도 막혀 있거나 보드 밖이면 열린 3이
 * 아닙니다.
 */
export function countOpenThrees(board: Stone[][], row: number, col: number, player: Stone): number {
  if (!player) return 0;
  let count = 0;
  for (const [dr, dc] of AXES) {
    const run = runThrough(board, row, col, player, dr, dc);
    if (run.length !== OPEN_THREE_LENGTH) continue;

    const beforeRow = run.startRow - dr;
    const beforeCol = run.startCol - dc;
    const afterRow = run.endRow + dr;
    const afterCol = run.endCol + dc;
    if (isEmptyCell(board, beforeRow, beforeCol) && isEmptyCell(board, afterRow, afterCol)) {
      count += 1;
    }
  }
  return count;
}

/**
 * 흑 전용 금수 종합 판정입니다. 백은 항상 금수가 아닙니다(문제의 핵심
 * 요구사항 — player가 black일 때만 실제로 검사가 수행됩니다).
 */
export function isForbiddenMove(
  board: Stone[][],
  row: number,
  col: number,
  player: Stone,
): { forbidden: boolean; reason: ForbiddenReason } {
  if (player !== "black") return { forbidden: false, reason: null };
  if (isOverline(board, row, col, player)) return { forbidden: true, reason: "overline" };
  if (countOpenThrees(board, row, col, player) >= 2) return { forbidden: true, reason: "double-three" };
  return { forbidden: false, reason: null };
}

export const FORBIDDEN_MOVE_MESSAGES: Record<Exclude<ForbiddenReason, null>, string> = {
  overline: "금수입니다. 흑은 6목 이상을 만들 수 없습니다.",
  "double-three": "금수입니다. 흑은 쌍삼을 만들 수 없습니다.",
};
