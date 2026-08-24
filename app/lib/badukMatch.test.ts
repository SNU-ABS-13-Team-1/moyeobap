import test from "node:test";
import assert from "node:assert/strict";
import { TURN_GRACE_MS, TURN_LIMIT_MS, isTurnExpired, remainingTurnMs, swappedColors } from "./badukMatch.ts";

const T0 = Date.parse("2026-09-01T10:00:00.000Z");
const at = (ms: number) => new Date(T0 + ms).toISOString();

test("제한 시간이 남아 있으면 시간 초과가 아니다", () => {
  assert.equal(isTurnExpired(at(0), T0 + 1_000), false);
  assert.equal(isTurnExpired(at(0), T0 + TURN_LIMIT_MS - 1), false);
});

test("제한 시간을 막 넘겼을 때는 유예 시간 안이라 아직 초과가 아니다", () => {
  assert.equal(isTurnExpired(at(0), T0 + TURN_LIMIT_MS), false);
  assert.equal(isTurnExpired(at(0), T0 + TURN_LIMIT_MS + TURN_GRACE_MS - 1), false);
});

test("제한 시간 + 유예를 넘기면 시간 초과다", () => {
  assert.equal(isTurnExpired(at(0), T0 + TURN_LIMIT_MS + TURN_GRACE_MS), true);
  assert.equal(isTurnExpired(at(0), T0 + 120_000), true);
});

test("turn_started_at이 없는 방은 시간 초과로 보지 않는다", () => {
  assert.equal(isTurnExpired(null, T0 + 600_000), false);
  assert.equal(isTurnExpired("이상한 값", T0 + 600_000), false);
});

test("남은 시간은 0과 제한 시간 사이로 잘린다", () => {
  assert.equal(remainingTurnMs(at(0), T0), TURN_LIMIT_MS);
  assert.equal(remainingTurnMs(at(0), T0 + 10_000), TURN_LIMIT_MS - 10_000);
  assert.equal(remainingTurnMs(at(0), T0 + 999_999), 0);
  assert.equal(remainingTurnMs(at(5_000), T0), TURN_LIMIT_MS);
});

test("남은 시간 표시에는 유예 시간을 얹지 않는다", () => {
  assert.equal(remainingTurnMs(at(0), T0 + TURN_LIMIT_MS), 0);
});

test("turn_started_at이 없으면 남은 시간을 제한 시간 전체로 본다", () => {
  assert.equal(remainingTurnMs(null, T0), TURN_LIMIT_MS);
});

test("재대국하면 흑과 백이 통째로 교대된다", () => {
  const swapped = swappedColors({
    blackId: "u-black",
    blackName: "강권재",
    whiteId: "u-white",
    whiteName: "류성환",
  });
  assert.deepEqual(swapped, {
    black_id: "u-white",
    black_name: "류성환",
    white_id: "u-black",
    white_name: "강권재",
  });
});

test("흑백 교대를 두 번 하면 원래대로 돌아온다", () => {
  const first = swappedColors({
    blackId: "u-black",
    blackName: "강권재",
    whiteId: "u-white",
    whiteName: "류성환",
  });
  const second = swappedColors({
    blackId: first.black_id,
    blackName: first.black_name,
    whiteId: first.white_id,
    whiteName: first.white_name,
  });
  assert.equal(second.black_id, "u-black");
  assert.equal(second.black_name, "강권재");
  assert.equal(second.white_id, "u-white");
  assert.equal(second.white_name, "류성환");
});

test("상대가 없는 방은 흑백을 교대할 수 없다", () => {
  assert.throws(() =>
    swappedColors({ blackId: "u-black", blackName: "강권재", whiteId: null, whiteName: null }),
  );
});
