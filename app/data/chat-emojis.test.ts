import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { CHAT_EMOJIS, getChatEmojiById, getChatEmojiBySrc } from "./chat-emojis.ts";

// 목록이 40종으로 늘면서 눈으로는 오타를 잡기 어려워졌습니다.
// id가 겹치면 뒤엣것이 영영 안 눌리고, 파일명이 한 글자 틀리면
// 피커에는 깨진 그림이, 채팅에는 깨진 말풍선이 그대로 나갑니다.

test("이모티콘 id는 겹치지 않는다", () => {
  const ids = CHAT_EMOJIS.map((emoji) => emoji.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("이모티콘 그림 경로는 겹치지 않는다", () => {
  const srcs = CHAT_EMOJIS.map((emoji) => emoji.src);
  assert.equal(new Set(srcs).size, srcs.length);
});

test("모든 이모티콘 그림 파일이 실제로 있다", () => {
  for (const emoji of CHAT_EMOJIS) {
    assert.ok(
      existsSync(`public${emoji.src}`),
      `${emoji.id}: public${emoji.src} 파일이 없습니다`,
    );
  }
});

test("id와 경로 양쪽으로 같은 이모티콘을 찾을 수 있다", () => {
  for (const emoji of CHAT_EMOJIS) {
    assert.deepEqual(getChatEmojiById(emoji.id), emoji);
    assert.deepEqual(getChatEmojiBySrc(emoji.src), emoji);
  }
});
