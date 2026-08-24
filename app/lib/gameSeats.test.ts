import test from "node:test";
import assert from "node:assert/strict";
import { resolveLeave, resolveSit, seatOf, type RoomSeats } from "./gameSeats.ts";

const HOST = "host-user";
const GUEST = "guest-user";
const WATCHER = "watcher-user";

function room(partial: Partial<RoomSeats>): RoomSeats {
  return { status: "playing", hostId: HOST, guestId: GUEST, ...partial };
}

test("자리 주인 확인", () => {
  assert.equal(seatOf(room({}), HOST), "host");
  assert.equal(seatOf(room({}), GUEST), "guest");
  assert.equal(seatOf(room({}), WATCHER), null);
});

test("대국 중 한 명이 나가면 기권패로 기록하고 그 자리를 비운다", () => {
  assert.deepEqual(resolveLeave(room({}), GUEST), { kind: "resign", seat: "guest" });
  assert.deepEqual(resolveLeave(room({}), HOST), { kind: "resign", seat: "host" });
});

test("종료된 방에서 한 명이 나가도 상대가 있으면 방은 남고 자리만 빈다", () => {
  const finished = room({ status: "finished" });
  assert.deepEqual(resolveLeave(finished, GUEST), { kind: "vacate", seat: "guest" });
  assert.deepEqual(resolveLeave(finished, HOST), { kind: "vacate", seat: "host" });
});

test("남은 한 사람까지 나가면 그때 방을 지운다", () => {
  const onlyHost = room({ status: "finished", guestId: null });
  assert.deepEqual(resolveLeave(onlyHost, HOST), { kind: "delete" });

  const onlyGuest = room({ status: "finished", hostId: null });
  assert.deepEqual(resolveLeave(onlyGuest, GUEST), { kind: "delete" });
});

test("아직 시작 전인 방은 방장이 나가면 지운다", () => {
  const waiting = room({ status: "waiting", guestId: null });
  assert.deepEqual(resolveLeave(waiting, HOST), { kind: "delete" });
});

test("관전자가 나가는 것은 방에 아무 영향이 없다", () => {
  assert.deepEqual(resolveLeave(room({}), WATCHER), { kind: "ignore" });
});

test("대기 중인 방에 들어가면 두 번째 자리에 앉고 바로 시작한다", () => {
  const waiting = room({ status: "waiting", guestId: null });
  assert.deepEqual(resolveSit(waiting, WATCHER), { kind: "sit", seat: "guest", start: true });
});

test("종료된 방의 빈 자리에 관전자가 앉을 수 있고, 바로 시작하지는 않는다", () => {
  const seatOpen = room({ status: "finished", guestId: null });
  assert.deepEqual(resolveSit(seatOpen, WATCHER), { kind: "sit", seat: "guest", start: false });
});

test("방장이 나간 자리에도 관전자가 앉을 수 있다", () => {
  const hostGone = room({ status: "finished", hostId: null });
  assert.deepEqual(resolveSit(hostGone, WATCHER), { kind: "sit", seat: "host", start: false });
});

test("진행 중인 대국에는 끼어들 수 없다", () => {
  assert.deepEqual(resolveSit(room({}), WATCHER), { kind: "full" });
});

test("두 자리가 모두 찬 종료된 방에는 앉을 수 없다", () => {
  assert.deepEqual(resolveSit(room({ status: "finished" }), WATCHER), { kind: "full" });
});

test("이미 앉아 있는 사람은 다시 앉지 않는다", () => {
  const seatOpen = room({ status: "finished", guestId: null });
  assert.deepEqual(resolveSit(seatOpen, HOST), { kind: "self" });
});

test("나갔다가 다른 사람이 앉고 또 나가는 흐름이 방을 지우지 않는다", () => {
  // 대국 중 guest 이탈 -> guest 자리가 빈 종료 방
  let state: RoomSeats = room({});
  const leave = resolveLeave(state, GUEST);
  assert.deepEqual(leave, { kind: "resign", seat: "guest" });
  state = { status: "finished", hostId: HOST, guestId: null };

  // 관전자가 그 자리에 앉음
  const sit = resolveSit(state, WATCHER);
  assert.deepEqual(sit, { kind: "sit", seat: "guest", start: false });
  state = { ...state, guestId: WATCHER };

  // 이번엔 방장이 나감 -> 방은 남고 host 자리만 빈다
  assert.deepEqual(resolveLeave(state, HOST), { kind: "vacate", seat: "host" });
  state = { ...state, hostId: null };

  // 마지막 한 사람이 나가야 방이 사라진다
  assert.deepEqual(resolveLeave(state, WATCHER), { kind: "delete" });
});
