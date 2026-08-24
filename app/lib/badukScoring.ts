// 종국 후 계가(scoring) 순수 함수입니다. 중국식(면적) 계가를 씁니다 —
// 죽은 돌을 제외한 보드에서 빈 칸을 영역별로 나눠 한쪽 색에만 닿아 있으면
// 그 색의 집으로 셉니다. 최종 점수 = 집 + 살아있는 자기 돌 수(백은 덤 추가).

// Node의 네이티브 테스트 러너(node --test)는 확장자 없는 로컬 import를
// 해석하지 못해, badukRules.ts의 getGroup을 그대로 import하는 대신 이
// 파일 안에서 작게 다시 구현합니다(둘 다 테스트 가능한 상태로 유지하기
// 위한 의도적인 중복 — 이 프로젝트의 기존 테스트 대상 lib 파일들도 전부
// 로컬 상호 import가 없는 형태로 맞춰져 있습니다).
import type { Board, Color } from "./badukRules";

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[0].length;
}

function neighborsOf(board: Board, row: number, col: number): [number, number][] {
  return ([[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as [number, number][]).filter(
    ([r, c]) => inBounds(board, r, c),
  );
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function findGroup(board: Board, row: number, col: number): [number, number][] {
  const color = board[row]?.[col];
  if (!color) return [];

  const visited = new Set<string>([key(row, col)]);
  const group: [number, number][] = [];
  const queue: [number, number][] = [[row, col]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    group.push([r, c]);
    for (const [nr, nc] of neighborsOf(board, r, c)) {
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      if (board[nr][nc] === color) {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }
  return group;
}

/** (row,col)이 속한 돌 그룹 전체를 죽음/삶 표시에서 토글합니다. 빈 칸이면
 * 아무 변화 없이 그대로 반환합니다. */
export function toggleDeadGroup(board: Board, deadStones: ReadonlySet<string>, row: number, col: number): Set<string> {
  if (!board[row]?.[col]) return new Set(deadStones);

  const group = findGroup(board, row, col);
  const groupKeys = group.map(([r, c]) => key(r, c));
  const isDead = groupKeys.some((k) => deadStones.has(k));

  const next = new Set(deadStones);
  if (isDead) {
    for (const k of groupKeys) next.delete(k);
  } else {
    for (const k of groupKeys) next.add(k);
  }
  return next;
}

export type ScoreResult = {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
  blackStones: number;
  whiteStones: number;
  winner: Color;
};

export function computeScore(board: Board, deadStones: ReadonlySet<string>, komi: number): ScoreResult {
  const size = board.length;
  const working: Board = board.map((row, r) => row.map((cell, c) => (deadStones.has(key(r, c)) ? null : cell)));

  let blackTerritory = 0;
  let whiteTerritory = 0;
  let blackStones = 0;
  let whiteStones = 0;

  const visited = new Set<string>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = working[r][c];
      if (cell === "black") blackStones += 1;
      else if (cell === "white") whiteStones += 1;

      if (cell !== null) continue;
      const k = key(r, c);
      if (visited.has(k)) continue;

      // 빈 칸으로 이뤄진 연결 영역을 플러드필하며, 그 영역이 맞닿은 돌 색을 모읍니다.
      const region: [number, number][] = [];
      const borderColors = new Set<Color>();
      const queue: [number, number][] = [[r, c]];
      visited.add(k);

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        region.push([cr, cc]);
        for (const [nr, nc] of neighborsOf(working, cr, cc)) {
          const neighborCell = working[nr][nc];
          if (neighborCell === null) {
            const nk = key(nr, nc);
            if (!visited.has(nk)) {
              visited.add(nk);
              queue.push([nr, nc]);
            }
          } else {
            borderColors.add(neighborCell);
          }
        }
      }

      if (borderColors.size === 1) {
        if (borderColors.has("black")) blackTerritory += region.length;
        else whiteTerritory += region.length;
      }
      // borderColors가 0개(전체 빈 보드) 또는 2개(양쪽 다 닿음, 단수/dame)면
      // 어느 쪽 집도 아닙니다.
    }
  }

  const blackScore = blackTerritory + blackStones;
  const whiteScore = whiteTerritory + whiteStones + komi;

  return {
    blackScore,
    whiteScore,
    blackTerritory,
    whiteTerritory,
    blackStones,
    whiteStones,
    winner: blackScore > whiteScore ? "black" : "white",
  };
}
