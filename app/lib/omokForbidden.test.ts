import test from "node:test";
import assert from "node:assert/strict";
import {
  countFours,
  countThrees,
  isForbiddenMove,
  isOverline,
  makesFive,
  type Stone,
} from "./omokForbidden.ts";

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
  assert.equal(countThrees(board, 7, 7, "black"), 2);
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
  assert.equal(countThrees(board, 7, 7, "white"), 2);
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
  assert.equal(countThrees(board, 7, 7, "black"), 1);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
});

test("Test 8: 3처럼 보이지만 활사로 뻗지 못하는 막힌 3은 3이 아니다", () => {
  const board = emptyBoard();
  // 가로: 왼쪽 끝이 백돌로 막힘 -> 4로 뻗어도 한쪽이 막힌 4(충사)라 활사가 안 됨
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
  assert.equal(countThrees(board, 7, 7, "black"), 0);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
});

test("보드 경계에 붙은 3은 바깥쪽이 막힌 것으로 취급해 3이 아니다", () => {
  const board = emptyBoard();
  board[0][0] = "black";
  board[0][1] = "black";
  board[0][2] = "black"; // 방금 착수, 왼쪽은 보드 밖
  const result = isForbiddenMove(board, 0, 2, "black");
  assert.equal(countThrees(board, 0, 2, "black"), 0);
  assert.equal(result.forbidden, false);
});

test("5목을 완성하는 수는 쌍삼 모양이 같이 생겨도 금수가 아니다", () => {
  const board = emptyBoard();
  // 가로: (7,3)~(7,6) + 착수 -> 정확히 5목
  place(board, "black", [
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  // 세로/대각선 \ 은 착수와 함께 각각 열린 3이 됨
  place(board, "black", [
    [6, 7],
    [8, 7],
    [6, 6],
    [8, 8],
  ]);
  board[7][7] = "black";
  assert.equal(countThrees(board, 7, 7, "black"), 2); // 쌍삼 모양은 실제로 성립하지만
  assert.equal(makesFive(board, 7, 7, "black"), true);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false); // 5목 승리가 우선
  assert.equal(result.reason, null);
});

test("6목은 5목을 품고 있어도 여전히 금수다", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  place(board, "black", [
    [6, 7],
    [8, 7],
    [6, 6],
    [8, 8],
  ]);
  board[7][7] = "black"; // 가로 6목 + 쌍삼 모양
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "overline");
});

// ─────────────────────────────────────────────────────────────
// 여기부터 렌주 정식 규칙(장목·사사·삼삼, 재귀 판정) 관련 검증
// ─────────────────────────────────────────────────────────────

test("뛰어넘은 3(●●·●)도 3으로 센다 -> 다른 3과 겹치면 삼삼 금수", () => {
  const board = emptyBoard();
  // 가로 (7,5)(7,6) + 착수(7,8) -> ●●_● : (7,7)에 두면 _●●●●_ 활사
  place(board, "black", [
    [7, 5],
    [7, 6],
  ]);
  // 세로는 평범한 열린 3
  place(board, "black", [
    [6, 8],
    [8, 8],
  ]);
  board[7][8] = "black";
  assert.equal(countThrees(board, 7, 8, "black"), 2);
  const result = isForbiddenMove(board, 7, 8, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "double-three");
});

test("뛰어넘은 3이 하나뿐이면 둘 수 있다", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 5],
    [7, 6],
  ]);
  board[7][8] = "black";
  assert.equal(countThrees(board, 7, 8, "black"), 1);
  assert.equal(isForbiddenMove(board, 7, 8, "black").forbidden, false);
});

test("두 방향으로 4를 동시에 만들면 사사 금수", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 4],
    [7, 5],
    [7, 6], // 가로 3개 + 착수 -> 4
    [4, 7],
    [5, 7],
    [6, 7], // 세로 3개 + 착수 -> 4
  ]);
  board[7][7] = "black";
  assert.equal(makesFive(board, 7, 7, "black"), false);
  assert.equal(countFours(board, 7, 7, "black"), 2);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "double-four");
});

test("한 줄 안에서 4가 두 개 생기는 ●_●●●_● 도 사사 금수", () => {
  const board = emptyBoard();
  // 착수 후 가로: (7,3)● (7,4)_ (7,5)● (7,6)● (7,7)●착수 (7,8)_ (7,9)●
  place(board, "black", [
    [7, 3],
    [7, 5],
    [7, 6],
    [7, 9],
  ]);
  board[7][7] = "black";
  assert.equal(countFours(board, 7, 7, "black"), 2); // (7,4)와 (7,8) 둘 다 5를 만든다
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "double-four");
});

