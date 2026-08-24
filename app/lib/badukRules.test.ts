import test from "node:test";
import assert from "node:assert/strict";
import { applyMove, createEmptyBoard, getGroup, getLiberties } from "./badukRules.ts";
import type { Board, Color } from "./badukRules.ts";

function makeBoard(size: number, stones: [number, number, Color][]): Board {
  const board = createEmptyBoard(size);
  for (const [r, c, color] of stones) board[r][c] = color;
  return board;
}

test("getGroup: 빈 칸은 빈 그룹", () => {
  const board = createEmptyBoard(5);
  assert.deepEqual(getGroup(board, 2, 2), []);
});

test("getGroup: 혼자 있는 돌은 그룹 크기 1", () => {
  const board = makeBoard(5, [[2, 2, "black"]]);
  assert.deepEqual(getGroup(board, 2, 2).sort(), [[2, 2]]);
});

test("getGroup: 상하좌우로 이어진 동색 돌만 한 그룹", () => {
  const board = makeBoard(5, [
    [2, 2, "black"],
    [2, 3, "black"],
    [1, 2, "black"],
    [2, 1, "white"], // 다른 색은 그룹에 포함되지 않음
  ]);
  const group = getGroup(board, 2, 2).map(([r, c]) => `${r},${c}`).sort();
  assert.deepEqual(group, ["1,2", "2,2", "2,3"]);
});

test("getGroup: 대각선은 연결로 보지 않는다", () => {
  const board = makeBoard(5, [
    [2, 2, "black"],
    [1, 1, "black"], // 대각선, 연결 아님
  ]);
  const group = getGroup(board, 2, 2);
  assert.equal(group.length, 1);
});

test("getLiberties: 가운데 혼자 있는 돌은 활로 4", () => {
  const board = makeBoard(5, [[2, 2, "black"]]);
  assert.equal(getLiberties(board, getGroup(board, 2, 2)), 4);
});

test("getLiberties: 모서리 돌은 활로 2", () => {
  const board = makeBoard(5, [[0, 0, "black"]]);
  assert.equal(getLiberties(board, getGroup(board, 0, 0)), 2);
});

test("getLiberties: 변에 있는 돌은 활로 3", () => {
  const board = makeBoard(5, [[0, 2, "black"]]);
  assert.equal(getLiberties(board, getGroup(board, 0, 2)), 3);
});

test("getLiberties: 두 칸짜리 그룹은 활로를 합쳐서(중복 제거) 센다", () => {
  const board = makeBoard(5, [
    [2, 2, "black"],
    [2, 3, "black"],
  ]);
  // (2,2)의 활로: (1,2),(3,2),(2,1) / (2,3)의 활로: (1,3),(3,3),(2,4) — 서로 안 겹침
  assert.equal(getLiberties(board, getGroup(board, 2, 2)), 6);
});

test("applyMove: 빈 보드에 두면 그냥 놓인다", () => {
  const board = createEmptyBoard(5);
  const result = applyMove(board, 2, 2, "black", null);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.board[2][2], "black");
    assert.deepEqual(result.captured, []);
  }
});

test("applyMove: 이미 돌이 있는 자리엔 못 둔다", () => {
  const board = makeBoard(5, [[2, 2, "black"]]);
  const result = applyMove(board, 2, 2, "white", null);
  assert.equal(result.ok, false);
});

test("applyMove: 활로가 1인 상대 돌을 마지막 활로에 두면 따낸다", () => {
  const board = makeBoard(5, [
    [1, 2, "black"],
    [3, 2, "black"],
    [2, 1, "black"],
    [2, 2, "white"], // (2,3)만 활로로 남은 상태
  ]);
  const result = applyMove(board, 2, 3, "black", null);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.captured.sort(), [[2, 2]]);
    assert.equal(result.board[2][2], null);
    assert.equal(result.board[2][3], "black");
  }
});

test("applyMove: 자충수(상대를 못 따내면서 활로 0)는 거부한다", () => {
  const board = makeBoard(5, [
    [0, 1, "white"],
    [1, 0, "white"],
  ]);
  // (0,1),(1,0) 둘 다 다른 활로가 남아있어 따낼 수 없는데, 흑이 (0,0)에
  // 두면 자기 자신은 활로 0.
  const result = applyMove(board, 0, 0, "black", null);
  assert.equal(result.ok, false);
});

test("applyMove: 상대를 따내서 활로가 생기면 자충수가 아니다", () => {
  const board = makeBoard(5, [
    [1, 1, "black"],
    [3, 1, "black"],
    [2, 0, "black"],
    [2, 1, "white"], // 활로 1개(2,2)만 남은 백돌 — 흑이 두면 따낼 대상
    [1, 2, "white"],
    [3, 2, "white"],
    [2, 3, "white"], // (2,2) 자리를 둘러싸는 백돌들(각자 다른 활로 있음, (2,1)과는 비연결)
  ]);
  const result = applyMove(board, 2, 2, "black", null);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.captured.sort(), [[2, 1]]);
    // 따낸 자리(2,1)가 비어서 (2,2)에 새로 둔 흑돌의 활로가 됨
    assert.equal(getLiberties(result.board, getGroup(result.board, 2, 2)), 1);
  }
});

test("applyMove: 패(단순패) — 직전 상태를 그대로 재현하는 되따냄은 금지", () => {
  const before = makeBoard(5, [
    [1, 2, "black"],
    [3, 2, "black"],
    [2, 1, "black"],
    [2, 2, "white"], // 활로 1개(2,3) — 흑이 여기 두면 따냄
    [1, 3, "white"],
    [3, 3, "white"],
    [2, 4, "white"], // (2,3) 주변을 감싸는 백돌들(각자 다른 활로 보유, 서로 비연결)
  ]);

  const afterBlackCaptures = applyMove(before, 2, 3, "black", null);
  assert.equal(afterBlackCaptures.ok, true);
  if (!afterBlackCaptures.ok) return;
  assert.deepEqual(afterBlackCaptures.captured.sort(), [[2, 2]]);

  // 백이 바로 되따내면(2,2) 원래 상태(before)를 그대로 재현 -> 패 위반
  const recapture = applyMove(afterBlackCaptures.board, 2, 2, "white", before);
  assert.equal(recapture.ok, false);

  // previousBoard를 안 넘기면(패 추적 안 함) 같은 수가 허용된다
  const recaptureWithoutKoCheck = applyMove(afterBlackCaptures.board, 2, 2, "white", null);
  assert.equal(recaptureWithoutKoCheck.ok, true);

  // previousBoard가 다른 상태면 정상적으로 따낼 수 있다
  const unrelated = createEmptyBoard(5);
  const recaptureDifferentPrevious = applyMove(afterBlackCaptures.board, 2, 2, "white", unrelated);
  assert.equal(recaptureDifferentPrevious.ok, true);
});
