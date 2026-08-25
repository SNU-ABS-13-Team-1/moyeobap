import test from "node:test";
import assert from "node:assert/strict";
import { parseChatBody } from "./gameChatBody.ts";
import { CHAT_EMOJIS, getChatEmojiById } from "../data/chat-emojis.ts";

const known = CHAT_EMOJIS[0];

test("일반 텍스트는 그대로 text로 넘어간다", () => {
  assert.deepEqual(parseChatBody({ text: "한 수 잘 두셨네요" }, getChatEmojiById), {
    text: "한 수 잘 두셨네요",
    kind: "text",
  });
});

test("이모티콘 id는 서버가 아는 경로로 바뀐다", () => {
  assert.deepEqual(parseChatBody({ emojiId: known.id }, getChatEmojiById), {
    text: known.src,
    kind: "image",
  });
});

test("모르는 이모티콘 id는 거절한다", () => {
  const result = parseChatBody({ emojiId: "존재하지-않는-이모티콘" }, getChatEmojiById);
  assert.ok("error" in result, "에러가 나와야 합니다");
});

test("클라이언트가 보낸 경로는 믿지 않는다", () => {
  // emojiId만 화이트리스트로 확인하고, 함께 온 src/text는 무시합니다.
  const result = parseChatBody(
    { emojiId: known.id, src: "/emojis/../../etc/passwd.png", text: "무시되어야 함" },
    getChatEmojiById,
  );
  assert.deepEqual(result, { text: known.src, kind: "image" });
});

test("본문이 없거나 형태가 이상하면 빈 텍스트로 넘긴다", () => {
  // 길이 검증은 각 게임의 postRoomChat이 이미 하고 있어서 여기서 막지 않습니다.
  assert.deepEqual(parseChatBody(null, getChatEmojiById), { text: "", kind: "text" });
  assert.deepEqual(parseChatBody({ text: 42 }, getChatEmojiById), { text: "", kind: "text" });
});

test("emojiId가 문자열이 아니면 거절한다", () => {
  const result = parseChatBody({ emojiId: { nested: "object" } }, getChatEmojiById);
  assert.ok("error" in result, "에러가 나와야 합니다");
});
