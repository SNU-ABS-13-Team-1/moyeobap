import test from "node:test";
import assert from "node:assert/strict";
import { readPersonalBest, savePersonalBest } from "./personalBest.ts";

/** node 테스트에는 localStorage가 없어서 최소한만 흉내 냅니다. */
function useFakeStorage(broken = false) {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => {
      if (broken) throw new Error("접근 차단");
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("접근 차단");
      data.set(k, v);
    },
  };
  return data;
}

test("기록이 없으면 null", () => {
  useFakeStorage();
  assert.equal(readPersonalBest("chess-l3"), null);
});

test("첫 기록은 그대로 최고 기록이 된다", () => {
  useFakeStorage();
  assert.deepEqual(savePersonalBest("chess-l3", 120), { best: 120, isNew: true });
  assert.equal(readPersonalBest("chess-l3"), 120);
});

test("더 높은 점수만 최고 기록을 갈아치운다", () => {
  useFakeStorage();
  savePersonalBest("chess-l3", 120);
  assert.deepEqual(savePersonalBest("chess-l3", 90), { best: 120, isNew: false }, "낮으면 그대로");
  assert.deepEqual(savePersonalBest("chess-l3", 200), { best: 200, isNew: true }, "높으면 갱신");
});

test("같은 점수는 새 기록이 아니다", () => {
  useFakeStorage();
  savePersonalBest("chess-l3", 120);
  assert.deepEqual(savePersonalBest("chess-l3", 120), { best: 120, isNew: false });
});

test("난이도마다 기록이 따로 남는다", () => {
  useFakeStorage();
  savePersonalBest("chess-l1", 50);
  savePersonalBest("chess-l5", 300);
  assert.equal(readPersonalBest("chess-l1"), 50);
  assert.equal(readPersonalBest("chess-l5"), 300);
  assert.equal(readPersonalBest("rummy-l3"), null);
});

test("저장이 막힌 브라우저에서도 터지지 않는다", () => {
  useFakeStorage(true); // 시크릿 창처럼 접근 자체가 막힌 경우
  assert.equal(readPersonalBest("chess-l3"), null);
  assert.deepEqual(savePersonalBest("chess-l3", 120), { best: 120, isNew: true }, "이번 판 점수는 그대로 보여줘야 합니다");
});

test("이상한 값이 들어 있으면 없는 것으로 본다", () => {
  const data = useFakeStorage();
  data.set("moyeobap:best:chess-l3", "어쩌구");
  assert.equal(readPersonalBest("chess-l3"), null);
});
