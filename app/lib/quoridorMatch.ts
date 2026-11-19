// 쿼리도의 "순수 규칙" 모듈입니다. DB·렌더링과 무관한 것만 두어 서버(quoridorRoom/quoridorOnline)와
// 클라이언트(보드 화면)가 같은 규칙을 씁니다. 다른 모듈을 import하지 않습니다.
//
// 좌표: 칸 {r: 0..8, c: 0..8}, 열 a~i(왼→오), 행 1~9(아래→위). "e1" = {r:0, c:4}.
// 벽:  교차점 {r, c ∈ 0..7}과 방향.
//   o:'h' → 행 r과 r+1 사이 홈 중 c열·c+1열 부분을 막음
//   o:'v' → 열 c와 c+1 사이 홈 중 r행·r+1행 부분을 막음
//   표기는 교차점의 왼쪽 아래 칸 + 방향("e3h" = {r:2, c:4, o:'h'}).

export type Cell = { r: number; c: number };
export type Wall = { r: number; c: number; o: 'h' | 'v' };
export type Mode = 2 | 4;
export type Move = { kind: 'pawn'; to: Cell } | { kind: 'wall'; wall: Wall };
/** 자리 번호(seat)로 인덱스. active[seat] === false 면 나간 사람(말은 보드에 남음). */
export type BoardState = { mode: Mode; pawns: Cell[]; walls: Wall[]; wallsLeft: number[]; active: boolean[] };
export type WallCheck =
  | { ok: true }
  | { ok: false; reason: 'no_walls' | 'out_of_range' | 'overlap' | 'cross' }
  | { ok: false; reason: 'blocks_path'; blockedSeats: number[] };

export const BOARD_SIZE = 9;
export const WALLS_PER_PLAYER: Record<Mode, number> = { 2: 10, 4: 5 };
/** 자리 순서(아래 → 왼 → 위 → 오른)가 곧 시계 방향 턴 순서입니다. */
export const START: Record<Mode, Cell[]> = {
  2: [{ r: 0, c: 4 }, { r: 8, c: 4 }],
  4: [{ r: 0, c: 4 }, { r: 4, c: 0 }, { r: 8, c: 4 }, { r: 4, c: 8 }],
};

const COLS = 'abcdefghi';
const LAST = BOARD_SIZE - 1;

export function isGoal(mode: Mode, seat: number, cell: Cell): boolean {
  if (mode === 2) return seat === 0 ? cell.r === LAST : cell.r === 0;
  switch (seat) {
    case 0: return cell.r === LAST;
    case 1: return cell.c === LAST;
    case 2: return cell.r === 0;
    default: return cell.c === 0;
  }
}

export function cellName(cell: Cell): string {
  return `${COLS[cell.c]}${cell.r + 1}`;
}

/** 문법만 봅니다. 벽 교차점 범위(0..7)는 checkWall이 판정합니다. */
export function parseNotation(text: string): Move | null {
  const m = /^([a-i])([1-9])([hv])?$/.exec(text);
  if (!m) return null;
  const c = COLS.indexOf(m[1]);
  const r = Number(m[2]) - 1;
  if (m[3]) return { kind: 'wall', wall: { r, c, o: m[3] as 'h' | 'v' } };
  return { kind: 'pawn', to: { r, c } };
}

export function formatMove(move: Move): string {
  return move.kind === 'pawn' ? cellName(move.to) : `${cellName(move.wall)}${move.wall.o}`;
}

export function initialBoard(mode: Mode): BoardState {
  return {
    mode,
    pawns: START[mode].map((cell) => ({ ...cell })),
    walls: [],
    wallsLeft: START[mode].map(() => WALLS_PER_PLAYER[mode]),
    active: START[mode].map(() => true),
  };
}

/** 인접한 두 칸 사이가 벽으로 막혔는지. 두 칸의 순서는 상관없습니다. */
export function isStepBlocked(walls: Wall[], from: Cell, to: Cell): boolean {
  const [a, b] = from.r < to.r || (from.r === to.r && from.c < to.c) ? [from, to] : [to, from];
  if (a.c === b.c) {
    // 위아래 한 칸: (r,c)↔(r+1,c)
    return walls.some((w) => w.o === 'h' && w.r === a.r && (w.c === a.c || w.c === a.c - 1));
  }
  // 좌우 한 칸: (r,c)↔(r,c+1)
  return walls.some((w) => w.o === 'v' && w.c === a.c && (w.r === a.r || w.r === a.r - 1));
}

