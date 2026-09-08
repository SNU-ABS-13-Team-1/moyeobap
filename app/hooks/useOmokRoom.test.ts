import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement, useEffect, useState } from 'react';
import { mapOmokRoomRow, type OmokRoomRow } from '../lib/omokRoomState.ts';
import { remainingTurnMs } from '../lib/omokMatch.ts';
import type { createSupabaseBrowserClient } from '../lib/supabase/client.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { createRoot } = await import('react-dom/client');
// SWR의 기본 DOM 리스너는 이벤트를 setTimeout의 두 번째 인자로 넘깁니다.
// 브라우저처럼 숫자가 아닌 delay를 0으로 처리해 Node 전용 NaN 경고를 피합니다.
const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) =>
  nativeTimeout(handler, typeof delay === 'number' ? delay : 0, ...args)) as typeof setTimeout;
const { SWRConfig } = await import('swr');
globalThis.setTimeout = nativeTimeout;
const { useOmokRoom } = await import('./useOmokRoom.ts');

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
class Channel {
  active = true;
  receive?: (payload: { new: unknown }) => void;
  status?: (status: Status) => void;
  constructor(readonly fixture: Fixture, readonly userId: string) {}
  on(_type: string, _filter: unknown, receive: Channel['receive']) { this.receive = receive; return this; }
  subscribe(status: NonNullable<Channel['status']>) {
    this.status = status;
    status(this.fixture.connected ? 'SUBSCRIBED' : 'CHANNEL_ERROR');
    return this;
  }
}
const T0 = Date.parse('2026-09-08T01:00:00.000Z');
const row = (): OmokRoomRow => ({
  id: 'room-1', room_name: '동기화 테스트', status: 'playing',
  black_id: 'black-user', black_name: '흑', white_id: 'white-user', white_name: '백',
  board: Array.from({ length: 15 }, () => Array(15).fill(null)), turn: 'black',
  winner: null, move_count: 0, last_row: null, last_col: null,
  started_at: new Date(T0).toISOString(), turn_started_at: new Date(T0).toISOString(),
  rematch_by: null, created_at: new Date(T0).toISOString(), updated_at: new Date(T0).toISOString(),
});
type View = ReturnType<typeof useOmokRoom> & { now: number };
class Fixture {
  server = row();
  gets = 0;
  posts = 0;
  connected = true;
  hidden = false;
  online = true;
  channels: Channel[] = [];
  views = new Map<string, View>();
  deferredGet?: (response: Response) => void;
  holdGet = false;
  holdPost = false;
  deferredPost?: (response: Response) => void;
  failReads = false;
  factories = new Map<string, typeof createSupabaseBrowserClient>();
  client(userId: string) {
    if (!this.factories.has(userId)) this.factories.set(userId, (() => ({
      channel: () => {
        const channel = new Channel(this, userId);
        this.channels.push(channel);
        return channel;
      },
      removeChannel: async (channel: Channel) => { channel.active = false; channel.status?.('CLOSED'); return 'ok'; },
    })) as unknown as typeof createSupabaseBrowserClient);
    return this.factories.get(userId)!;
  }
  emit(value: unknown = this.server) {
    for (const channel of this.channels) if (channel.active) channel.receive?.({ new: structuredClone(value) });
  }
  fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      this.posts++;
      const { row: r, col: c } = JSON.parse(String(init.body));
      this.server = structuredClone(this.server);
      this.server.board[r][c] = this.server.turn;
      this.server.turn = this.server.turn === 'black' ? 'white' : 'black';
      this.server.move_count++;
      this.server.last_row = r;
      this.server.last_col = c;
      this.server.turn_started_at = new Date(Date.now()).toISOString();
      this.server.updated_at = new Date(Date.now()).toISOString();
      // DB 변경 이벤트가 착수자의 HTTP 응답보다 먼저 도착하는 순서도 재현합니다.
      this.emit();
      if (this.holdPost) {
        this.holdPost = false;
        return new Promise<Response>(resolve => { this.deferredPost = resolve; });
      }
      return Response.json({ room: mapOmokRoomRow(this.server) });
    }
    this.gets++;
    if (this.failReads) throw new Error('offline');
    if (this.holdGet) {
      this.holdGet = false;
      return new Promise<Response>(resolve => { this.deferredGet = resolve; });
    }
    return Response.json({ room: mapOmokRoomRow(this.server) });
  };
}

