import test from "node:test";
import assert from "node:assert/strict";
import { countOpenThrees, isForbiddenMove, isOverline, type Stone } from "./omokForbidden.ts";

function emptyBoard(size = 15): Stone[][] {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(null));
}

function place(board: Stone[][], player: Stone, cells: [number, number][]): void {
  for (const [r, c] of cells) board[r][c] = player;
}

test("Test 1: 흑이 정상적인 5목을 만드는 경우 -> 금수 아님", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  board[7][7] = "black"; // 방금 놓은 돌
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
});

test("Test 2: 흑이 6목을 만드는 경우 -> 금수(overline)", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  board[7][7] = "black"; // 방금 놓은 돌, 총 6개 연속
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "overline");
});

test("Test 3: 흑이 7목 이상을 만드는 경우 -> 금수(overline)", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  board[7][7] = "black"; // 총 7개 연속
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "overline");
});

test("Test 4: 흑이 한 번의 착수로 열린 3을 2개 만드는 경우 -> 쌍삼 금수", () => {
  const board = emptyBoard();
  // 가로로 열린 3이 되는 두 점: (7,6)-(7,8), 세로로 열린 3이 되는 두 점: (6,7)-(8,7)
  place(board, "black", [
    [7, 6],
    [7, 8],
    [6, 7],
    [8, 7],
  ]);
  board[7][7] = "black"; // 교차점에 착수 -> 가로 _●●●_, 세로 _●●●_ 동시 생성
  assert.equal(countOpenThrees(board, 7, 7, "black"), 2);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "double-three");
});

test("Test 5: 백이 6목 이상을 만드는 경우 -> 금수 아님", () => {
  const board = emptyBoard();
  place(board, "white", [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  board[7][7] = "white"; // 백 7목
  assert.equal(isOverline(board, 7, 7, "white"), true); // overline 자체는 감지되지만
  const result = isForbiddenMove(board, 7, 7, "white");
  assert.equal(result.forbidden, false); // 백에게는 금수 규칙을 적용하지 않음
});

test("Test 6: 백이 쌍삼 형태를 만드는 경우 -> 금수 아님", () => {
  const board = emptyBoard();
  place(board, "white", [
    [7, 6],
    [7, 8],
    [6, 7],
    [8, 7],
  ]);
  board[7][7] = "white";
  assert.equal(countOpenThrees(board, 7, 7, "white"), 2);
  const result = isForbiddenMove(board, 7, 7, "white");
  assert.equal(result.forbidden, false);
});

test("Test 7: 흑이 열린 3 하나만 만드는 경우 -> 정상 착수", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 6],
    [7, 8],
  ]);
  board[7][7] = "black"; // 가로만 _●●●_, 세로/대각선은 형성 안 됨
  assert.equal(countOpenThrees(board, 7, 7, "black"), 1);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
});

test("Test 8: 3처럼 보이지만 양쪽 끝이 막혀 실제 열린 3이 아닌 경우 -> 쌍삼 아님", () => {
  const board = emptyBoard();
  // 가로: 왼쪽 끝이 백돌로 막힘 (백●●●_ 형태가 아니라, ●(백)●●●_(흑 3개+막힘))
  place(board, "white", [[7, 5]]);
  place(board, "black", [
    [7, 6],
    [7, 8],
  ]);
  // 세로: 위쪽 끝이 백돌로 막힘
  place(board, "white", [[5, 7]]);
  place(board, "black", [
    [6, 7],
    [8, 7],
  ]);
  board[7][7] = "black";
  assert.equal(countOpenThrees(board, 7, 7, "black"), 0);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
});

test("보드 경계에 붙은 3은 바깥쪽이 막힌 것으로 취급해 열린 3이 아니다", () => {
  const board = emptyBoard();
  board[0][0] = "black";
  board[0][1] = "black";
  board[0][2] = "black"; // 방금 착수, 왼쪽은 보드 밖
  const result = isForbiddenMove(board, 0, 2, "black");
  assert.equal(countOpenThrees(board, 0, 2, "black"), 0);
  assert.equal(result.forbidden, false);
});
