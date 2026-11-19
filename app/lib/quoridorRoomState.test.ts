import test from 'node:test';
import assert from 'node:assert/strict';
import { START } from './quoridorMatch.ts';
import type { QuoridorRoom, QuoridorRoomRow } from './quoridorRoom.ts';
import { createQuoridorRoomState, parseQuoridorRoomEvent } from './quoridorRoomState.ts';

const T0 = '2026-11-19T03:00:00.000Z';

const rowFixture = (over: Partial<QuoridorRoomRow> = {}): QuoridorRoomRow => ({
  id: 'room-1', room_name: '벽 쌓기', status: 'playing', host_id: 'a', mode: 2,
  players: [{ id: 'a', name: 'A', seat: 0, left: false, timeouts: 0 }, { id: 'b', name: 'B', seat: 1, left: false, timeouts: 0 }],
  turn_index: 0, pawns: START[2], walls: [], walls_left: [10, 10], moves: [],
  winner_id: null, end_reason: null, turn_limit_sec: 60, version: 5,
  started_at: T0, turn_started_at: T0, created_at: T0, updated_at: T0,
  ...over,
});

const fixture = (over: Partial<QuoridorRoom> = {}): QuoridorRoom => ({ ...parseQuoridorRoomEvent(rowFixture(), 'room-1')!, ...over });

test('낮은 version 스냅샷은 버린다', () => {
  const s = createQuoridorRoomState('room-1');
  s.accept(fixture({ version: 5 }));
  assert.equal(s.accept(fixture({ version: 4 })).room.version, 5);
  assert.equal(s.accept(fixture({ version: 6 })).room.version, 6);
});

test('다른 방 스냅샷은 예외', () => {
  assert.throws(() => createQuoridorRoomState('room-1').accept(fixture({ id: 'room-2' })));
});

test('이벤트 파싱: 필수 필드가 깨지면 null', () => {
  assert.ok(parseQuoridorRoomEvent(rowFixture(), 'room-1'));
  assert.equal(parseQuoridorRoomEvent({ ...rowFixture(), mode: 3 }, 'room-1'), null);
  assert.equal(parseQuoridorRoomEvent({ ...rowFixture(), pawns: 'x' }, 'room-1'), null);
  assert.equal(parseQuoridorRoomEvent(rowFixture(), 'room-2'), null);
});
