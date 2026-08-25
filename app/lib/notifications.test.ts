import test from "node:test";
import assert from "node:assert/strict";
import { selectNewPots, shouldNotifyMessage, type NewPotCandidate } from "./notifications.ts";

const NOW = new Date("2026-08-25T12:00:00.000Z");

const pot = (over: Partial<NewPotCandidate> = {}): NewPotCandidate => ({
  id: "p1",
  createdAt: "2026-08-25T11:30:00.000Z",
  creatorId: "me-not",
  status: "active",
  deadline: "2026-08-25T13:00:00.000Z",
  ...over,
});

test("마지막으로 본 시각 이후에 생긴 팟만 새 팟으로 고른다", () => {
  const pots = [
    pot({ id: "old", createdAt: "2026-08-25T10:00:00.000Z" }),
    pot({ id: "new", createdAt: "2026-08-25T11:30:00.000Z" }),
  ];
  const result = selectNewPots(pots, {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result.map((p) => p.id), ["new"]);
});

test("마지막으로 본 시각과 똑같이 생긴 팟은 이미 본 것으로 친다", () => {
  const result = selectNewPots([pot({ createdAt: "2026-08-25T11:00:00.000Z" })], {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result, []);
});

test("처음 온 사람에게는 밀린 팟을 한꺼번에 띄우지 않는다", () => {
  // lastSeenAt이 없으면 기준이 없어서, 알림 대신 조용히 지나갑니다.
  const result = selectNewPots([pot(), pot({ id: "p2" })], {
    userId: "me",
    lastSeenAt: null,
    now: NOW,
  });
  assert.deepEqual(result, []);
});

test("내가 만든 팟은 내게 알리지 않는다", () => {
  const result = selectNewPots([pot({ creatorId: "me" })], {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result, []);
});

test("모집이 끝난 팟은 새 팟으로 띄우지 않는다", () => {
  const pots = [pot({ id: "closed", status: "closed" }), pot({ id: "failed", status: "failed" })];
  const result = selectNewPots(pots, {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result, []);
});

test("마감 시간이 이미 지난 팟은 띄우지 않는다", () => {
  const result = selectNewPots([pot({ deadline: "2026-08-25T11:59:00.000Z" })], {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result, []);
});

test("새로 생긴 순서대로 최신이 앞에 온다", () => {
  const pots = [
    pot({ id: "a", createdAt: "2026-08-25T11:10:00.000Z" }),
    pot({ id: "c", createdAt: "2026-08-25T11:50:00.000Z" }),
    pot({ id: "b", createdAt: "2026-08-25T11:30:00.000Z" }),
  ];
  const result = selectNewPots(pots, {
    userId: "me",
    lastSeenAt: "2026-08-25T11:00:00.000Z",
    now: NOW,
  });
  assert.deepEqual(result.map((p) => p.id), ["c", "b", "a"]);
});

test("내 팟에 남이 쓴 메시지는 알린다", () => {
  const notify = shouldNotifyMessage(
    { potId: "p1", authorId: "someone" },
    { userId: "me", myPotIds: new Set(["p1", "p2"]) },
  );
  assert.equal(notify, true);
});

test("내가 쓴 메시지는 내게 알리지 않는다", () => {
  const notify = shouldNotifyMessage(
    { potId: "p1", authorId: "me" },
    { userId: "me", myPotIds: new Set(["p1"]) },
  );
  assert.equal(notify, false);
});

test("내 팟이 아닌 곳의 메시지는 알리지 않는다", () => {
  // RLS를 믿고 넘기지 않고, 받은 이벤트도 내 팟 목록으로 한 번 더 거릅니다.
  const notify = shouldNotifyMessage(
    { potId: "남의팟", authorId: "someone" },
    { userId: "me", myPotIds: new Set(["p1"]) },
  );
  assert.equal(notify, false);
});
