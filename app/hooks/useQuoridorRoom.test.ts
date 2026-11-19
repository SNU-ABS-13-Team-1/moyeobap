import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { START } from '../lib/quoridorMatch.ts';
import { mapRoomRow, type QuoridorRoomRow } from '../lib/quoridorRoom.ts';
import type { createSupabaseBrowserClient } from '../lib/supabase/client.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { createRoot } = await import('react-dom/client');
// SWR의 기본 DOM 리스너는 이벤트를 setTimeout의 두 번째 인자로 넘깁니다(useOmokRoom.test.ts와 같은 처리).
const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) =>
  nativeTimeout(handler, typeof delay === 'number' ? delay : 0, ...args)) as typeof setTimeout;
const { SWRConfig } = await import('swr');
globalThis.setTimeout = nativeTimeout;
const { useQuoridorRoom } = await import('./useQuoridorRoom.ts');

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
class Channel {
  active = true;
  receive?: (payload: { new: unknown }) => void;
  status?: (status: Status) => void;
  constructor(readonly fixture: Fixture) {}
  on(_type: string, _filter: unknown, receive: Channel['receive']) { this.receive = receive; return this; }
  subscribe(status: NonNullable<Channel['status']>) {
    this.status = status;
    status('SUBSCRIBED');
    return this;
  }
}

const T0 = Date.parse('2026-11-19T03:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();
const row = (): QuoridorRoomRow => ({
  id: 'room-1', room_name: '벽 쌓기', status: 'playing', host_id: 'a', mode: 2,
  players: [{ id: 'a', name: 'A', seat: 0, left: false, timeouts: 0 }, { id: 'b', name: 'B', seat: 1, left: false, timeouts: 0 }],
  turn_index: 0, pawns: START[2], walls: [], walls_left: [10, 10], moves: [],
  winner_id: null, end_reason: null, turn_limit_sec: 60, version: 5,
  started_at: iso(T0), turn_started_at: iso(T0), created_at: iso(T0), updated_at: iso(T0),
});

type View = ReturnType<typeof useQuoridorRoom>;
class Fixture {
  server = row();
  gets = 0;
  channels: Channel[] = [];
  removed = 0;
  view?: View;
  holdGet = false;
  deferredGet?: (response: Response) => void;
  factory = (() => ({
    channel: () => {
      const channel = new Channel(this);
      this.channels.push(channel);
      return channel;
    },
    removeChannel: async (channel: Channel) => { channel.active = false; this.removed++; return 'ok'; },
  })) as unknown as typeof createSupabaseBrowserClient;
  emit(value: unknown = this.server) {
    for (const channel of this.channels) if (channel.active) channel.receive?.({ new: structuredClone(value) });
  }
  advance() {
    this.server = { ...structuredClone(this.server), version: this.server.version + 1, turn_index: 1 - this.server.turn_index, updated_at: iso(Date.now()) };
  }
  fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      this.advance();
      return Response.json({ room: mapRoomRow(this.server) });
    }
    this.gets++;
    if (this.holdGet) {
      this.holdGet = false;
      return new Promise<Response>((resolve) => { this.deferredGet = resolve; });
    }
    return Response.json({ room: mapRoomRow(this.server) });
  };
}

async function mount(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 + 1000 });
  const fixture = new Fixture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fixture.fetch;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  function Client() {
    fixture.view = useQuoridorRoom('room-1', 'a', fixture.factory);
    return createElement('p', {}, String(fixture.view.room?.version));
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
  await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(Client))));
  await act(async () => t.mock.timers.tick(250));
  return { fixture, unmount };
}

test('수 응답이 바로 반영되고 GET을 다시 하지 않는다', async (t) => {
  const { fixture: f } = await mount(t);
  const gets = f.gets;
  await act(async () => { await f.view!.sendAction('turn', { move: 'e2' }); });
  assert.equal(f.view!.room?.version, 6);
  assert.equal(f.view!.room?.turnIndex, 1);
  assert.equal(f.gets, gets);
});

test('늦게 도착한 GET과 옛 실시간 이벤트가 판을 되돌리지 않는다', async (t) => {
  const { fixture: f } = await mount(t);
  const old = structuredClone(f.server);
  f.holdGet = true;
  let pending: Promise<unknown>;
  await act(async () => { pending = f.view!.synchronize(); });
  f.advance();
  await act(async () => { f.emit(); });
  await act(async () => { f.deferredGet!(Response.json({ room: mapRoomRow(old) })); await pending; });
  await act(async () => { f.emit(old); });
  assert.equal(f.view!.room?.version, 6);
  assert.equal(f.view!.room?.turnIndex, 1);
});

test('언마운트하면 실시간 채널을 해제한다', async (t) => {
  const { fixture: f, unmount } = await mount(t);
  assert.ok(f.channels.some((c) => c.active));
  await unmount();
  assert.ok(f.removed >= 1);
  assert.equal(f.channels.some((c) => c.active), false);
});