async function mount(t: TestContext, players = ['black-user', 'white-user']) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 + 1000 });
  const fixture = new Fixture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fixture.fetch;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => fixture.hidden ? 'hidden' : 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => fixture.online });
  function Client({ userId }: { userId: string }) {
    const view = useOmokRoom('room-1', userId, fixture.client(userId));
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
      const timer = setInterval(() => setNow(Date.now()), 250);
      return () => clearInterval(timer);
    }, []);
    fixture.views.set(userId, { ...view, now });
    return createElement('p', { 'data-player': userId }, `${view.room?.turn}:${view.room?.moveCount}`);
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let unmounted = false;
  const unmount = async () => {
    if (unmounted) return;
    await act(async () => root.unmount());
    unmounted = true;
  };
  t.after(async () => {
    await unmount();
    container.remove();
    globalThis.fetch = originalFetch;
    t.mock.timers.reset();
  });
  await act(async () => root.render(createElement('div', {}, ...players.map(userId => createElement(SWRConfig, {
    key: userId, value: { provider: () => new Map() },
  }, createElement(Client, { userId }))))));
  const tick = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 250) await act(async () => t.mock.timers.tick(Math.min(250, ms - elapsed)));
  };
  return { fixture, tick, unmount };
}

test('two clients: each confirmed move immediately updates the opponent board, turn and clock with no GET', async t => {
  const { fixture: f, tick } = await mount(t);
  const gets = f.gets;
  await tick(250);
  await act(async () => { await f.views.get('black-user')!.sendAction('move', { row: 7, col: 7 }); });
  const white = f.views.get('white-user')!;
  assert.equal(white.room?.board[7][7], 'black');
  assert.equal(white.room?.turn, 'white');
  assert.equal(remainingTurnMs(white.room!.turnStartedAt, white.now), 30000);
  assert.equal(f.gets, gets);
  await tick(250);
  await act(async () => { await f.views.get('white-user')!.sendAction('move', { row: 7, col: 8 }); });
  assert.equal(f.views.get('black-user')?.room?.turn, 'black');
  assert.equal(f.views.get('black-user')?.room?.board[7][8], 'white');
  assert.equal(f.gets, gets);
  assert.equal(f.posts, 2);
});

test('own move response is applied even when its realtime event is missing', async t => {
  const { fixture: f } = await mount(t, ['black-user']);
  const gets = f.gets;
  f.emit = () => {};
  await act(async () => { await f.views.get('black-user')!.sendAction('move', { row: 0, col: 0 }); });
  assert.equal(f.views.get('black-user')!.room?.turn, 'white');
  assert.equal(f.views.get('black-user')!.room?.board[0][0], 'black');
  assert.equal(f.gets, gets);
});

test('a delayed GET and duplicate older event cannot revert a received move', async t => {
  const { fixture: f } = await mount(t, ['white-user']);
  const old = structuredClone(f.server);
  f.holdGet = true;
  let pending: Promise<unknown>;
  await act(async () => { pending = f.views.get('white-user')!.synchronize(); });
  f.server.board[7][7] = 'black';
  f.server.turn = 'white';
  f.server.move_count = 1;
  f.server.updated_at = new Date(Date.now()).toISOString();
  await act(async () => { f.emit(); });
  await act(async () => { f.deferredGet!(Response.json({ room: mapOmokRoomRow(old) })); await pending; });
  await act(async () => { f.emit(old); });
  assert.equal(f.views.get('white-user')?.room?.moveCount, 1);
  assert.equal(f.views.get('white-user')?.room?.turn, 'white');
});