export function checkWall(board: BoardState, seat: number, wall: Wall): WallCheck {
  if ((board.wallsLeft[seat] ?? 0) <= 0) return { ok: false, reason: 'no_walls' };
  if (!(wall.r >= 0 && wall.r < LAST && wall.c >= 0 && wall.c < LAST)) return { ok: false, reason: 'out_of_range' };
  const overlaps = board.walls.some((w) =>
    w.o === wall.o && (wall.o === 'h' ? w.r === wall.r && Math.abs(w.c - wall.c) <= 1 : w.c === wall.c && Math.abs(w.r - wall.r) <= 1),
  );
  if (overlaps) return { ok: false, reason: 'overlap' };
  if (board.walls.some((w) => w.o !== wall.o && w.r === wall.r && w.c === wall.c)) return { ok: false, reason: 'cross' };
  // 벽을 놓은 뒤에도 아직 게임 중인 모든 사람이 목표 변까지 갈 길이 있어야 합니다(다른 말은 무시).
  const after = { ...board, walls: [...board.walls, wall] };
  const blockedSeats = board.active.flatMap((active, s) => (active && !hasPath(after, s) ? [s] : []));
  if (blockedSeats.length > 0) return { ok: false, reason: 'blocks_path', blockedSeats };
  return { ok: true };
}

const DIRS: Cell[] = [{ r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 }];

function onBoard(cell: Cell): boolean {
  return cell.r >= 0 && cell.r < BOARD_SIZE && cell.c >= 0 && cell.c < BOARD_SIZE;
}

function occupied(board: BoardState, cell: Cell): boolean {
  // 나간 사람의 말도 보드에 남아 장애물이 됩니다.
  return board.pawns.some((p) => p.r === cell.r && p.c === cell.c);
}

/** seat의 말이 이번 턴에 갈 수 있는 칸. 점프는 말 하나만, 뒤가 막혔을 때만 좌우로 비껴갑니다. */
export function legalPawnMoves(board: BoardState, seat: number): Cell[] {
  const from = board.pawns[seat];
  if (!from) return [];
  const result: Cell[] = [];
  const add = (cell: Cell) => {
    if (!result.some((x) => x.r === cell.r && x.c === cell.c)) result.push(cell);
  };
  // 그 칸이 보드 안이고, 비어 있고, 벽 없이 갈 수 있는지
  const open = (a: Cell, b: Cell) => onBoard(b) && !occupied(board, b) && !isStepBlocked(board.walls, a, b);

  for (const d of DIRS) {
    const next = { r: from.r + d.r, c: from.c + d.c };
    if (!onBoard(next) || isStepBlocked(board.walls, from, next)) continue;
    if (!occupied(board, next)) {
      add(next);
      continue;
    }
    const behind = { r: next.r + d.r, c: next.c + d.c };
    if (open(next, behind)) {
      add(behind);
      continue;
    }
    // 뒤가 벽·다른 말·보드 밖이면 넘을 말의 좌우(진행 방향에 직각)로 비껴갑니다.
    const sides: Cell[] = d.r !== 0 ? [{ r: 0, c: -1 }, { r: 0, c: 1 }] : [{ r: -1, c: 0 }, { r: 1, c: 0 }];
    for (const s of sides) {
      const side = { r: next.r + s.r, c: next.c + s.c };
      if (open(next, side)) add(side);
    }
  }
  return result;
}

/** 벽만 보고(말 무시) seat의 현재 위치에서 목표 변까지 길이 있는지. 칸이 81개뿐이라 BFS 그대로. */
export function hasPath(board: BoardState, seat: number): boolean {
  const start = board.pawns[seat];
  if (!start) return false;
  const seen = new Set<number>([start.r * BOARD_SIZE + start.c]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (isGoal(board.mode, seat, cell)) return true;
    for (const d of DIRS) {
      const next = { r: cell.r + d.r, c: cell.c + d.c };
      const id = next.r * BOARD_SIZE + next.c;
      if (!onBoard(next) || seen.has(id) || isStepBlocked(board.walls, cell, next)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
}

export type ApplyResult = { ok: true; board: BoardState; won: boolean } | { ok: false; reason: string };

/** 수를 검증하고 적용한 새 보드를 돌려줍니다(입력은 바꾸지 않음). */
export function applyMove(board: BoardState, seat: number, move: Move): ApplyResult {
  if (move.kind === 'pawn') {
    const legal = legalPawnMoves(board, seat).some((c) => c.r === move.to.r && c.c === move.to.c);
    if (!legal) return { ok: false, reason: 'illegal_pawn' };
    const pawns = board.pawns.map((p, i) => (i === seat ? { ...move.to } : p));
    return { ok: true, board: { ...board, pawns }, won: isGoal(board.mode, seat, move.to) };
  }
  const check = checkWall(board, seat, move.wall);
  if (!check.ok) return { ok: false, reason: check.reason };
  return {
    ok: true,
    board: {
      ...board,
      walls: [...board.walls, { ...move.wall }],
      wallsLeft: board.wallsLeft.map((n, i) => (i === seat ? n - 1 : n)),
    },
    won: false,
  };
}

/** 말 이동이 하나라도 있거나, 남은 벽으로 놓을 수 있는 자리가 하나라도 있는지. */
export function hasAnyLegalMove(board: BoardState, seat: number): boolean {
  if (legalPawnMoves(board, seat).length > 0) return true;
  if ((board.wallsLeft[seat] ?? 0) <= 0) return false;
  for (const o of ['h', 'v'] as const) {
    for (let r = 0; r < LAST; r += 1) {
      for (let c = 0; c < LAST; c += 1) {
        if (checkWall(board, seat, { r, c, o }).ok) return true;
      }
    }
  }
  return false;
}
