// 바둑의 "순수 규칙" 모듈입니다. DB·렌더링과 독립된 함수만 두어 서버(착수
// 검증)와 클라이언트(합법수 미리보기)가 같은 코드를 씁니다. chess.js 같은
// 기성 라이브러리가 없어 활로/따내기/자충수/패 판정을 직접 구현합니다.

export type Stone = "black" | "white" | null;
export type Board = Stone[][];
export type Color = "black" | "white";

export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(null));
}

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[0].length;
}

function neighborsOf(board: Board, row: number, col: number): [number, number][] {
  return ([[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as [number, number][]).filter(
    ([r, c]) => inBounds(board, r, c),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function boardsEqual(a: Board, b: Board): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r += 1) {
    for (let c = 0; c < a[r].length; c += 1) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/** (row,col)이 속한 동색 연결 그룹을 BFS로 찾습니다. 빈 칸이면 빈 배열. */
export function getGroup(board: Board, row: number, col: number): [number, number][] {
  const color = board[row]?.[col];
  if (!color) return [];

  const visited = new Set<string>();
  const group: [number, number][] = [];
  const queue: [number, number][] = [[row, col]];
  visited.add(`${row},${col}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    group.push([r, c]);
    for (const [nr, nc] of neighborsOf(board, r, c)) {
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (board[nr][nc] === color) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return group;
}

/** 그룹에 인접한 서로 다른 빈 칸의 개수(활로). */
export function getLiberties(board: Board, group: [number, number][]): number {
  const liberties = new Set<string>();
  for (const [r, c] of group) {
    for (const [nr, nc] of neighborsOf(board, r, c)) {
      if (board[nr][nc] === null) liberties.add(`${nr},${nc}`);
    }
  }
  return liberties.size;
}

export type MoveResult =
  | { ok: true; board: Board; captured: [number, number][] }
  | { ok: false; error: string };

/** (row,col)에 color 돌을 놓습니다. 상대 그룹의 활로를 먼저 확인해 0이면
 * 따내고, 그 다음 내 그룹의 활로가 0이면 자충수로 거부합니다. previousBoard가
 * 주어지면(직전 내 차례가 시작되기 전 보드) 결과가 그것과 완전히 같을 때
 * 패(단순패) 위반으로 거부합니다. */
export function applyMove(board: Board, row: number, col: number, color: Color, previousBoard: Board | null): MoveResult {
  if (!inBounds(board, row, col)) return { ok: false, error: "보드 범위를 벗어난 자리예요." };
  if (board[row][col] !== null) return { ok: false, error: "이미 돌이 있는 자리예요." };

  const next = cloneBoard(board);
  next[row][col] = color;

  const opponent: Color = color === "black" ? "white" : "black";
  const captured: [number, number][] = [];
  const checkedOpponentCells = new Set<string>();

  for (const [nr, nc] of neighborsOf(next, row, col)) {
    if (next[nr][nc] !== opponent) continue;
    const key = `${nr},${nc}`;
    if (checkedOpponentCells.has(key)) continue;

    const group = getGroup(next, nr, nc);
    for (const [gr, gc] of group) checkedOpponentCells.add(`${gr},${gc}`);

    if (getLiberties(next, group) === 0) {
      for (const [gr, gc] of group) {
        next[gr][gc] = null;
        captured.push([gr, gc]);
      }
    }
  }

  const myGroup = getGroup(next, row, col);
  if (getLiberties(next, myGroup) === 0) {
    return { ok: false, error: "자충수예요. 그 자리엔 둘 수 없어요." };
  }

  if (previousBoard && boardsEqual(next, previousBoard)) {
    return { ok: false, error: "패 규칙 위반이에요. 다른 곳에 먼저 두세요." };
  }

  return { ok: true, board: next, captured };
}
