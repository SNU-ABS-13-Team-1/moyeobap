import test from "node:test";
import assert from "node:assert/strict";
import { assignRanks } from "./gameRank.ts";

const ranksOf = (scores: number[]) => assignRanks(scores.map((score) => ({ score })), (e) => e.score).map((e) => e.rank);

test("점수가 다르면 순서대로 순위가 매겨진다", () => {
  assert.deepEqual(ranksOf([100, 90, 80]), [1, 2, 3]);
});

test("점수가 같으면 순위도 같다", () => {
  assert.deepEqual(ranksOf([100, 100, 90]), [1, 1, 3]);
});

test("공동 순위 다음은 인원수만큼 건너뛴다", () => {
  assert.deepEqual(ranksOf([100, 90, 90, 90, 80]), [1, 2, 2, 2, 5]);
});

test("전원이 같은 점수면 모두 1위다", () => {
  assert.deepEqual(ranksOf([70, 70, 70, 70]), [1, 1, 1, 1]);
});

test("맨 끝에서 동점이어도 순위가 같다", () => {
  assert.deepEqual(ranksOf([100, 90, 90]), [1, 2, 2]);
});

test("0점도 다른 점수와 똑같이 다룬다", () => {
  assert.deepEqual(ranksOf([0, 0]), [1, 1]);
});

test("빈 목록과 한 명짜리 목록", () => {
  assert.deepEqual(ranksOf([]), []);
  assert.deepEqual(ranksOf([42]), [1]);
});

test("원래 항목의 다른 값은 그대로 남는다", () => {
  const ranked = assignRanks([{ name: "가", score: 10 }, { name: "나", score: 10 }], (e) => e.score);
  assert.deepEqual(ranked, [
    { name: "가", score: 10, rank: 1 },
    { name: "나", score: 10, rank: 1 },
  ]);
});
