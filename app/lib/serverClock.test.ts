import test from 'node:test';
import assert from 'node:assert/strict';
import { betterSample, clockSample } from './serverClock';

test('clockSample: 서버 시각을 왕복 가운데로 보고 내 시계와의 차이를 잰다', () => {
  // 내 시계 1000에 보내 1200에 받음, 서버는 그 가운데(내 시계 1100)에 6100이었음 → 서버가 5초 빠름
  const s = clockSample(1000, 1200, new Date(6100).toISOString());
  assert.deepEqual(s, { offsetMs: 5000, rttMs: 200 });
  assert.equal(clockSample(1000, 1200, undefined), null);
  assert.equal(clockSample(1000, 1200, 'nope'), null);
});

test('betterSample: 왕복이 짧은 측정을 고른다', () => {
  const slow = { offsetMs: 900, rttMs: 800 };
  const fast = { offsetMs: 1000, rttMs: 50 };
  assert.equal(betterSample(null, slow), slow);
  assert.equal(betterSample(slow, fast), fast);
  assert.equal(betterSample(fast, slow), fast);
  assert.equal(betterSample(fast, null), fast);
});
