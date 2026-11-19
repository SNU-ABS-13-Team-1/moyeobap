import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEloDeltas } from './quoridorElo.ts';

test('2인 동점: ±16', () => {
  assert.deepEqual(computeEloDeltas({ a: 1200, b: 1200 }, { a: 1, b: 2 }), { a: 16, b: -16 });
});

test('2인 점수 차: 강자 승리는 작게', () => {
  assert.deepEqual(computeEloDeltas({ a: 1400, b: 1200 }, { a: 1, b: 2 }), { a: 8, b: -8 });
});

test('4인 동점: 1위 +16, 2위 +5, 3위 -5, 4위 -16', () => {
  assert.deepEqual(
    computeEloDeltas({ a: 1200, b: 1200, c: 1200, d: 1200 }, { a: 1, b: 2, c: 3, d: 4 }),
    { a: 16, b: 5, c: -5, d: -16 },
  );
});

test('4인 약자 1위는 변동이 더 큼', () => {
  const d = computeEloDeltas({ a: 1000, b: 1200, c: 1200, d: 1200 }, { a: 1, b: 2, c: 3, d: 4 });
  assert.equal(d.a, 24);
  assert.ok(d.a > 16);
});
