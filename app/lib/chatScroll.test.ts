import test from "node:test";
import assert from "node:assert/strict";
import { CHAT_FOLLOW_THRESHOLD_PX, isChatAtBottom } from "./chatScroll.ts";

// 목록 높이 400px 기준으로 "남은 스크롤"만 바꿔가며 확인합니다.
function list(remaining: number, { clientHeight = 400 } = {}) {
  return { scrollTop: remaining >= 0 ? 1000 - remaining : 1000, clientHeight, scrollHeight: 1400 };
}

test("맨 아래까지 내려온 목록은 하단으로 본다", () => {
  assert.equal(isChatAtBottom(list(0)), true);
});

test("내용이 짧아 스크롤이 아예 없으면 하단으로 본다", () => {
  assert.equal(isChatAtBottom({ scrollTop: 0, clientHeight: 400, scrollHeight: 400 }), true);
});

test("임계값 이내로 살짝 올라간 정도는 아직 하단으로 본다", () => {
  assert.equal(isChatAtBottom(list(CHAT_FOLLOW_THRESHOLD_PX - 1)), true);
});

test("임계값 경계는 하단에 포함한다", () => {
  assert.equal(isChatAtBottom(list(CHAT_FOLLOW_THRESHOLD_PX)), true);
});

test("위로 올려 과거 대화를 읽는 중이면 하단이 아니다", () => {
  assert.equal(isChatAtBottom(list(CHAT_FOLLOW_THRESHOLD_PX + 1)), false);
  assert.equal(isChatAtBottom(list(300)), false);
});

test("이모티콘 한 장(140px)만큼 올라가도 하단이 아니다", () => {
  // 임계값이 이모티콘 높이보다 크면 "위로 올려둔 화면"을 하단으로 오인합니다.
  assert.equal(isChatAtBottom(list(140)), false);
});

test("브라우저가 분수 픽셀로 재서 조금 넘겨도 하단으로 본다", () => {
  // 확대/축소 상태에서 scrollTop이 반올림돼 남은 값이 음수로 나오는 경우입니다.
  assert.equal(isChatAtBottom({ scrollTop: 1000.5, clientHeight: 400, scrollHeight: 1400 }), true);
});

test("임계값을 직접 넘길 수 있다", () => {
  assert.equal(isChatAtBottom(list(100), 120), true);
  assert.equal(isChatAtBottom(list(100), 10), false);
});
