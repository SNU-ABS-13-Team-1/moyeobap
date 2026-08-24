import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_OPEN_ROOMS,
  PHONE_MAX_PLAYERS,
  RUMMY_MAX_PLAYERS,
  fromChess,
  fromOmok,
  fromPhone,
  fromRummy,
  mergeOpenRooms,
} from "./openRooms.ts";
import { MAX_PLAYERS as RUMMY_ORIGINAL } from "./rummyMatch.ts";
import { MAX_PLAYERS as PHONE_ORIGINAL } from "./phoneMatch.ts";

test("정원을 원본 모듈과 똑같이 적어뒀는지 확인한다", () => {
  // openRooms.ts는 순수 모듈이라 정원을 다시 적어둡니다. 원본이 바뀌면 여기서 걸립니다.
  assert.equal(RUMMY_MAX_PLAYERS, RUMMY_ORIGINAL);
  assert.equal(PHONE_MAX_PLAYERS, PHONE_ORIGINAL);
});

const at = (day: string) => `2026-08-2${day}T00:00:00.000Z`;

const omokRoom = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  roomName: "오목 한 판",
  status: "waiting",
  blackId: "u1",
  blackName: "가",
  whiteId: null,
  whiteName: null,
  createdAt: at("1"),
  ...over,
});

const chessRoom = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  roomName: "체스 한 판",
  status: "waiting",
  whiteId: "u1",
  whiteName: "가",
  blackId: null,
  blackName: null,
  timeControl: "move60",
  createdAt: at("2"),
  ...over,
});

const rummyRoom = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  roomName: "루미큐브",
  status: "waiting",
  hostId: "u1",
  players: [{ id: "u1", name: "가", left: false }],
  turnLimitSec: 90,
  createdAt: at("3"),
  ...over,
});

const phoneRoom = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  roomName: "갈틱폰",
  status: "waiting",
  hostId: "u1",
  players: [{ id: "u1", name: "가", left: false }],
  settings: { writeSec: 60, drawSec: 90 },
  createdAt: at("4"),
  ...over,
});

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `p${i}`, left: false }));

test("게임마다 정원이 다르다", () => {
  assert.equal(fromOmok(omokRoom()).maxPlayers, 2);
  assert.equal(fromChess(chessRoom()).maxPlayers, 2);
  assert.equal(fromRummy(rummyRoom()).maxPlayers, 4);
  assert.equal(fromPhone(phoneRoom()).maxPlayers, 10);
});

test("체스와 루미큐브의 방 주소에는 /online/ 이 들어간다", () => {
  assert.equal(fromOmok(omokRoom()).href, "/games/omok/o1");
  assert.equal(fromChess(chessRoom()).href, "/games/chess/online/c1");
  assert.equal(fromRummy(rummyRoom()).href, "/games/rummy/online/r1");
  assert.equal(fromPhone(phoneRoom()).href, "/games/phone/p1");
});

test("참여 API 주소는 게임 이름만 다르다", () => {
  assert.equal(fromOmok(omokRoom()).joinApi, "/api/games/omok/rooms/o1/join");
  assert.equal(fromChess(chessRoom()).joinApi, "/api/games/chess/rooms/c1/join");
  assert.equal(fromRummy(rummyRoom()).joinApi, "/api/games/rummy/rooms/r1/join");
  assert.equal(fromPhone(phoneRoom()).joinApi, "/api/games/phone/rooms/p1/join");
});

test("오목·체스는 상대가 없으면 1명, 있으면 2명이다", () => {
  assert.equal(fromOmok(omokRoom()).playerCount, 1);
  assert.equal(fromOmok(omokRoom({ whiteId: "u2", status: "playing" })).playerCount, 2);
  assert.equal(fromChess(chessRoom()).playerCount, 1);
  assert.equal(fromChess(chessRoom({ blackId: "u2", status: "playing" })).playerCount, 2);
});

test("루미큐브·갈틱폰의 인원수는 나간 사람(left)을 빼고 센다", () => {
  const players = [
    { id: "u1", name: "가", left: false },
    { id: "u2", name: "나", left: true },
    { id: "u3", name: "다", left: false },
  ];
  assert.equal(fromRummy(rummyRoom({ players })).playerCount, 2);
  assert.equal(fromPhone(phoneRoom({ players })).playerCount, 2);
});

