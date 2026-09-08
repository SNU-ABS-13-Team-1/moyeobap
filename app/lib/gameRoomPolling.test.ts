import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement, useEffect, useState } from 'react';
import { POLLING_PRESETS } from './swrConfig.ts';
import { remainingTurnMs } from './omokMatch.ts';

// SWR must initialize after the browser globals, just as in the real client.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const { default: useSWR, SWRConfig } = await import('swr');

type Room = {
  status: string;
  blackId: string | null;
  whiteId: string | null;
  turn: 'black' | 'white';
  moveCount: number;
  board: number[];
  turnStartedAt: string;
};
const initialRoom = (): Room => ({
  status: 'playing', blackId: 'me', whiteId: 'opponent', turn: 'white',
  moveCount: 1, board: [1, 0], turnStartedAt: new Date(0).toISOString(),
});

async function mountRoom(t: TestContext, initial = initialRoom()) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  let serverRoom = initial;
  let requests = 0;
  let visible = true;
  let snapshot: { room?: Room; now: number; remaining: number };
  let revalidate: () => Promise<unknown>;
  const fetcher = async () => {
    requests++;
    return { room: structuredClone(serverRoom) };
  };
  function RoomClock() {
    const [now, setNow] = useState(Date.now);
    const { data, mutate } = useSWR('/room', fetcher, POLLING_PRESETS.GAME_ROOM);
    useEffect(() => {
      const timer = setInterval(() => setNow(Date.now()), 250);
      return () => clearInterval(timer);
    }, []);
    revalidate = () => mutate();
    snapshot = { room: data?.room, now, remaining: remainingTurnMs(data?.room.turnStartedAt ?? null, now) };
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    container.remove();
    t.mock.timers.reset();
  });
  await act(async () => root.render(createElement(SWRConfig, {
    value: { provider: () => new Map(), isVisible: () => visible, isOnline: () => true },
  }, createElement(RoomClock))));
  async function tick(ms: number) {
    // Flush each clock render; a single large tick would hide the original bug.
    for (let elapsed = 0; elapsed < ms; elapsed += 250) {
      await act(async () => t.mock.timers.tick(Math.min(250, ms - elapsed)));
    }
  }
  return {
    tick,
    update: (room: Room) => { serverRoom = room; },
    setVisible: (value: boolean) => { visible = value; },
    snapshot: () => snapshot!,
    requests: () => requests,
    notify: async () => { await act(async () => { await revalidate(); }); },
  };
}

test('clock renders do not starve polling; a missed opponent move updates board, turn and clock together', async (t) => {
  const client = await mountRoom(t);
  await client.tick(20000);
  const before = client.requests();
  const next = { ...initialRoom(), turn: 'black' as const, moveCount: 2, board: [1, 2], turnStartedAt: new Date(Date.now()).toISOString() };
  client.update(next); // No realtime event: polling must recover this move.
  await client.tick(20000);
  assert.equal(client.requests(), before + 1);
  assert.deepEqual(client.snapshot().room, next);
  assert.equal(client.snapshot().remaining, 10000);
});

test('polling continues after own turn changes to opponent turn, without a realtime event', async (t) => {
  const ownTurn = { ...initialRoom(), turn: 'black' as const };
  const client = await mountRoom(t, ownTurn);
  await client.tick(20000);
  const before = client.requests();
  // Local move succeeds and the action handler revalidates the room.
  client.update({ ...ownTurn, turn: 'white', moveCount: 2 });
  await client.notify();
  client.update({ ...ownTurn, moveCount: 3, board: [1, 2] });
  await client.tick(20000);
  assert.equal(client.requests(), before + 2);
  assert.equal(client.snapshot().room?.moveCount, 3);
});

test('realtime revalidation updates the turn before the next polling interval', async (t) => {
  const client = await mountRoom(t);
  await client.tick(250);
  client.update({ ...initialRoom(), turn: 'black', moveCount: 2, turnStartedAt: new Date(Date.now()).toISOString() });
  await client.notify();
  assert.equal(client.snapshot().room?.turn, 'black');
  assert.equal(client.snapshot().remaining, 30000);
});

test('hidden tabs stop network polling and visible tabs resume it', async (t) => {
  const client = await mountRoom(t);
  client.setVisible(false);
  await client.tick(20000);
  assert.equal(client.requests(), 1);
  client.setVisible(true);
  await client.tick(20000);
  assert.equal(client.requests(), 2);
});

