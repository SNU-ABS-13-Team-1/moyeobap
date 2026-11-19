import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEloDeltas } from './quoridorElo.ts';

test('2인 동점: ±16', () => {
  assert.deepEqual(computeEloDeltas({ a: 1200, b: 1200 }, 'a', 2), { a: 16, b: -16 });
});

test('2인 점수 차: 강자 승리는 작게', () => {
  assert.deepEqual(computeEloDeltas({ a: 1400, b: 1200 }, 'a', 2), { a: 8, b: -8 });
});

test('4인 동점: 승자 +16, 패자 -5', () => {
  assert.deepEqual(computeEloDeltas({ a: 1200, b: 1200, c: 1200, d: 1200 }, 'a', 4), { a: 16, b: -5, c: -5, d: -5 });
});

test('4인 약자 승리는 변동이 더 큼', () => {
  const d = computeEloDeltas({ a: 1000, b: 1200, c: 1200, d: 1200 }, 'a', 4);
  assert.deepEqual(d, { a: 24, b: -8, c: -8, d: -8 });
  assert.ok(d.a > 16);
});
