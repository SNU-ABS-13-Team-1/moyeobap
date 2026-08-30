import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  RECENT_EMOJI_LIMIT,
  orderByRecent,
  readRecentEmojiIds,
  rememberEmojiUse,
} from "./recentEmojis.ts";

// localStorage는 브라우저에만 있습니다. 저장 규칙(개수 제한, 중복 제거,
// 막힌 브라우저)을 화면 없이 확인하려고 최소한만 흉내 냅니다.
function installStorage(store = new Map<string, string>()) {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  return store;
}

beforeEach(() => {
  installStorage();
});

test("방금 쓴 것이 맨 앞에 온다", () => {
  rememberEmojiUse("pot", "yes");
  rememberEmojiUse("pot", "like");
  assert.deepEqual(readRecentEmojiIds("pot"), ["like", "yes"]);
});

test("같은 것을 다시 쓰면 중복되지 않고 앞으로만 온다", () => {
  rememberEmojiUse("pot", "yes");
  rememberEmojiUse("pot", "like");
  rememberEmojiUse("pot", "yes");
  assert.deepEqual(readRecentEmojiIds("pot"), ["yes", "like"]);
});

test("한 줄(4개)까지만 기억한다", () => {
  for (const id of ["a", "b", "c", "d", "e"]) rememberEmojiUse("game", id);
  const recent = readRecentEmojiIds("game");
  assert.equal(recent.length, RECENT_EMOJI_LIMIT);
  assert.deepEqual(recent, ["e", "d", "c", "b"]);
});

test("팟과 게임방은 서로 섞이지 않는다", () => {
  rememberEmojiUse("pot", "receipt");
  rememberEmojiUse("game", "champion");
  assert.deepEqual(readRecentEmojiIds("pot"), ["receipt"]);
  assert.deepEqual(readRecentEmojiIds("game"), ["champion"]);
});

test("저장이 막힌 브라우저에서도 터지지 않는다", () => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readRecentEmojiIds("pot"), []);
  assert.deepEqual(rememberEmojiUse("pot", "yes"), ["yes"]);
});

test("이상한 값이 들어 있으면 없는 것으로 본다", () => {
  const store = installStorage();
  store.set("moyeobap:emoji:recent:pot", "{{망가진 JSON");
  assert.deepEqual(readRecentEmojiIds("pot"), []);
  store.set("moyeobap:emoji:recent:pot", JSON.stringify(["yes", 42, null]));
  assert.deepEqual(readRecentEmojiIds("pot"), ["yes"]);
});

const LIST = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as const;

test("최근 쓴 것만 앞으로 오고 나머지는 원래 순서 그대로다", () => {
  assert.deepEqual(orderByRecent(LIST, ["c", "a"]).map((item) => item.id), [
    "c", "a", "b", "d",
  ]);
});

test("기록이 없으면 목록을 그대로 쓴다", () => {
  assert.equal(orderByRecent(LIST, []), LIST);
});

test("이 피커에 없는 id가 기록에 남아 있어도 목록이 줄지 않는다", () => {
  // 게임방에서 쓴 것이 팟 기록에 섞이거나, 목록에서 뺀 이모티콘이 남은 경우.
  assert.deepEqual(orderByRecent(LIST, ["없는-id", "b"]).map((item) => item.id), [
    "b", "a", "c", "d",
  ]);
});
