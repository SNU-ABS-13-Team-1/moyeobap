import test from "node:test";
import assert from "node:assert/strict";
import { toParticipantProfiles } from "./potParticipants.ts";

const 참여자 = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  initial: name.charAt(0),
  ...extra,
});

test("표시 이름을 바꿔도 본인 줄을 id로 찾아낸다", () => {
  // 팟에 참여할 때 찍힌 이름은 '홍길동'인데, 그 뒤 프로필에서 '길동'으로 바꾼 상황.
  const profiles = toParticipantProfiles(
    [참여자("user-1", "홍길동"), 참여자("user-2", "김철수")],
    "user-2",
    "user-1",
  );

  assert.equal(profiles[0].isMe, true);
  assert.equal(profiles[1].isMe, false);
});

test("동명이인이 있어도 본인 줄에만 표시한다", () => {
  const profiles = toParticipantProfiles(
    [참여자("user-1", "김민수"), 참여자("user-2", "김민수")],
    "user-1",
    "user-2",
  );

  assert.deepEqual(profiles.map((p) => p.isMe), [false, true]);
});

test("로그인하지 않았으면 어느 줄도 본인이 아니다", () => {
  const profiles = toParticipantProfiles([참여자("user-1", "홍길동")], "user-1", null);

  assert.equal(profiles[0].isMe, false);
});

test("관리자도 id로 판정한다", () => {
  const profiles = toParticipantProfiles(
    [참여자("user-1", "홍길동"), 참여자("user-2", "김철수")],
    "user-2",
    "user-1",
  );

  assert.deepEqual(profiles.map((p) => p.isManager), [false, true]);
});

test("송금 여부와 주문 메모를 그대로 옮긴다", () => {
  const profiles = toParticipantProfiles(
    [참여자("user-1", "홍길동", { isPaid: true, orderMemo: "  덜 맵게  " })],
    "user-1",
    "user-1",
  );

  assert.equal(profiles[0].isPaid, true);
  assert.equal(profiles[0].orderMemo, "  덜 맵게  ");
});

test("빈 주문 메모는 내려주지 않는다", () => {
  const profiles = toParticipantProfiles([참여자("user-1", "홍길동", { orderMemo: "" })], "user-1", "user-1");

  assert.equal(profiles[0].orderMemo, undefined);
});

test("id·이메일·계좌 같은 신원 정보는 내려주지 않는다", () => {
  const profiles = toParticipantProfiles(
    [참여자("user-1", "홍길동", { email: "a@b.com", accountNumber: "123-456", bankName: "우리" })],
    "user-1",
    "user-1",
  );

  const keys = Object.keys(profiles[0]);
  for (const 금지 of ["id", "email", "accountNumber", "bankName", "avatarUrl", "joinedAt"]) {
    assert.ok(!keys.includes(금지), `${금지}가 참여자 응답에 들어 있습니다`);
  }
});

test("관리자가 아직 없는 팟에서는 아무도 관리자로 표시되지 않는다", () => {
  const profiles = toParticipantProfiles([참여자("user-1", "홍길동")], null, "user-1");

  assert.equal(profiles[0].isManager, false);
});
