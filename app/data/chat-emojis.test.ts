import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CHAT_EMOJIS,
  GAME_CHAT_EMOJIS,
  POT_CHAT_EMOJIS,
  getChatEmojiById,
  getChatEmojiBySrc,
} from "./chat-emojis.ts";

// 목록이 46종으로 늘면서 눈으로는 오타를 잡기 어려워졌습니다.
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

// 피커는 맥락별로 나눠 보여줍니다. 게임방에서는 승부 표현을, 팟 채팅에서는
// 주문·정산 표현을 씁니다. 전송 화이트리스트(CHAT_EMOJIS)는 둘을 다 알아야
// 합니다 — 그래야 상대 화면에서 지난 메시지가 깨지지 않습니다.

const ids = (emojis: readonly { id: string }[]) => emojis.map((emoji) => emoji.id);
const FEEDBACK_GAME_EMOJI_IDS = [
  "interesting", "fighting", "nice", "ok", "dozing", "speed-game",
] as const;

test("피드백으로 추가한 6종은 512px 정사각 알파 PNG다", () => {
  for (const id of FEEDBACK_GAME_EMOJI_IDS) {
    const emoji = getChatEmojiById(id);
    assert.ok(emoji, `${id}가 화이트리스트에 없습니다`);
    const png = readFileSync(`public${emoji.src}`);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${id}는 PNG가 아닙니다`);
    assert.equal(png.readUInt32BE(16), 512, `${id} 너비가 512px이 아닙니다`);
    assert.equal(png.readUInt32BE(20), 512, `${id} 높이가 512px이 아닙니다`);
    assert.ok([4, 6].includes(png[25]), `${id}에 알파 채널이 없습니다`);
  }
});

test("게임방 피커에는 승부·진행 표현 19종이 모두 있다", () => {
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of [
    "one-more-game", "bring-it-on", "you-sure", "swagger", "teasing", "smile",
    "i-admit", "no-way", "frustrated", "crying", "hold-on", "study-time", "peekaboo",
    ...FEEDBACK_GAME_EMOJI_IDS,
  ]) {
    assert.ok(game.includes(id), `게임방 피커에 ${id}가 없습니다`);
  }
});

test("게임방 피커에는 주문·정산 이모티콘이 없다", () => {
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of ["payment-complete", "order-complete", "ill-order", "price-question"]) {
    assert.ok(!game.includes(id), `게임방 피커에 ${id}가 섞여 있습니다`);
  }
});

test("팟 채팅 피커에는 게임 전용 이모티콘이 없다", () => {
  const pot = ids(POT_CHAT_EMOJIS);
  for (const id of ["one-more-game", "swagger", "peekaboo", "speed-game", "dozing"]) {
    assert.ok(!pot.includes(id), `팟 채팅 피커에 ${id}가 섞여 있습니다`);
  }
});

test("인사·감사 같은 공용 이모티콘은 양쪽 피커에 다 있다", () => {
  const pot = ids(POT_CHAT_EMOJIS);
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of ["hello", "thank-you", "good-job", "wait"]) {
    assert.ok(pot.includes(id), `팟 채팅 피커에 ${id}가 없습니다`);
    assert.ok(game.includes(id), `게임방 피커에 ${id}가 없습니다`);
  }
});

test("전송 화이트리스트는 두 피커의 이모티콘을 모두 안다", () => {
  for (const emoji of [...POT_CHAT_EMOJIS, ...GAME_CHAT_EMOJIS]) {
    assert.deepEqual(getChatEmojiById(emoji.id), emoji);
  }
});

test("피커에 없는 이모티콘이 화이트리스트에 남아 있지 않다", () => {
  const shown = new Set([...ids(POT_CHAT_EMOJIS), ...ids(GAME_CHAT_EMOJIS)]);
  for (const emoji of CHAT_EMOJIS) {
    assert.ok(shown.has(emoji.id), `${emoji.id}는 어느 피커에도 안 보입니다`);
  }
});
