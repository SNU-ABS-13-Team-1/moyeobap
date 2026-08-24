import test from "node:test";
import assert from "node:assert/strict";
import { streakLabel, winStreaks, type StreakWeek } from "./gameStreak.ts";

// 명예의 전당은 최신 주부터 정렬돼 옵니다.
const week = (weekKey: string, ...winners: string[]): StreakWeek => ({
  weekKey,
  entries: winners.map((userId) => ({ userId })),
});

test("같은 사람이 이어진 주에 1위면 연속으로 센다", () => {
  const hall = [
    week("2026-08-17", "a", "b"),
    week("2026-08-10", "a", "c"),
    week("2026-08-03", "a"),
    week("2026-07-27", "b", "a"),
  ];
  assert.deepEqual(winStreaks(hall), [{ weeks: 3, atLeast: false }, null, null, null]);
});

test("2위 이하가 같아도 연속과는 무관하다", () => {
  const hall = [week("2026-08-17", "a", "b"), week("2026-08-10", "b", "a")];
  assert.deepEqual(winStreaks(hall), [null, null]);
});

test("한 주뿐이면 뱃지를 붙이지 않는다", () => {
  assert.deepEqual(winStreaks([week("2026-08-17", "a")]), [null]);
});

test("스냅샷이 빠진 주가 사이에 있으면 연속이 끊긴다", () => {
  // 8/10 주는 아무도 랭킹을 열지 않아 통째로 없는 상태. 8/17과 8/03을 이어 붙이면
  // 실제로 우승했는지 알 수 없는 주까지 연속으로 세게 됩니다.
  const hall = [week("2026-08-17", "a"), week("2026-08-03", "a")];
  assert.deepEqual(winStreaks(hall), [null, null]);
});

test("연속이 여러 구간이면 각 구간의 가장 최근 주에만 붙는다", () => {
  const hall = [
    week("2026-08-17", "a"),
    week("2026-08-10", "a"),
    week("2026-08-03", "b"),
    week("2026-07-27", "b"),
    week("2026-07-20", "b"),
  ];
  assert.deepEqual(winStreaks(hall), [
    { weeks: 2, atLeast: false },
    null,
    { weeks: 3, atLeast: true },
    null,
    null,
  ]);
});

test("조회 창 끝까지 이어지면 더 길 수 있다고 표시한다", () => {
  const hall = [week("2026-08-17", "a"), week("2026-08-10", "a")];
  assert.deepEqual(winStreaks(hall), [{ weeks: 2, atLeast: true }, null]);
  assert.equal(streakLabel({ weeks: 2, atLeast: true }), "2주+ 연속");
  assert.equal(streakLabel({ weeks: 3, atLeast: false }), "3주 연속");
});

test("기록이 없는 주가 섞여 있어도 터지지 않는다", () => {
  const hall = [week("2026-08-17"), week("2026-08-10", "a"), week("2026-08-03", "a")];
  assert.deepEqual(winStreaks(hall), [null, { weeks: 2, atLeast: true }, null]);
});

test("연말을 넘어가도 7일 간격이면 연속이다", () => {
  const hall = [week("2026-01-05", "a"), week("2025-12-29", "a"), week("2025-12-22", "a")];
  assert.deepEqual(winStreaks(hall), [{ weeks: 3, atLeast: true }, null, null]);
});

test("빈 명예의 전당", () => {
  assert.deepEqual(winStreaks([]), []);
});
