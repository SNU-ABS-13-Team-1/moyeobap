import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CHAT_EMOJIS,
  GAME_CHAT_EMOJIS,
  POT_CHAT_EMOJIS,
  getChatEmojiById,
  getChatEmojiBySrc,
  POT_CHAT_EMOJI_SECTIONS,
  GAME_CHAT_EMOJI_SECTIONS,
} from "./chat-emojis.ts";

// 목록이 59종으로 늘면서 눈으로는 오타를 잡기 어려워졌습니다.
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
const NEW_POT_EMOJI_IDS = [
  "meet-time", "seat-ready", "receipt", "split-bill", "spicy-check", "still-waiting",
] as const;
const NEW_GAME_EMOJI_IDS = [
  "rules-help", "lagging", "watching", "next-time", "bet", "surrender", "champion",
] as const;
const NEW_EMOJI_LABELS = {
  "meet-time": "몇 시에?",
  "seat-ready": "자리 잡음!",
  receipt: "영수증이요!",
  "split-bill": "N빵 가자!",
  "spicy-check": "맵기 괜찮?",
  "still-waiting": "아직 멀었어?",
  "rules-help": "룰 알려줘",
  lagging: "렉이다 렉!",
  watching: "관전 중!",
  "next-time": "다음엔 이길거야…",
  bet: "내기 ㄱ?",
  surrender: "기권!",
  champion: "내가 짱!",
} as const;

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

