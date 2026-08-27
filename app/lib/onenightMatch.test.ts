import test from "node:test";
import assert from "node:assert/strict";
import {
  CENTER_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  dealRoles,
  deckFor,
  judge,
  makeRng,
  needsNightChoice,
  resolveNight,
  resolveVotes,
} from "./onenightMatch.ts";
import type { NightAction, Role } from "./onenightMatch.ts";

const W: Role = "werewolf";

test("인원별 덱은 항상 (인원 + 3)장이다", () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) {
    assert.equal(deckFor(n).length, n + CENTER_COUNT, `${n}인`);
  }
  assert.throws(() => deckFor(2));
  assert.throws(() => deckFor(9));
});

test("모든 덱에 늑대가 정확히 2장 들어 있다", () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) {
    assert.equal(deckFor(n).filter((r) => r === W).length, 2, `${n}인`);
  }
});

test("프리메이슨은 넣을 거면 두 장을 같이 넣는다", () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) {
    const masons = deckFor(n).filter((r) => r === "mason").length;
    assert.ok(masons === 0 || masons === 2, `${n}인은 ${masons}장`);
  }
});

test("나눠 준 카드 수가 맞는다", () => {
  const { startRoles, center } = dealRoles(deckFor(5), 5, makeRng(1));
  assert.equal(startRoles.length, 5);
  assert.equal(center.length, CENTER_COUNT);
  assert.throws(() => dealRoles(deckFor(5), 4, makeRng(1)));
});

test("밤이 끝나도 카드 구성은 그대로다", () => {
  const deck = deckFor(5);
  for (let seed = 0; seed < 200; seed += 1) {
    const rng = makeRng(seed);
    const { startRoles, center } = dealRoles(deck, 5, rng);
    const actions: (NightAction | null)[] = startRoles.map((role, seat) => {
      if (role === "seer") return { kind: "seerCenter", cards: [0, 1] };
      if (role === "robber") return { kind: "robber", seat: (seat + 1) % 5 };
      if (role === "troublemaker") {
        const others = [0, 1, 2, 3, 4].filter((i) => i !== seat);
        return { kind: "troublemaker", seats: [others[0], others[1]] };
      }
      if (role === "drunk") return { kind: "drunk", card: seed % CENTER_COUNT };
      return null;
    });
    const night = resolveNight(startRoles, center, actions);
    assert.deepEqual(
      [...night.finalRoles, ...night.finalCenter].sort(),
      deck.slice().sort(),
      `seed ${seed}`,
    );
  }
});

test("행동의 주체는 처음 받은 카드다 — 도둑이 카드를 바꿔도 말썽꾼은 그대로 움직인다", () => {
  // 자리: 0 도둑, 1 말썽꾼, 2 마을사람, 3 늑대
  const start: Role[] = ["robber", "troublemaker", "villager", W];
  const center: Role[] = ["villager", "seer", W];
  const actions: (NightAction | null)[] = [
    { kind: "robber", seat: 1 }, // 도둑이 말썽꾼 카드를 가져감
    { kind: "troublemaker", seats: [0, 2] }, // 그래도 말썽꾼은 자기 일을 한다
    null,
    null,
  ];
  const night = resolveNight(start, center, actions);
  // 0↔1 교환 뒤 0=troublemaker, 1=robber. 그다음 0↔2 교환.
  assert.deepEqual(night.finalRoles, ["villager", "robber", "troublemaker", W]);
  assert.deepEqual(night.knowledge[0].robbed, { seat: 1, role: "troublemaker" });
  assert.deepEqual(night.knowledge[1].swapped, [0, 2]);
});

test("예언자는 도둑·말썽꾼이 손대기 전의 카드를 본다", () => {
  const start: Role[] = ["seer", "robber", "villager", W];
  const center: Role[] = ["villager", "villager", W];
  const night = resolveNight(start, center, [
    { kind: "seerPlayer", seat: 1 }, // 도둑이 움직이기 전 = robber
    { kind: "robber", seat: 3 }, // 도둑이 늑대 카드를 훔쳐 감
    null,
    null,
  ]);
  assert.deepEqual(night.knowledge[0].seerPeek, { kind: "player", seat: 1, role: "robber" });
  assert.equal(night.finalRoles[1], W, "도둑은 늑대가 되었지만");
  assert.equal(night.knowledge[1].robbed?.role, W, "본인은 그 사실을 안다");
});

test("불면증환자는 밤이 다 끝난 뒤의 자기 카드를 본다", () => {
  const start: Role[] = ["insomniac", "troublemaker", "villager", W];
  const center: Role[] = ["villager", "villager", W];
  const night = resolveNight(start, center, [null, { kind: "troublemaker", seats: [0, 3] }, null, null]);
  assert.equal(night.finalRoles[0], W);
  assert.equal(night.knowledge[0].insomniaSaw, W, "자기가 늑대가 된 걸 알아챈다");
});

