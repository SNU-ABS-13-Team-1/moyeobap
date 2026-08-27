import assert from "node:assert/strict";
import { test } from "node:test";
import { TURN_LIMIT_MS, isTurnExpired, remainingTurnMs, swappedColors } from "./alkkagiMatch.ts";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

test("시간이 남아 있으면 초과가 아니다", () => {
  assert.equal(isTurnExpired(iso(-10_000), NOW), false);
});

test("제한 시간과 여유분을 모두 넘기면 초과다", () => {
  assert.equal(isTurnExpired(iso(-(TURN_LIMIT_MS + 2_001)), NOW), true);
});

test("기준 시각이 없으면 초과로 보지 않는다", () => {
  assert.equal(isTurnExpired(null, NOW), false);
});

test("턴 시작이 미래면(돌이 아직 구르는 중) 제한 시간이 그대로 남는다", () => {
  assert.equal(remainingTurnMs(iso(2_000), NOW), TURN_LIMIT_MS);
  assert.equal(isTurnExpired(iso(2_000), NOW), false);
});

test("남은 시간은 0 아래로 내려가지 않는다", () => {
  assert.equal(remainingTurnMs(iso(-999_999), NOW), 0);
});

test("재대국은 흑백을 통째로 맞바꾼다", () => {
  const swapped = swappedColors({
    blackId: "B", blackName: "흑돌", whiteId: "W", whiteName: "백돌",
  });
  assert.deepEqual(swapped, { black_id: "W", black_name: "백돌", white_id: "B", white_name: "흑돌" });
});

test("상대가 없으면 흑백을 바꿀 수 없다", () => {
  assert.throws(() =>
    swappedColors({ blackId: "B", blackName: "흑돌", whiteId: null, whiteName: null }),
  );
});
