import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { START } from './quoridorMatch.ts';
import {
  planRestart,
  planResign,
  planStart,
  planTimeout,
  planTurn,
  updateRoomCas,
  type QuoridorRoom,
  type QuoridorRoomRow,
  type RoomPlayer,
} from './quoridorRoom.ts';

const T0 = '2026-11-19T03:00:00.000Z';

const p = (id: string, seat: number | null): RoomPlayer => ({ id, name: id.toUpperCase(), seat, left: false, timeouts: 0 });

const room = (over: Partial<QuoridorRoom> = {}): QuoridorRoom => ({
  id: 'room-1',
  roomName: '벽 쌓기',
  status: 'playing',
  hostId: 'a',
  mode: 2,
  anonymous: false,
  players: [p('a', 0), p('b', 1)],
  turnIndex: 0,
  pawns: START[2].map((c) => ({ ...c })),
  walls: [],
  wallsLeft: [10, 10],
  moves: [],
  winnerId: null,
  endReason: null,
  turnLimitSec: 60,
  version: 3,
  startedAt: T0,
  turnStartedAt: T0,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

const room4 = (over: Partial<QuoridorRoom> = {}): QuoridorRoom =>
  room({
    mode: 4,
    players: [p('a', 0), p('b', 1), p('c', 2), p('d', 3)],
    pawns: START[4].map((c) => ({ ...c })),
    wallsLeft: [5, 5, 5, 5],
    ...over,
  });

const row = (over: Partial<QuoridorRoomRow> = {}): QuoridorRoomRow => {
  const r = room();
  return {
    id: r.id,
    room_name: r.roomName,
    status: r.status,
    host_id: r.hostId,
    mode: r.mode,
    players: r.players,
    turn_index: r.turnIndex,
    pawns: r.pawns,
    walls: r.walls,
    walls_left: r.wallsLeft,
    moves: r.moves,
    winner_id: r.winnerId,
    end_reason: r.endReason,
    turn_limit_sec: r.turnLimitSec,
    version: r.version,
    started_at: r.startedAt,
    turn_started_at: r.turnStartedAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    ...over,
  };
};

/** from('quoridor_rooms').update().eq().eq().select().maybeSingle() 체인만 흉내 내는 가짜 클라이언트. */
function fakeDb(initial: QuoridorRoomRow) {
  const state: { row: Record<string, unknown>; lastFilter: Record<string, unknown>; fail: boolean } = { row: { ...initial }, lastFilter: {}, fail: false };
  const client = {
    from(table: string) {
      assert.equal(table, 'quoridor_rooms');
      return {
        update(patch: Record<string, unknown>) {
          const filter: Record<string, unknown> = {};
          const chain = {
            eq(column: string, value: unknown) {
              filter[column] = value;
              return chain;
            },
            select() {
              return chain;
            },
            async maybeSingle() {
              state.lastFilter = filter;
              if (state.fail) return { data: null, error: { message: 'db down' } };
              if (!Object.entries(filter).every(([k, v]) => state.row[k] === v)) return { data: null, error: null };
              state.row = { ...state.row, ...patch };
              return { data: state.row, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { db: client as unknown as SupabaseClient, state };
}

test('planStart: 방장만, 인원이 mode와 같아야, 섞은 순서대로 자리', () => {
  const waiting = room({ status: 'waiting', players: [p('a', null), p('b', null)] });
  assert.deepEqual(planStart(waiting, 'b', (x) => x, T0), { error: '방장만 시작할 수 있어요.' });
  assert.deepEqual(planStart({ ...waiting, players: [p('a', null)] }, 'a', (x) => x, T0), { error: '2명이 모여야 시작할 수 있어요.' });
  const ok = planStart(waiting, 'a', (x) => [...x].reverse(), T0);
  assert.ok('patch' in ok);
  assert.deepEqual(ok.patch.players!.map((q) => [q.id, q.seat]), [['b', 0], ['a', 1]]);
  assert.equal(ok.patch.turn_index, 0);
  assert.deepEqual(ok.patch.walls_left, [10, 10]);
});

test('planRestart: 인원이 차면 바로 시작, 모자라면 나간 사람을 빼고 대기로', () => {
  const full = planRestart(room4({ status: 'finished' }), 'a', (x) => x, T0);
  assert.ok('patch' in full && full.patch.status === 'playing' && full.patch.players!.length === 4);
  const short = planRestart(room4({ status: 'finished', players: room4().players.map((q) => ({ ...q, left: q.id === 'c' })) }), 'a', (x) => x, T0);
  assert.ok('patch' in short && short.patch.status === 'waiting');
  assert.deepEqual(short.patch.players!.map((q) => [q.id, q.seat]), [['a', null], ['b', null], ['d', null]]);
  assert.deepEqual(planRestart(room4(), 'a', (x) => x, T0), { error: '끝난 방에서만 다시 시작할 수 있어요.' });
});

test('planTurn: 차례·표기 검증', () => {
  assert.deepEqual(planTurn(room(), 'b', 'e8', T0), { error: '내 차례가 아니에요.' });
  assert.deepEqual(planTurn(room(), 'a', 42, T0), { error: '잘못된 수예요.' });
  assert.deepEqual(planTurn(room(), 'a', 'e3', T0), { error: '갈 수 없는 칸이에요.' });
  const ok = planTurn(room(), 'a', 'e2', T0);
  assert.ok('patch' in ok && ok.finished === null);
  assert.deepEqual(ok.patch.pawns![0], { r: 1, c: 4 });
  assert.equal(ok.patch.turn_index, 1);
  assert.deepEqual(ok.patch.moves!.at(-1), { seat: 0, move: 'e2' });
});

test('planTurn: 벽 놓기 실패 문구', () => {
  const r = room({ walls: [{ r: 2, c: 4, o: 'h' }] });
  assert.deepEqual(planTurn(r, 'a', 'f3h', T0), { error: '벽을 놓을 수 없어요.' });
});

test('승리 즉시 종료, 종료 후 수 거부', () => {
  const r = room({ pawns: [{ r: 7, c: 4 }, { r: 8, c: 0 }] });
  const win = planTurn(r, 'a', 'e9', T0);
  assert.ok('patch' in win);
  assert.deepEqual(win.finished, { winnerId: 'a', reason: 'goal' });
  assert.equal(win.patch.status, 'finished');
  assert.deepEqual(planTurn(room({ status: 'finished' }), 'a', 'e2', T0), { error: '진행 중인 게임이 아니에요.' });
});

test('4인 시계 방향 턴, 나간 사람 건너뛰기', () => {
  const r = room4();
  const t1 = planTurn(r, 'a', 'e2', T0);
  assert.ok('patch' in t1 && t1.patch.turn_index === 1);
  const skip = planTurn(room4({ players: room4().players.map((q) => (q.id === 'b' ? { ...q, left: true } : q)) }), 'a', 'e2', T0);
  assert.ok('patch' in skip && skip.patch.turn_index === 2);
});

test('수가 없는 다음 사람은 자동으로 넘김(pass 기록)', () => {
  // 1번(a1)은 Task 3의 stuck 배치와 같다: 오른쪽 벽, 위 2번 말, 그 뒤 3번 말, 남은 벽 0.
  const r = room4({
    turnIndex: 0,
    pawns: [{ r: 4, c: 4 }, { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }],
    walls: [{ r: 0, c: 0, o: 'v' }],
    wallsLeft: [5, 0, 5, 5],
  });
  const t = planTurn(r, 'a', 'e6', T0);
  assert.ok('patch' in t);
  assert.equal(t.patch.turn_index, 2); // 2번은 3번을 뛰어넘을 수 있으므로 차례를 받음
  assert.deepEqual(t.patch.moves!.slice(-2).map((m) => [m.seat, m.move]), [[0, 'e6'], [1, 'pass']]);
});

test('시간 초과: 신고 시각 검증, 넘김, 3회째 자동 기권', () => {
  const early = Date.parse(T0) + 60_000;
  assert.deepEqual(planTimeout(room(), 'b', early, T0), { error: '아직 시간이 남아 있어요.' });
  const late = Date.parse(T0) + 63_000;
  assert.deepEqual(planTimeout(room(), 'x', late, T0), { error: '참여자만 할 수 있어요.' });
  const t = planTimeout(room(), 'b', late, T0);
  assert.ok('patch' in t && t.patch.turn_index === 1 && t.patch.players![0].timeouts === 1);
  const third = planTimeout(room({ players: [{ ...p('a', 0), timeouts: 2 }, p('b', 1)] }), 'b', late, T0);
  assert.ok('patch' in third);
  assert.deepEqual(third.finished, { winnerId: 'b', reason: 'others_left' });
  // 차례가 나간 사람에게 가 있는 비정상 상태: 벌점 없이 넘김
  const ghost = planTimeout(room4({ players: room4().players.map((q) => ({ ...q, left: q.id === 'a' })) }), 'b', late, T0);
  assert.ok('patch' in ghost && ghost.patch.turn_index === 1 && ghost.patch.players![0].timeouts === 0);
});

test('기권: 4인은 계속, 1명 남으면 종료, 나간 사람 차례면 넘김', () => {
  const r = planResign(room4(), 'a', T0);
  assert.ok('patch' in r && r.finished === null && r.patch.turn_index === 1 && r.patch.host_id === 'b');
  assert.deepEqual(planResign(room4({ players: room4().players.map((q) => ({ ...q, left: q.id === 'a' })) }), 'a', T0),
    { error: '이미 나간 사람이에요.' });
  const last = planResign(room4({ players: room4().players.map((q) => ({ ...q, left: q.id === 'c' || q.id === 'd' })) }), 'a', T0);
  assert.ok('patch' in last);
  assert.deepEqual(last.finished, { winnerId: 'b', reason: 'others_left' });
});

test('updateRoomCas: version이 맞으면 갱신, 다르면 null', async () => {
  const { db, state } = fakeDb(row({ version: 3 }));
  assert.equal((await updateRoomCas(db, room({ version: 3 }), { turn_index: 1 }, T0))?.version, 4);
  assert.equal(await updateRoomCas(db, room({ version: 3 }), { turn_index: 0 }, T0), null); // 이미 4
  assert.deepEqual(state.lastFilter, { id: 'room-1', version: 3 });
});

test('updateRoomCas: DB 오류는 충돌(null)과 구분해 예외로 알린다', async () => {
  const { db, state } = fakeDb(row({ version: 3 }));
  state.fail = true;
  await assert.rejects(updateRoomCas(db, room({ version: 3 }), { turn_index: 1 }, T0));
});

const OFF = { r: -1, c: -1 };
const ranks = (players: RoomPlayer[] | undefined) => (players ?? []).map((q) => [q.id, q.rank ?? null, q.left]);

test('4인: 첫 도착은 1위, 말은 보드에서 빠지고 남은 사람끼리 계속', () => {
  const r = room4({ pawns: [{ r: 7, c: 4 }, { r: 4, c: 0 }, { r: 8, c: 2 }, { r: 4, c: 8 }] });
  const t = planTurn(r, 'a', 'e9', T0);
  assert.ok('patch' in t);
  assert.equal(t.finished, null);
  assert.equal(t.patch.status, undefined);
  assert.deepEqual(t.patch.pawns![0], OFF);
  assert.equal(t.patch.turn_index, 1);
  assert.deepEqual(ranks(t.patch.players), [['a', 1, false], ['b', null, false], ['c', null, false], ['d', null, false]]);
});

test('4인: 3위가 도착하면 마지막 사람이 4위, 1위가 승자로 끝', () => {
  const players = [{ ...p('a', 0), rank: 1 }, { ...p('b', 1), rank: 2 }, p('c', 2), p('d', 3)];
  const r = room4({ players, turnIndex: 2, pawns: [OFF, OFF, { r: 1, c: 4 }, { r: 4, c: 8 }] });
  const t = planTurn(r, 'c', 'e1', T0);
  assert.ok('patch' in t);
  assert.deepEqual(t.finished, { winnerId: 'a', reason: 'goal' });
  assert.equal(t.patch.status, 'finished');
  assert.deepEqual(ranks(t.patch.players), [['a', 1, false], ['b', 2, false], ['c', 3, false], ['d', 4, false]]);
});

test('4인: 나간 사람은 아래부터(먼저 나간 사람이 4위), 끝까지 남은 사람이 남은 최고 순위', () => {
  const first = planResign(room4(), 'b', T0);
  assert.ok('patch' in first && first.finished === null);
  assert.deepEqual(ranks(first.patch.players), [['a', null, false], ['b', 4, true], ['c', null, false], ['d', null, false]]);
  const afterB = room4({ players: first.patch.players });
  const second = planResign(afterB, 'c', T0);
  assert.ok('patch' in second && second.finished === null);
  const afterC = room4({ players: second.patch.players });
  const last = planResign(afterC, 'a', T0);
  assert.ok('patch' in last);
  assert.deepEqual(last.finished, { winnerId: 'd', reason: 'others_left' });
  assert.deepEqual(ranks(last.patch.players), [['a', 2, true], ['b', 4, true], ['c', 3, true], ['d', 1, false]]);
});

test('4인: 1위가 이미 나온 뒤 나머지가 다 나가면 남은 사람은 2위, 승자는 1위', () => {
  const players = [{ ...p('a', 0), rank: 1 }, { ...p('b', 1), left: true, rank: 4 }, p('c', 2), p('d', 3)];
  const t = planResign(room4({ players, turnIndex: 2, pawns: [OFF, START[4][1], START[4][2], START[4][3]] }), 'c', T0);
  assert.ok('patch' in t);
  assert.deepEqual(t.finished, { winnerId: 'a', reason: 'goal' });
  assert.deepEqual(ranks(t.patch.players), [['a', 1, false], ['b', 4, true], ['c', 3, true], ['d', 2, false]]);
});

test('도착한 사람이 방을 나가도 순위는 그대로이고 판은 계속', () => {
  const players = [{ ...p('a', 0), rank: 1 }, p('b', 1), p('c', 2), p('d', 3)];
  const t = planResign(room4({ players, turnIndex: 1, pawns: [OFF, START[4][1], START[4][2], START[4][3]] }), 'a', T0);
  assert.ok('patch' in t && t.finished === null);
  assert.deepEqual(ranks(t.patch.players)[0], ['a', 1, true]);
  assert.equal(t.patch.turn_index, undefined); // 차례는 그대로(b)
});

test('2인: 승리는 1·2위, 기권은 나간 사람 2위', () => {
  const win = planTurn(room({ pawns: [{ r: 7, c: 4 }, { r: 8, c: 0 }] }), 'a', 'e9', T0);
  assert.ok('patch' in win);
  assert.deepEqual(ranks(win.patch.players), [['a', 1, false], ['b', 2, false]]);
  const resign = planResign(room(), 'a', T0);
  assert.ok('patch' in resign);
  assert.deepEqual(ranks(resign.patch.players), [['a', 2, true], ['b', 1, false]]);
});
