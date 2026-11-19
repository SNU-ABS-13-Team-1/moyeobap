import test from 'node:test';
import assert from 'node:assert/strict';
import { START } from './quoridorMatch.ts';
import { SEAT_COLOR_NAMES, mapRoomRow, playerLabel, type QuoridorRoom, type QuoridorRoomRow } from './quoridorRoom.ts';

const T0 = '2026-11-19T03:00:00.000Z';
const base = (over: Partial<QuoridorRoom> = {}): QuoridorRoom => ({
  id: 'r', roomName: '익명', status: 'playing', hostId: 'a', mode: 2, anonymous: true,
  players: [{ id: 'a', name: '민지', seat: 0, left: false, timeouts: 0 }, { id: 'b', name: '철수', seat: 1, left: false, timeouts: 0 }],
  turnIndex: 0, pawns: START[2], walls: [], wallsLeft: [10, 10], moves: [], winnerId: null, endReason: null,
  turnLimitSec: 60, version: 1, startedAt: T0, turnStartedAt: T0, createdAt: T0, updatedAt: T0,
  ...over,
});

test('자리 색 이름은 빨강·파랑·노랑·초록', () => {
  assert.deepEqual(SEAT_COLOR_NAMES, ['빨강', '파랑', '노랑', '초록']);
});

test('익명전 진행 중에는 색 이름만', () => {
  assert.equal(playerLabel(base(), 0), '빨강');
  assert.equal(playerLabel(base(), 1), '파랑');
});

test('익명전이 끝나면 색과 실제 이름을 함께 공개', () => {
  assert.equal(playerLabel(base({ status: 'finished' }), 1), '파랑(철수)');
});

test('익명전 대기실과 일반 방에서는 실제 이름', () => {
  assert.equal(playerLabel(base({ status: 'waiting' }), 0), '민지');
  assert.equal(playerLabel(base({ anonymous: false }), 0), '민지');
});

test('anonymous 컬럼이 없던 옛 행은 일반 방', () => {
  const row = { id: 'r', room_name: 'x', status: 'waiting', host_id: 'a', mode: 2, players: [], turn_index: 0, pawns: [], walls: [],
    walls_left: [], moves: [], winner_id: null, end_reason: null, turn_limit_sec: 60, version: 0, started_at: null,
    turn_started_at: null, created_at: T0, updated_at: T0 } as unknown as QuoridorRoomRow;
  assert.equal(mapRoomRow(row).anonymous, false);
  assert.equal(mapRoomRow({ ...row, anonymous: true }).anonymous, true);
});
