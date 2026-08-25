import test from "node:test";
import assert from "node:assert/strict";
import {
  TURN_GRACE_MS,
  TURN_LIMIT_MS,
  checkScoreOffer,
  isTurnExpired,
  remainingTurnMs,
  swappedColors,
} from "./badukMatch.ts";

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

// ---------- 계가 신청 ----------

const BLACK = "u-black";
const WHITE = "u-white";

const playing = (scoreOfferBy: string | null = null) => ({
  status: "playing",
  blackId: BLACK,
  whiteId: WHITE,
  scoreOfferBy,
});

test("대국 중이면 양쪽 다 계가를 신청할 수 있다", () => {
  assert.equal(checkScoreOffer(playing(), BLACK, "offer"), null);
  assert.equal(checkScoreOffer(playing(), WHITE, "offer"), null);
});

test("관전자는 계가를 신청할 수도 수락할 수도 없다", () => {
  assert.ok(checkScoreOffer(playing(), "u-spectator", "offer"));
  assert.ok(checkScoreOffer(playing(BLACK), "u-spectator", "accept"));
  assert.ok(checkScoreOffer(playing(BLACK), "u-spectator", "decline"));
});

test("대국 중이 아니면 계가를 신청할 수 없다", () => {
  assert.ok(checkScoreOffer({ ...playing(), status: "waiting" }, BLACK, "offer"));
  assert.ok(checkScoreOffer({ ...playing(), status: "scoring" }, BLACK, "offer"));
  assert.ok(checkScoreOffer({ ...playing(), status: "finished" }, BLACK, "offer"));
});

test("이미 신청해 놓고 또 신청할 수는 없다", () => {
  assert.ok(checkScoreOffer(playing(BLACK), BLACK, "offer"));
});

test("상대가 먼저 신청했으면 새로 신청하는 대신 답을 해야 한다", () => {
  assert.ok(checkScoreOffer(playing(WHITE), BLACK, "offer"));
});

test("상대의 계가 신청은 수락할 수 있다", () => {
  assert.equal(checkScoreOffer(playing(WHITE), BLACK, "accept"), null);
  assert.equal(checkScoreOffer(playing(BLACK), WHITE, "accept"), null);
});

test("내가 한 신청을 내가 수락할 수는 없다", () => {
  assert.ok(checkScoreOffer(playing(BLACK), BLACK, "accept"));
});

test("신청이 없으면 수락할 것도 거절할 것도 없다", () => {
  assert.ok(checkScoreOffer(playing(null), BLACK, "accept"));
  assert.ok(checkScoreOffer(playing(null), BLACK, "decline"));
});

test("거절은 상대의 신청을 물리는 것이고, 내 신청을 취소하는 것이기도 하다", () => {
  assert.equal(checkScoreOffer(playing(WHITE), BLACK, "decline"), null);
  assert.equal(checkScoreOffer(playing(BLACK), BLACK, "decline"), null);
});

test("대국이 이미 끝났어도 남아 있는 신청은 물릴 수 있다", () => {
  // 착수·기권 등으로 상태가 먼저 바뀐 뒤 눌린 거절 요청이 에러로 보이지
  // 않게, 거절만은 status를 따지지 않습니다.
  assert.equal(checkScoreOffer({ ...playing(WHITE), status: "finished" }, BLACK, "decline"), null);
});

test("수락하려는 순간 대국이 끝나 있으면 수락할 수 없다", () => {
  assert.ok(checkScoreOffer({ ...playing(WHITE), status: "finished" }, BLACK, "accept"));
  assert.ok(checkScoreOffer({ ...playing(WHITE), status: "scoring" }, BLACK, "accept"));
});

test("상대가 아직 없는 방에서는 계가를 신청할 수 없다", () => {
  assert.ok(checkScoreOffer({ status: "waiting", blackId: BLACK, whiteId: null, scoreOfferBy: null }, BLACK, "offer"));
});