test('rematch starts a new round and ignores late moves from the previous round', async t => {
  const { fixture: f, tick } = await mount(t, ['white-user']);
  const previous = { ...row(), move_count: 20, status: 'finished' as const, winner: 'black' as const };
  await act(async () => { f.emit(previous); });
  await tick(250);
  f.server = { ...row(), started_at: new Date(Date.now()).toISOString(), updated_at: new Date(Date.now()).toISOString() };
  await act(async () => { f.emit(); f.emit(previous); });
  assert.equal(f.views.get('white-user')?.room?.moveCount, 0);
  assert.equal(f.views.get('white-user')?.room?.status, 'playing');
});

test('clock renders do not reset the 20-second safety poll, and hidden tabs make no polls', async t => {
  const { fixture: f, tick } = await mount(t, ['white-user']);
  const gets = f.gets;
  await tick(19750);
  assert.equal(f.gets, gets);
  await tick(250);
  assert.equal(f.gets, gets + 1);
  f.hidden = true;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  await tick(60000);
  assert.equal(f.gets, gets + 1);
  f.hidden = false;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.equal(f.gets, gets + 2);
});

test('reconnect immediately catches up a missed move, and cleanup stops subscriptions and retries', async t => {
  const { fixture: f, tick, unmount } = await mount(t, ['white-user']);
  const original = f.channels.at(-1)!;
  await act(async () => { original.status!('CHANNEL_ERROR'); });
  assert.equal(f.views.get('white-user')?.reconnecting, true);
  f.server = { ...f.server, turn: 'white', move_count: 1, updated_at: new Date(Date.now()).toISOString() };
  await tick(1000);
  assert.equal(original.active, false);
  assert.equal(f.views.get('white-user')?.room?.turn, 'white');
  assert.equal(f.views.get('white-user')?.reconnecting, false);
  await unmount();
  const gets = f.gets;
  await tick(60000);
  assert.equal(f.gets, gets);
  assert.ok(f.channels.every(channel => !channel.active));
});

test('persistent websocket failure uses at most three retry subscriptions', async t => {
  const { fixture: f, tick } = await mount(t, ['white-user']);
  const before = f.channels.length;
  f.connected = false;
  await act(async () => { f.channels.at(-1)!.status!('CHANNEL_ERROR'); });
  await tick(60000);
  assert.equal(f.channels.length, before + 3);
  assert.equal(f.views.get('white-user')?.reconnecting, true);
});

test('incomplete event requests a snapshot, while an event for another room cannot overwrite this board', async t => {
  const { fixture: f } = await mount(t, ['white-user']);
  const gets = f.gets;
  await act(async () => { f.emit({ id: 'room-1', turn: 'white' }); });
  assert.equal(f.gets, gets + 1);
  await act(async () => { f.emit({ ...row(), id: 'other-room', move_count: 99 }); });
  assert.equal(f.views.get('white-user')?.room?.id, 'room-1');
  assert.equal(f.views.get('white-user')?.room?.moveCount, 0);
});

test('late own move response does not overwrite the opponent reply', async t => {
  const { fixture: f, tick } = await mount(t);
  f.holdPost = true;
  let pending: Promise<void>;
  await act(async () => { pending = f.views.get('black-user')!.sendAction('move', { row: 7, col: 7 }); });
  const afterFirstMove = structuredClone(f.server);
  await tick(250);
  await act(async () => { await f.views.get('white-user')!.sendAction('move', { row: 7, col: 8 }); });
  await act(async () => {
    f.deferredPost!(Response.json({ room: mapOmokRoomRow(afterFirstMove) }));
    await pending;
  });
  assert.equal(f.views.get('black-user')!.room?.moveCount, 2);
  assert.equal(f.views.get('black-user')!.room?.turn, 'black');
});

test('failed read retries are cancelled when the tab becomes hidden', async t => {
  const { fixture: f, tick } = await mount(t, ['white-user']);
  f.failReads = true;
  await act(async () => { await f.views.get('white-user')!.synchronize().catch(() => {}); });
  f.hidden = true;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  const gets = f.gets;
  await tick(120000);
  assert.equal(f.gets, gets);
});