test("신규 공동주문·미니게임 이모티콘 13종은 512px 정사각 알파 PNG다", () => {
  for (const id of [...NEW_POT_EMOJI_IDS, ...NEW_GAME_EMOJI_IDS]) {
    const emoji = getChatEmojiById(id);
    assert.ok(emoji, `${id}가 화이트리스트에 없습니다`);
    const png = readFileSync(`public${emoji.src}`);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${id}는 PNG가 아닙니다`);
    assert.equal(png.readUInt32BE(16), 512, `${id} 너비가 512px이 아닙니다`);
    assert.equal(png.readUInt32BE(20), 512, `${id} 높이가 512px이 아닙니다`);
    assert.ok([4, 6].includes(png[25]), `${id}에 알파 채널이 없습니다`);
  }
});

test("신규 이모티콘 13종은 이미지 문구와 같은 라벨을 쓴다", () => {
  for (const [id, label] of Object.entries(NEW_EMOJI_LABELS)) {
    assert.equal(getChatEmojiById(id)?.label, label, `${id} 라벨이 이미지 문구와 다릅니다`);
  }
});

test("게임방 피커에는 승부·진행 표현 25종이 모두 있다", () => {
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of [
    "one-more-game", "bring-it-on", "you-sure", "swagger", "teasing", "smile",
    "i-admit", "no-way", "frustrated", "crying", "study-time", "peekaboo",
    ...FEEDBACK_GAME_EMOJI_IDS,
    ...NEW_GAME_EMOJI_IDS,
  ]) {
    assert.ok(game.includes(id), `게임방 피커에 ${id}가 없습니다`);
  }
});

test("'기다려'는 피커에서 뺐지만 지난 메시지는 계속 그려진다", () => {
  // 사용자 피드백으로 게임방 피커에서 제외. 전송 화이트리스트에는 남겨
  // 이미 보낸 메시지의 렌더와 알림 미리보기가 깨지지 않게 합니다.
  assert.ok(!ids(GAME_CHAT_EMOJIS).includes("hold-on"), "게임방 피커에 hold-on이 남아 있습니다");
  assert.ok(!ids(POT_CHAT_EMOJIS).includes("hold-on"), "팟 피커에 hold-on이 들어갔습니다");
  assert.equal(getChatEmojiById("hold-on")?.label, "기다려");
});

test("신규 공동주문 이모티콘 6종은 팟 채팅에만 있다", () => {
  const pot = ids(POT_CHAT_EMOJIS);
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of NEW_POT_EMOJI_IDS) {
    assert.ok(pot.includes(id), `팟 채팅 피커에 ${id}가 없습니다`);
    assert.ok(!game.includes(id), `게임방 피커에 ${id}가 섞여 있습니다`);
  }
});

test("신규 미니게임 이모티콘 7종은 게임방 채팅에만 있다", () => {
  const pot = ids(POT_CHAT_EMOJIS);
  const game = ids(GAME_CHAT_EMOJIS);
  for (const id of NEW_GAME_EMOJI_IDS) {
    assert.ok(game.includes(id), `게임방 피커에 ${id}가 없습니다`);
    assert.ok(!pot.includes(id), `팟 채팅 피커에 ${id}가 섞여 있습니다`);
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

// 피커에서 뺐지만 화이트리스트에 남긴 것들. 지난 메시지의 렌더를 지키기
// 위한 자리이므로, 여기에 없는 이모티콘이 피커에서 빠지면 실수로 봅니다.
const RETIRED_FROM_PICKERS = new Set(["hold-on"]);

test("피커에 없는 이모티콘은 은퇴 목록에 있는 것뿐이다", () => {
  const shown = new Set([...ids(POT_CHAT_EMOJIS), ...ids(GAME_CHAT_EMOJIS)]);
  for (const emoji of CHAT_EMOJIS) {
    if (RETIRED_FROM_PICKERS.has(emoji.id)) {
      assert.ok(!shown.has(emoji.id), `${emoji.id}는 은퇴했는데 피커에 다시 나타났습니다`);
    } else {
      assert.ok(shown.has(emoji.id), `${emoji.id}는 어느 피커에도 안 보입니다`);
    }
  }
});

// 앞 두 줄이 사실상 피커의 전부입니다(격자가 220px에 묶여 있어 PC 7~10개,
// 폰 5~6개만 스크롤 없이 보입니다). 순서를 건드리면 여기서 걸리게 둡니다.

test("팟 피커 첫 두 줄은 참여와 위치·주문 표현이다", () => {
  assert.deepEqual(ids(POT_CHAT_EMOJIS).slice(0, 8), [
    "volunteer", "plus-one", "yes", "like",
    "where-are-you", "coming-down", "ill-order", "menu-question",
  ]);
});

test("게임방 피커 첫 두 줄은 맞장구와 도전 표현이다", () => {
  assert.deepEqual(ids(GAME_CHAT_EMOJIS).slice(0, 8), [
    "ok", "teasing", "smile", "nice",
    "one-more-game", "bring-it-on", "you-sure", "speed-game",
  ]);
});

// 두 캐릭터는 그림체가 달라 섞여 있으면 산만합니다(사용자 피드백).
// 밥공기(모여밥) 묶음과 개구리·쥐(김프랫·김프로그) 묶음을 파일명으로 가릅니다.
const isKimChar = (emoji: { src: string }) =>
  emoji.src.startsWith("/emojis/kimplog-") || emoji.src.startsWith("/emojis/kimprat-");

test("피커는 모여밥 테마와 김프랫·김프로그 테마로 나뉜다", () => {
  for (const [name, sections] of [
    ["팟", POT_CHAT_EMOJI_SECTIONS],
    ["게임방", GAME_CHAT_EMOJI_SECTIONS],
  ] as const) {
    assert.deepEqual(
      sections.map((section) => section.title),
      ["모여밥", "김프랫·김프로그"],
      `${name} 피커의 섹션 구성이 달라졌습니다`,
    );
    const [moyeobap, kim] = sections;
    for (const emoji of moyeobap.emojis) {
      assert.ok(!isKimChar(emoji), `${name} 모여밥 묶음에 ${emoji.id}(김프랫·김프로그)가 섞여 있습니다`);
    }
    for (const emoji of kim.emojis) {
      assert.ok(isKimChar(emoji), `${name} 김프랫·김프로그 묶음에 ${emoji.id}(모여밥)가 섞여 있습니다`);
    }
  }
});

test("순서를 바꿔도 피커에서 빠지거나 겹치는 이모티콘이 없다", () => {
  for (const [name, picker, expected] of [
    ["팟", POT_CHAT_EMOJIS, 33],
    ["게임방", GAME_CHAT_EMOJIS, 29],
  ] as const) {
    const list = ids(picker);
    assert.equal(list.length, expected, `${name} 피커 개수가 달라졌습니다`);
    assert.equal(new Set(list).size, expected, `${name} 피커에 중복이 있습니다`);
    for (const id of list) {
      assert.ok(getChatEmojiById(id), `${name} 피커의 ${id}가 화이트리스트에 없습니다`);
    }
  }
});
