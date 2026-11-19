import test from 'node:test';
import assert from 'node:assert/strict';
import { timeoutRetryDelay } from './quoridorRoom.ts';

test('시간 초과 신고는 실패 종류와 상관없이 간격을 늘려 몇 번 더 보내고 멈춘다', () => {
  assert.equal(timeoutRetryDelay(0), 2000);
  assert.equal(timeoutRetryDelay(1), 4000);
  assert.equal(timeoutRetryDelay(2), 8000);
  assert.equal(timeoutRetryDelay(3), 16000);
  assert.equal(timeoutRetryDelay(4), null);
});
