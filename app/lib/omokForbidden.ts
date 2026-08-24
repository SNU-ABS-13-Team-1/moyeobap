// 흑 전용 금수(禁手) 판정입니다. 렌더링·DB 코드와 완전히 독립된 순수
// 함수 모듈이라 클라이언트(마우스 오버 미리보기)와 서버(app/lib/omok.ts의
// submitMove, 실제 착수 확정 여부를 가르는 지점) 양쪽에서 같은 로직을
// 그대로 재사용합니다.
//
// 규칙은 렌주(Renju) 정식 규칙을 따릅니다. 흑에게만 세 가지 금수가 있습니다.
//   - 장목(overline): 6목 이상 연속
//   - 사사(double-four): 한 수로 "4"가 둘 이상
//   - 삼삼(double-three): 한 수로 "3"이 둘 이상
// 그리고 정확히 5목이 되는 수는 위 모양이 같이 생기더라도 승리가 우선이라
// 금수가 아닙니다(오목 우선).
//
// 렌주에서 말하는 "4"와 "3"은 눈에 보이는 돌 개수가 아니라 뻗을 수 있는
// 모양으로 정의합니다.
//   - 4  = 한 수 더 두면 정확히 5목이 되는 모양. ●●●_● 처럼 떨어져 있어도 4다.
//   - 3  = 한 수 더 두면 활사(양쪽이 열린 4연속)가 되는 모양. ●●_● 같은
//          뛰어넘은 3도 3이고, 활사로 뻗지 못하는 막힌 3은 3이 아니다.
// 또한 3 판정은 재귀적입니다. 활사로 뻗을 자리가 흑에게 금수라면 실제로는
// 활사를 만들 수 없으므로 그 모양은 3으로 세지 않습니다.
//
// 계약: 아래 함수들은 모두 "판정하려는 자리에 이미 돌을 놓은 보드"를
// 입력으로 받습니다. 호출하는 쪽에서 임시 보드를 만들어 넘겨주세요.
// (내부에서 가정 수를 놓아 보지만, 반환 전에 항상 원래대로 되돌립니다.)

export type Stone = "black" | "white" | null;
export type ForbiddenReason = "overline" | "double-four" | "double-three" | null;

const AXES: readonly [number, number][] = [
  [0, 1], // 가로
  [1, 0], // 세로
  [1, 1], // 대각선 \
  [1, -1], // 대각선 /
];

const OVERLINE_THRESHOLD = 6;
const FIVE_LENGTH = 5;
const FOUR_LENGTH = 4;

// 재귀 판정 깊이 제한입니다. 실제 대국에서 2단계를 넘어가는 모양은 거의
// 나오지 않지만, 서로 물고 무는 모양에서 무한 재귀가 나지 않도록 막습니다.
// 한계에 닿으면 "금수가 아니다"로 봅니다(착수를 부당하게 막지 않는 쪽).
const MAX_NESTED_DEPTH = 4;

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

/** 연속 구간 안에 (row, col)이 포함되는지 봅니다. */
function runIncludes(run: Run, row: number, col: number, dr: number, dc: number): boolean {
  let r = run.startRow;
  let c = run.startCol;
  for (let i = 0; i < run.length; i += 1) {
    if (r === row && c === col) return true;
    r += dr;
    c += dc;
  }
  return false;
}

/**
 * (row, col)이 속한 dr/dc 방향 줄에서, 한 수 더 두면 (row, col)을 포함한
 * 정확히 5목이 완성되는 빈 자리들을 모읍니다. 이 자리 개수가 곧 그 방향의
 * "4"를 세는 근거입니다. 6목이 되는 자리는 5가 아니므로 세지 않습니다.
 */
function fiveMakingPoints(
  board: Stone[][],
  row: number,
  col: number,
  player: Stone,
  dr: number,
  dc: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let step = -FOUR_LENGTH; step <= FOUR_LENGTH; step += 1) {
    if (step === 0) continue;
    const r = row + dr * step;
    const c = col + dc * step;
    if (!isEmptyCell(board, r, c)) continue;

    board[r][c] = player;
    const run = runThrough(board, r, c, player, dr, dc);
    const completesFive = run.length === FIVE_LENGTH && runIncludes(run, row, col, dr, dc);
    board[r][c] = null;

    if (completesFive) points.push([r, c]);
  }
  return points;
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
 * 해당 착수로 정확히 5목이 만들어지는지 검사합니다. 6목 이상은 별개의
 * 금수라 여기서는 5로 세지 않습니다(그쪽은 isOverline이 먼저 잡습니다).
 */
export function makesFive(board: Stone[][], row: number, col: number, player: Stone): boolean {
  if (!player) return false;
  for (const [dr, dc] of AXES) {
    if (runThrough(board, row, col, player, dr, dc).length === FIVE_LENGTH) return true;
  }
  return false;
}

/**
 * 해당 착수로 만들어진 "4"의 개수를 셉니다.
 *
 * 한 방향에서 5를 만드는 자리가 둘이면 보통 4가 둘입니다(●_●●●_● 처럼
 * 서로 다른 4 두 개). 다만 활사(_●●●●_)는 5를 만드는 자리가 양쪽 둘이어도
 * 4 하나로 셉니다. 활사는 렌주에서 흑의 정상적인 최강수라, 이걸 사사로
 * 막으면 규칙이 뒤집힙니다.
 */
