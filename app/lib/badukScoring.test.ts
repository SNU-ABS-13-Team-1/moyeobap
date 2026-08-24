import test from "node:test";
import assert from "node:assert/strict";
import { computeScore, toggleDeadGroup } from "./badukScoring.ts";
import { createEmptyBoard } from "./badukRules.ts";
import type { Board, Color } from "./badukRules.ts";

const KOMI = 6.5;

function makeBoard(size: number, stones: [number, number, Color][]): Board {
  const board = createEmptyBoard(size);
  for (const [r, c, color] of stones) board[r][c] = color;
  return board;
}

test("computeScore: 빈 보드는 집도 돌도 0, 백은 덤만큼 앞선다", () => {
  const board = createEmptyBoard(5);
  const result = computeScore(board, new Set(), KOMI);
  assert.equal(result.blackScore, 0);
  assert.equal(result.whiteScore, KOMI);
  assert.equal(result.winner, "white");
});

function wallBoard(): Board {
  // 5x5: 1열은 흑 벽, 3열은 백 벽. 0열은 흑 집, 2열은 무효지(dame), 4열은 백 집.
  const stones: [number, number, Color][] = [];
  for (let r = 0; r < 5; r += 1) {
    stones.push([r, 1, "black"]);
    stones.push([r, 3, "white"]);
  }
  return makeBoard(5, stones);
}

test("computeScore: 각 색 벽으로 나뉜 영역은 각자의 집, 양쪽에 닿은 영역은 무효지", () => {
  const board = wallBoard();
  const result = computeScore(board, new Set(), KOMI);

  assert.equal(result.blackStones, 5);
  assert.equal(result.whiteStones, 5);
  assert.equal(result.blackTerritory, 5); // 0열
  assert.equal(result.whiteTerritory, 5); // 4열, 2열(dame)은 어느 쪽도 아님
  assert.equal(result.blackScore, 10);
  assert.equal(result.whiteScore, 5 + 5 + KOMI);
  assert.equal(result.winner, "white"); // 집은 같지만 덤 때문에 백 승
});

test("toggleDeadGroup: 죽은 돌로 표시하면 그 자리가 상대 집처럼 계산된다", () => {
  const board = wallBoard();
  const blackWallGroup = toggleDeadGroup(board, new Set(), 2, 1); // 흑 벽 전체가 한 그룹
  assert.equal(blackWallGroup.size, 5);

  const result = computeScore(board, blackWallGroup, KOMI);
  // 흑 벽이 죽었다고 보면 0,1,2열이 전부 이어진 빈 칸이 되고, 그 영역(15칸)은
  // 오직 백 벽(3열)에만 닿아 있어 백 집이 된다 — 원래부터 백 집이던 4열(5칸)과
  // 합쳐 총 20칸.
  assert.equal(result.blackStones, 0);
  assert.equal(result.blackTerritory, 0);
  assert.equal(result.whiteTerritory, 20);
  assert.equal(result.blackScore, 0);
  assert.equal(result.whiteScore, 20 + 5 + KOMI);
});

test("toggleDeadGroup: 두 번 누르면 원래대로 되돌아온다", () => {
  const board = wallBoard();
  const dead = toggleDeadGroup(board, new Set(), 2, 1);
  const revived = toggleDeadGroup(board, dead, 2, 1);
  assert.equal(revived.size, 0);
});

test("toggleDeadGroup: 빈 칸을 눌러도 아무 변화 없다", () => {
  const board = wallBoard();
  const before = new Set(["0,0"]);
  const after = toggleDeadGroup(board, before, 0, 0); // 0열은 빈 칸
  assert.deepEqual(after, before);
});

test("toggleDeadGroup: 한 그룹의 어느 돌을 눌러도 그룹 전체가 같이 토글된다", () => {
  const board = wallBoard();
  const viaTop = toggleDeadGroup(board, new Set(), 0, 1);
  const viaBottom = toggleDeadGroup(board, new Set(), 4, 1);
  assert.deepEqual([...viaTop].sort(), [...viaBottom].sort());
  assert.equal(viaTop.size, 5);
});
