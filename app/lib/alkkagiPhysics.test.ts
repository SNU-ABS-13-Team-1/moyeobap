import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOARD_SIZE,
  MAX_SHOT_SPEED,
  STONE_RADIUS,
  STONES_PER_SIDE,
  clampShot,
  initialStones,
  previewPath,
  simulateShot,
  type Stone,
} from "./alkkagiPhysics.ts";

test("시작 배치는 흑백 5개씩이고 모두 판 안에 있다", () => {
  const stones = initialStones();
  assert.equal(stones.length, STONES_PER_SIDE * 2);
  assert.equal(stones.filter((s) => s.owner === "black").length, STONES_PER_SIDE);
  assert.equal(stones.filter((s) => s.owner === "white").length, STONES_PER_SIDE);
  for (const stone of stones) {
    assert.ok(stone.x > STONE_RADIUS && stone.x < BOARD_SIZE - STONE_RADIUS);
    assert.ok(stone.y > STONE_RADIUS && stone.y < BOARD_SIZE - STONE_RADIUS);
  }
  // 흑은 아래(y가 큼), 백은 위
  const black = stones.filter((s) => s.owner === "black")[0];
  const white = stones.filter((s) => s.owner === "white")[0];
  assert.ok(black.y > white.y);
});

test("아무 것도 맞히지 않으면 굴러가다 멈추고 아무도 떨어지지 않는다", () => {
  const stones: Stone[] = [{ id: "b0", owner: "black", x: 320, y: 580 }];
  const result = simulateShot(stones, { stoneId: "b0", vx: 0, vy: -400 });
  assert.equal(result.removed.length, 0);
  assert.equal(result.stones.length, 1);
  assert.ok(result.stones[0].y < 580, "위로 이동했어야 한다");
  assert.ok(result.stones[0].y > STONE_RADIUS, "판 안에 남아야 한다");
  assert.ok(result.durationMs > 0);
});

test("정면으로 맞히면 맞은 돌이 앞으로 나가고 친 돌은 거의 선다", () => {
  const stones: Stone[] = [
    { id: "b0", owner: "black", x: 320, y: 400 },
    { id: "w0", owner: "white", x: 320, y: 300 },
  ];
  const result = simulateShot(stones, { stoneId: "b0", vx: 0, vy: -900 });
  const b0 = result.stones.find((s) => s.id === "b0");
  const w0 = result.stones.find((s) => s.id === "w0");
  assert.ok(w0 === undefined || w0.y < 300, "맞은 돌이 앞으로 밀려야 한다");
  if (b0 && w0) {
    assert.ok(b0.y - w0.y >= 2 * STONE_RADIUS - 1, "두 돌이 겹치면 안 된다");
  }
});

test("판 끝으로 민 돌은 제거되고, 걸친 돌은 살아남는다", () => {
  const out = simulateShot(
    [{ id: "b0", owner: "black", x: 320, y: 100 }],
    { stoneId: "b0", vx: 0, vy: -MAX_SHOT_SPEED },
  );
  assert.deepEqual(out.removed, ["b0"]);
  assert.equal(out.stones.length, 0);

  // 중심이 판 안에 남을 만큼만 민다(중심 기준 판정이므로 반쯤 걸쳐도 산다)
  const edge = simulateShot(
    [{ id: "b0", owner: "black", x: 320, y: 300 }],
    { stoneId: "b0", vx: 0, vy: -700 },
  );
  assert.equal(edge.removed.length, 0);
  const moved = edge.stones[0];
  assert.ok(moved.y >= 0 && moved.y <= BOARD_SIZE);
});

test("같은 입력은 항상 같은 결과를 낸다", () => {
  const stones = initialStones();
  const shot = { stoneId: "b2", vx: 137.5, vy: -880.25 };
  const a = simulateShot(stones, shot);
  const b = simulateShot(stones, shot);
  assert.deepEqual(a, b);
});

test("어떤 샷이든 8초 안에 모두 멈춘다", () => {
  const stones = initialStones();
  for (const angle of [0, 0.4, -0.4, 1.2, -1.2]) {
    const result = simulateShot(stones, {
      stoneId: "b0",
      vx: Math.sin(angle) * MAX_SHOT_SPEED,
      vy: -Math.cos(angle) * MAX_SHOT_SPEED,
    });
    assert.ok(result.durationMs <= 8000, `${angle}: ${result.durationMs}ms`);
  }
});

test("clampShot은 최대 속도를 넘는 샷을 잘라낸다", () => {
  const clamped = clampShot({ stoneId: "b0", vx: 9000, vy: 0 });
  assert.ok(Math.hypot(clamped.vx, clamped.vy) <= MAX_SHOT_SPEED + 1e-6);
  const kept = clampShot({ stoneId: "b0", vx: 300, vy: -400 });
  assert.equal(Math.round(Math.hypot(kept.vx, kept.vy)), 500);
});

test("예측 경로는 첫 충돌에서 멈춘다", () => {
  const stones: Stone[] = [
    { id: "b0", owner: "black", x: 320, y: 500 },
    { id: "w0", owner: "white", x: 320, y: 200 },
  ];
  const path = previewPath(stones, { stoneId: "b0", vx: 0, vy: -MAX_SHOT_SPEED });
  assert.ok(path.length >= 2);
  const last = path[path.length - 1];
  // 흰 돌에 닿는 지점(중심 거리 2R)에서 끊겨야 한다
  assert.ok(last.y - 200 <= 2 * STONE_RADIUS + 10, `마지막 지점 y=${last.y}`);
  assert.ok(last.y > 200, "흰 돌을 지나쳐 그리면 안 된다");
});