test("나간 사람은 참여자 명단에도 들어가지 않는다", () => {
  const players = [
    { id: "u1", name: "가", left: false },
    { id: "u2", name: "나", left: true },
  ];
  assert.deepEqual(fromRummy(rummyRoom({ players })).memberIds, ["u1"]);
  assert.deepEqual(fromPhone(phoneRoom({ players })).memberIds, ["u1"]);
});

test("오목·체스의 참여자 명단은 채워진 자리만 담는다", () => {
  assert.deepEqual(fromOmok(omokRoom()).memberIds, ["u1"]);
  assert.deepEqual(fromOmok(omokRoom({ whiteId: "u2" })).memberIds, ["u1", "u2"]);
  assert.deepEqual(fromChess(chessRoom({ blackId: "u2" })).memberIds, ["u1", "u2"]);
});

test("빈 자리는 대기중일 때만 생긴다", () => {
  assert.equal(fromOmok(omokRoom()).hasOpenSeat, true);
  assert.equal(fromOmok(omokRoom({ whiteId: "u2" })).hasOpenSeat, false);
  // 정원이 안 찼어도 이미 시작한 방에는 참여할 수 없습니다.
  assert.equal(fromRummy(rummyRoom({ status: "playing" })).hasOpenSeat, false);
  assert.equal(fromPhone(phoneRoom({ status: "playing" })).hasOpenSeat, false);
});

test("루미큐브는 4명, 갈틱폰은 10명이 차면 빈 자리가 없다", () => {
  assert.equal(fromRummy(rummyRoom({ players: seats(3) })).hasOpenSeat, true);
  assert.equal(fromRummy(rummyRoom({ players: seats(4) })).hasOpenSeat, false);
  assert.equal(fromPhone(phoneRoom({ players: seats(9) })).hasOpenSeat, true);
  assert.equal(fromPhone(phoneRoom({ players: seats(10) })).hasOpenSeat, false);
});

test("갈틱폰은 끝난 방까지 내려오므로 목록에서 걸러낸다", () => {
  // phoneOnline.listRooms()에는 status 필터가 없습니다(다른 셋은 DB에서 이미 거름).
  const merged = mergeOpenRooms({
    omok: [],
    chess: [],
    rummy: [],
    phone: [phoneRoom({ id: "done", status: "finished" }), phoneRoom({ id: "live" })],
  });
  assert.deepEqual(
    merged.map((room) => room.id),
    ["live"],
  );
});

test("앨범 공개 중인 갈틱폰 방은 남긴다", () => {
  const merged = mergeOpenRooms({
    omok: [],
    chess: [],
    rummy: [],
    phone: [phoneRoom({ id: "show", status: "presenting" })],
  });
  assert.deepEqual(
    merged.map((room) => room.id),
    ["show"],
  );
});

test("게임을 섞어 최신순으로 정렬한다", () => {
  const merged = mergeOpenRooms({
    omok: [omokRoom()],
    chess: [chessRoom()],
    rummy: [rummyRoom()],
    phone: [phoneRoom()],
  });
  assert.deepEqual(
    merged.map((room) => room.game),
    ["phone", "rummy", "chess", "omok"],
  );
});

test("목록은 최대 개수까지만 내려간다", () => {
  const rooms = Array.from({ length: MAX_OPEN_ROOMS + 5 }, (_, i) =>
    omokRoom({ id: `o${i}`, createdAt: new Date(Date.parse(at("1")) + i * 1000).toISOString() }),
  );
  assert.equal(
    mergeOpenRooms({ omok: rooms, chess: [], rummy: [], phone: [] }).length,
    MAX_OPEN_ROOMS,
  );
});

test("방 정보 한 줄에 게임별 설정을 담는다", () => {
  assert.equal(fromOmok(omokRoom()).meta, null);
  assert.equal(fromRummy(rummyRoom()).meta, "턴당 90초");
  assert.equal(fromPhone(phoneRoom()).meta, "글 60초 · 그림 90초");
});

test("체스 시간제 라벨은 넘겨받아 붙인다", () => {
  assert.equal(fromChess(chessRoom()).meta, null);
  assert.equal(fromChess(chessRoom(), "한 수 60초").meta, "한 수 60초");
  const merged = mergeOpenRooms(
    { omok: [], chess: [chessRoom()], rummy: [], phone: [] },
    { chessTimeLabel: (timeControl) => `[${timeControl}]` },
  );
  assert.equal(merged[0].meta, "[move60]");
});