test("활사(_●●●●_)는 5를 만드는 자리가 둘이어도 4 하나로 세어 금수가 아니다", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  board[7][7] = "black"; // _●●●●_
  assert.equal(countFours(board, 7, 7, "black"), 1);
  assert.equal(isForbiddenMove(board, 7, 7, "black").forbidden, false);
});

test("5목을 완성하는 수는 사사 모양이 같이 생겨도 금수가 아니다", () => {
  const board = emptyBoard();
  // 가로: 정확히 5목
  place(board, "black", [
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ]);
  // 세로: 착수와 함께 4가 됨
  place(board, "black", [
    [4, 7],
    [5, 7],
    [6, 7],
  ]);
  // 대각선 \: 착수와 함께 4가 됨
  place(board, "black", [
    [4, 4],
    [5, 5],
    [6, 6],
  ]);
  board[7][7] = "black";
  assert.equal(makesFive(board, 7, 7, "black"), true);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, false);
  assert.equal(result.reason, null);
});

test("4는 3으로 세지 않는다 - 한 방향 4 + 한 방향 3은 금수가 아니다", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 4],
    [7, 5],
    [7, 6], // 가로 4
    [6, 7],
    [8, 7], // 세로 열린 3
  ]);
  board[7][7] = "black";
  assert.equal(countFours(board, 7, 7, "black"), 1);
  assert.equal(countThrees(board, 7, 7, "black"), 1);
  assert.equal(isForbiddenMove(board, 7, 7, "black").forbidden, false);
});

test("활사 자리가 그 자체로 금수(사사)면 그 방향은 3으로 세지 않는다 - 재귀 판정", () => {
  const board = emptyBoard();
  // 가로: (7,6)● (7,7)●착수 (7,9)● -> (7,8)에 두어야만 활사가 된다
  place(board, "black", [
    [7, 6],
    [7, 9],
  ]);
  // 세로: 열린 3
  place(board, "black", [
    [6, 7],
    [8, 7],
  ]);
  // (7,8)을 사사 자리로 만든다: 8열 세로에 (4,8)(5,8)(6,8) -> (7,8)이면 세로도 활사
  place(board, "black", [
    [4, 8],
    [5, 8],
    [6, 8],
  ]);
  board[7][7] = "black";

  // (7,8)은 가로 활사 + 세로 활사 = 사사라 흑이 둘 수 없는 자리다
  const probe = board.map((r) => [...r]);
  probe[7][8] = "black";
  const probeResult = isForbiddenMove(probe, 7, 8, "black");
  assert.equal(probeResult.forbidden, true);
  assert.equal(probeResult.reason, "double-four");

  // 따라서 가로는 3이 아니고, 세로 3 하나만 남아 착수는 허용된다
  assert.equal(countThrees(board, 7, 7, "black"), 1);
  assert.equal(isForbiddenMove(board, 7, 7, "black").forbidden, false);
});

test("같은 모양이라도 활사 자리가 정상이면 삼삼 금수가 된다 - 재귀 판정 대조군", () => {
  const board = emptyBoard();
  place(board, "black", [
    [7, 6],
    [7, 9],
    [6, 7],
    [8, 7],
  ]);
  board[7][7] = "black"; // 위 테스트에서 8열 세로 돌만 뺀 판
  assert.equal(countThrees(board, 7, 7, "black"), 2);
  const result = isForbiddenMove(board, 7, 7, "black");
  assert.equal(result.forbidden, true);
  assert.equal(result.reason, "double-three");
});

test("백은 사사·삼삼·장목 어느 것도 금수가 아니다", () => {
  const board = emptyBoard();
  place(board, "white", [
    [7, 4],
    [7, 5],
    [7, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ]);
  board[7][7] = "white";
  assert.equal(isForbiddenMove(board, 7, 7, "white").forbidden, false);
});

test("돌이 빽빽한 판에서도 재귀가 끝나고 즉시 결과가 나온다", () => {
  const board = emptyBoard();
  // 중앙 7x7을 흑백 교대로 채워 재귀가 깊어질 수 있는 상황을 만든다
  for (let r = 4; r <= 10; r += 1) {
    for (let c = 4; c <= 10; c += 1) {
      if (r === 7 && c === 7) continue;
      board[r][c] = (r + c) % 3 === 0 ? "white" : "black";
    }
  }
  board[7][7] = "black";
  const started = process.hrtime.bigint();
  const result = isForbiddenMove(board, 7, 7, "black");
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(typeof result.forbidden, "boolean");
  assert.ok(elapsedMs < 200, `판정이 너무 오래 걸립니다: ${elapsedMs}ms`);
});