test("취객은 뭘 가져왔는지 모른 채 중앙과 바꾼다", () => {
  const start: Role[] = ["drunk", "villager", "villager", "seer"];
  const center: Role[] = ["villager", W, "villager"];
  const night = resolveNight(start, center, [{ kind: "drunk", card: 1 }, null, null, null]);
  assert.equal(night.finalRoles[0], W, "늑대 카드를 집었지만");
  assert.equal(night.knowledge[0].drunkTook, 1, "몇 번을 가져왔는지만 안다");
  assert.equal(night.knowledge[0].insomniaSaw, undefined, "내용은 모른다");
  assert.equal(night.finalCenter[1], "drunk");
});

test("늑대는 혼자일 때만 중앙을 본다", () => {
  const two: Role[] = [W, W, "villager", "seer"];
  const bothWolves = resolveNight(two, ["villager", "villager", "villager"], [
    { kind: "loneWolf", card: 0 },
    null,
    null,
    null,
  ]);
  assert.deepEqual(bothWolves.knowledge[0].wolfPartners, [1]);
  assert.equal(bothWolves.knowledge[0].loneWolfCenter, undefined, "둘이면 중앙을 못 본다");

  const one: Role[] = [W, "villager", "villager", "seer"];
  const alone = resolveNight(one, ["villager", W, "villager"], [{ kind: "loneWolf", card: 1 }, null, null, null]);
  assert.deepEqual(alone.knowledge[0].wolfPartners, []);
  assert.deepEqual(alone.knowledge[0].loneWolfCenter, { index: 1, role: W });
});

test("프리메이슨은 서로를 확인한다", () => {
  const start: Role[] = ["mason", "villager", "mason", W];
  const night = resolveNight(start, ["villager", "villager", W], [null, null, null, null]);
  assert.deepEqual(night.knowledge[0].masonPartners, [2]);
  assert.deepEqual(night.knowledge[2].masonPartners, [0]);
  assert.deepEqual(night.knowledge[1].masonPartners, []);
});

test("아무 행동도 안 고르면 그냥 넘어간다", () => {
  const start: Role[] = ["seer", "robber", "troublemaker", W];
  const center: Role[] = ["villager", "villager", W];
  const night = resolveNight(start, center, [null, null, null, null]);
  assert.deepEqual(night.finalRoles, start, "판이 그대로다");
  assert.equal(night.knowledge[0].seerPeek, undefined);
});

test("잘못된 행동은 무시한다", () => {
  const start: Role[] = ["seer", "robber", "troublemaker", W];
  const center: Role[] = ["villager", "villager", W];
  const night = resolveNight(start, center, [
    { kind: "seerPlayer", seat: 0 }, // 자기 자신은 못 본다
    { kind: "robber", seat: 99 }, // 없는 자리
    { kind: "troublemaker", seats: [2, 3] }, // 자기를 포함할 수 없다
    null,
  ]);
  assert.deepEqual(night.finalRoles, start);
  assert.equal(night.knowledge[0].seerPeek, undefined);
  assert.equal(night.knowledge[1].robbed, undefined);
  assert.equal(night.knowledge[2].swapped, undefined);
});

test("전원이 1표씩 받으면 아무도 죽지 않는다", () => {
  const out = resolveVotes([1, 2, 3, 0], 4);
  assert.deepEqual(out.tally, [1, 1, 1, 1]);
  assert.deepEqual(out.votedOut, []);
});

test("동점이면 동점자가 모두 죽는다", () => {
  const out = resolveVotes([1, 0, 0, 1], 4);
  assert.deepEqual(out.votedOut, [0, 1]);
});

test("기권한 표는 아무에게도 가지 않는다", () => {
  const out = resolveVotes([1, null, 1, null], 4);
  assert.deepEqual(out.tally, [0, 2, 0, 0]);
  assert.deepEqual(out.votedOut, [1]);
});

test("마을은 늑대가 한 명이라도 죽어야 이긴다", () => {
  const roles: Role[] = [W, W, "villager", "seer"];
  assert.deepEqual(judge(roles, [0]).winners, ["village"]);
  assert.deepEqual(judge(roles, [2]).winners, ["werewolf"]);
  assert.deepEqual(judge(roles, []).winners, ["werewolf"], "아무도 안 죽으면 늑대 승");
});

test("늑대가 전부 중앙이면 아무도 안 죽여야 마을이 이긴다", () => {
  const roles: Role[] = ["villager", "seer", "robber", "drunk"];
  assert.deepEqual(judge(roles, []).winners, ["village"]);
  assert.deepEqual(judge(roles, [1]).winners, [], "애먼 사람을 죽이면 아무도 못 이긴다");
});

test("밤에 골라야 하는 역할이 맞다", () => {
  assert.equal(needsNightChoice("seer", 0), true);
  assert.equal(needsNightChoice("robber", 0), true);
  assert.equal(needsNightChoice("troublemaker", 0), true);
  assert.equal(needsNightChoice("drunk", 0), true);
  assert.equal(needsNightChoice("werewolf", 0), true, "혼자인 늑대는 중앙을 고른다");
  assert.equal(needsNightChoice("werewolf", 1), false, "동료가 있으면 확인만 한다");
  assert.equal(needsNightChoice("mason", 0), false);
  assert.equal(needsNightChoice("insomniac", 0), false);
  assert.equal(needsNightChoice("villager", 0), false);
});