export function countFours(board: Stone[][], row: number, col: number, player: Stone): number {
  if (!player) return 0;
  let total = 0;
  for (const [dr, dc] of AXES) {
    const points = fiveMakingPoints(board, row, col, player, dr, dc);
    if (points.length === 0) continue;
    const run = runThrough(board, row, col, player, dr, dc);
    const isStraightFour = points.length === 2 && run.length === FOUR_LENGTH;
    total += isStraightFour ? 1 : points.length;
  }
  return total;
}

/** (row, col)에 방금 놓은 돌이 그 방향에서 활사(양쪽이 열린 4연속)를 이루는지. */
function formsStraightFour(
  board: Stone[][],
  row: number,
  col: number,
  player: Stone,
  dr: number,
  dc: number,
): boolean {
  const run = runThrough(board, row, col, player, dr, dc);
  if (run.length !== FOUR_LENGTH) return false;
  // 양쪽 끝 바깥이 모두 비어 있고, 어느 쪽으로 뻗어도 6목이 아니라 정확히
  // 5목이 되어야 진짜 활사입니다(_●●●●_● 같은 모양은 한쪽이 6목이라 제외).
  return fiveMakingPoints(board, row, col, player, dr, dc).length === 2;
}

/**
 * 해당 착수로 만들어진 "3"의 개수를 셉니다. 3은 한 수 더 두어 활사가 될 수
 * 있는 모양이고, 그 한 수를 실제로 둘 수 있어야 합니다. 그래서 뻗을 자리가
 * 흑에게 금수라면 3으로 세지 않습니다(재귀 판정).
 */
export function countThrees(board: Stone[][], row: number, col: number, player: Stone, depth = 0): number {
  if (!player) return 0;
  let total = 0;

  for (const [dr, dc] of AXES) {
    // 이미 4(또는 5·장목)인 방향은 3으로 세지 않습니다.
    if (runThrough(board, row, col, player, dr, dc).length >= FIVE_LENGTH) continue;
    if (fiveMakingPoints(board, row, col, player, dr, dc).length > 0) continue;

    for (let step = -FOUR_LENGTH; step <= FOUR_LENGTH; step += 1) {
      if (step === 0) continue;
      const r = row + dr * step;
      const c = col + dc * step;
      if (!isEmptyCell(board, r, c)) continue;

      board[r][c] = player;
      const straight =
        formsStraightFour(board, r, c, player, dr, dc) &&
        runIncludes(runThrough(board, r, c, player, dr, dc), row, col, dr, dc);
      // 뻗을 자리가 흑에게 금수면 그 활사는 실제로 만들 수 없습니다.
      const reachable =
        straight && (player !== "black" || !forbiddenState(board, r, c, player, depth + 1).forbidden);
      board[r][c] = null;

      if (reachable) {
        total += 1;
        break; // 한 방향은 3 하나로만 셉니다.
      }
    }
  }

  return total;
}

function forbiddenState(
  board: Stone[][],
  row: number,
  col: number,
  player: Stone,
  depth: number,
): { forbidden: boolean; reason: ForbiddenReason } {
  if (player !== "black") return { forbidden: false, reason: null };

  // 판정 순서가 곧 렌주 룰의 우선순위입니다.
  // 1) 정확히 5목이면 그 수로 승부가 나므로, 장목·사사·삼삼 모양이 같이
  //    생겨도 금수가 아닙니다(오목 우선).
  if (makesFive(board, row, col, player)) return { forbidden: false, reason: null };
  // 2) 6목 이상은 5목이 아니므로 금수입니다.
  if (isOverline(board, row, col, player)) return { forbidden: true, reason: "overline" };
  // 3) 4가 둘 이상이면 사사 금수입니다.
  if (countFours(board, row, col, player) >= 2) return { forbidden: true, reason: "double-four" };
  // 4) 3이 둘 이상이면 삼삼 금수입니다. 여기서만 재귀가 일어나므로 깊이가
  //    한계에 닿으면 더 파고들지 않고 금수가 아닌 것으로 봅니다.
  if (depth >= MAX_NESTED_DEPTH) return { forbidden: false, reason: null };
  if (countThrees(board, row, col, player, depth) >= 2) return { forbidden: true, reason: "double-three" };

  return { forbidden: false, reason: null };
}

/**
 * 흑 전용 금수 종합 판정입니다. 백은 항상 금수가 아닙니다(장목·사사·삼삼
 * 모두 백에게는 허용됩니다).
 */
export function isForbiddenMove(
  board: Stone[][],
  row: number,
  col: number,
  player: Stone,
): { forbidden: boolean; reason: ForbiddenReason } {
  return forbiddenState(board, row, col, player, 0);
}

export const FORBIDDEN_MOVE_MESSAGES: Record<Exclude<ForbiddenReason, null>, string> = {
  overline: "금수입니다. 흑은 6목 이상(장목)을 만들 수 없습니다.",
  "double-four": "금수입니다. 흑은 사사(4가 둘)를 만들 수 없습니다.",
  "double-three": "금수입니다. 흑은 삼삼(3이 둘)을 만들 수 없습니다.",
};
