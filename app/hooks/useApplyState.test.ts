import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import type { ApplyState } from '../lib/moyeoApply';
import { useApplyState } from './useApplyState';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/apply' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
type View = ReturnType<typeof useApplyState>;
const choices = ['a', 'b', 'c', 'd', 'e'];
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

class Fixture {
  rank: number | null = 12;
  edits = 0;
  confirmedAt: string | null = null;
  hidden = false;
  gets = 0;
  failReads = false;
  holdReads = false;
  loseSaveResponse = false;
  views: View[] = [];
  reads: { finish: (response: Response) => void; snapshot: ApplyState; signal?: AbortSignal | null }[] = [];
  channels: { name: string; onmessage: ((event: MessageEvent) => void) | null; closed: boolean }[] = [];
  broadcasts: unknown[] = [];
  state(): ApplyState {
    return {
      companies: choices.map(id => ({ id, name: id })),
      submission: { confirmedAt: this.confirmedAt, choices, academicRank: this.rank, editCount: this.edits, updatedAt: `2026-10-13T00:00:0${this.edits}Z` },
      participants: [
        { isConfirmed: this.confirmedAt !== null, displayName: '가', choices, isMe: true, ...(this.rank === null ? {} : { academicRank: this.rank }) },
        { isConfirmed: false, displayName: '나', choices, isMe: false, ...(this.rank === null ? {} : { academicRank: 3 }) },
      ],
    };
  }
  fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      assert.equal(body.expectedUpdatedAt, this.state().submission?.updatedAt);
      this.confirmedAt = '2026-10-16T00:00:00Z';
      if (this.loseSaveResponse) throw new Error('lost response after commit');
      return Response.json({ submission: this.state().submission, changed: true });
    }
    if (init?.method === 'PUT') {
      this.rank = JSON.parse(String(init.body)).academicRank;
      this.edits++;
      if (this.loseSaveResponse) throw new Error('lost response after commit');
      return Response.json({ submission: this.state().submission, changed: true });
    }
    this.gets++;
    if (this.failReads) throw new Error('offline');
    if (this.holdReads) {
      return new Promise<Response>(finish => this.reads.push({ finish, snapshot: this.state(), signal: init?.signal }));
    }
    return Response.json(this.state());
  };
}

async function mount(t: TestContext, clients = 1, broadcast = true) {
  const f = new Fixture();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = f.fetch;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => f.hidden ? 'hidden' : 'visible' });
  window.localStorage.clear();
  class Channel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    closed = false;
    constructor(readonly name: string) { f.channels.push(this); }
    postMessage(data: unknown) {
      if (this.closed) throw new Error('closed');
      f.broadcasts.push(data);
      for (const peer of f.channels) {
        if (peer !== this && !peer.closed && peer.name === this.name) peer.onmessage?.(new dom.window.MessageEvent('message', { data }));
      }
    }
    close() { this.closed = true; }
  }
  Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: broadcast ? Channel : undefined });
  function Probe({ index }: { index: number }) {
    f.views[index] = useApplyState('test-user');
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => { root.render(Array.from({ length: clients }, (_, index) => createElement(Probe, { index, key: index }))); await tick(); });
  let unmounted = false;
  const unmount = async () => {
    if (!unmounted) { await act(async () => root.unmount()); unmounted = true; }
  };
  t.after(async () => { await unmount(); globalThis.fetch = oldFetch; });
  return { f, unmount };
}

function signal(value = 'new-revision', user = 'test-user') {
  window.dispatchEvent(new dom.window.StorageEvent('storage', { key: `moyeo-apply-changed:${user}`, newValue: value }));
}

test('two clients revoke immediately on save; only opaque signals cross tabs and reads restore access', async t => {
  const { f } = await mount(t, 2);
  assert.ok(f.views.every(view => view.canViewAcademicRanks));
  f.holdReads = true;
  await act(async () => { await f.views[0].save(choices, null); await tick(); });
  for (const view of f.views) {
    assert.equal(view.canViewAcademicRanks, false);
    assert.equal(view.state?.participants, null);
  }
  assert.equal(f.reads.length, 2);
  assert.equal(f.broadcasts.length, 1);
  assert.match(String(f.broadcasts[0]), /^[0-9a-f-]{36}$/);
  assert.equal(window.localStorage.getItem('moyeo-apply-changed:test-user'), f.broadcasts[0]);
  const gets = f.gets;
  await act(async () => { signal(String(f.broadcasts[0])); await tick(); });
  assert.equal(f.gets, gets, 'storage duplicate must not start another request');
  await act(async () => { for (const read of f.reads) read.finish(Response.json(read.snapshot)); await tick(); });
  assert.ok(f.views.every(view => !view.canViewAcademicRanks));
  assert.ok(f.views.every(view => view.state?.participants?.every(row => !('academicRank' in row))));
});

test('hide purges data, stops reads and rejects late responses; focus and visibility recovery coalesce', async t => {
  const { f } = await mount(t);
  f.holdReads = true;
  await act(async () => { f.views[0].refresh(); await tick(); });
  const oldRead = f.reads[0];
  f.hidden = true;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); signal(); await tick(); });
  assert.equal(oldRead.signal?.aborted, true);
  assert.equal(f.views[0].state?.participants, null);
  assert.equal(f.gets, 2, 'hidden tab must not refetch');
  f.rank = null;
  f.hidden = false;
  await act(async () => {
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    window.dispatchEvent(new dom.window.Event('focus'));
    window.dispatchEvent(new dom.window.Event('pageshow'));
    await tick();
  });
  assert.equal(f.gets, 3);
  await act(async () => { f.reads[1].finish(Response.json(f.reads[1].snapshot)); await tick(); });
  await act(async () => { oldRead.finish(Response.json(oldRead.snapshot)); await tick(); });
  assert.equal(f.views[0].canViewAcademicRanks, false);
  assert.equal(f.views[0].state?.submission?.academicRank, null);
  assert.ok(f.views[0].state?.participants?.every(row => !('academicRank' in row)));
});

test('storage fallback and failed revalidation never redisplay cached ranks', async t => {
  const { f } = await mount(t, 1, false);
  await act(async () => { signal('irrelevant', 'someone-else'); await tick(); });
  assert.equal(f.gets, 1);
  f.rank = null;
  f.failReads = true;
  await act(async () => { signal(); await tick(); });
  assert.equal(f.views[0].canViewAcademicRanks, false);
  assert.equal(f.views[0].state?.participants, null);
  assert.equal(f.views[0].readError, 'offline');
  f.failReads = false;
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); await tick(); });
  assert.equal(f.views[0].state?.submission?.academicRank, null);
  assert.equal(f.views[0].canViewAcademicRanks, false);
});

test('a lost save response still invalidates the other client and reloads committed permissions', async t => {
  const { f } = await mount(t, 2);
  f.loseSaveResponse = true;
  await act(async () => { await f.views[0].save(choices, null); await tick(); });
  assert.equal(f.views[0].saveError, 'lost response after commit');
  assert.equal(f.broadcasts.length, 1);
  assert.ok(f.views.every(view => !view.canViewAcademicRanks && view.state?.submission?.academicRank === null));
});

test('back-forward cache invalidation and unmount clean up pending reads and all listeners', async t => {
  const { f, unmount } = await mount(t);
  await act(async () => { window.dispatchEvent(new dom.window.Event('pagehide')); await tick(); });
  assert.equal(f.views[0].state?.participants, null);
  assert.equal(f.views[0].canViewAcademicRanks, false);
  f.holdReads = true;
  await act(async () => { window.dispatchEvent(new dom.window.Event('pageshow')); await tick(); });
  await unmount();
  assert.ok(f.channels.every(channel => channel.closed));
  assert.ok(f.reads.every(read => read.signal?.aborted));
  const gets = f.gets;
  await act(async () => {
    signal();
    window.dispatchEvent(new dom.window.Event('focus'));
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    f.reads[0].finish(Response.json(f.reads[0].snapshot));
    await tick();
  });
  assert.equal(f.gets, gets);
});

test('confirmation refreshes both clients without consuming an edit or sharing submission data across tabs', async t => {
  const { f } = await mount(t, 2);
  f.edits = 2;
  await act(async () => { f.views.forEach(view => view.refresh()); await tick(); });
  await act(async () => { await f.views[0].confirm(); await tick(); });
  assert.equal(f.edits, 2);
  assert.ok(f.views.every(view => view.state?.submission?.confirmedAt === f.confirmedAt));
  assert.ok(f.views.every(view => view.state?.participants?.[0].isConfirmed));
  assert.ok(f.broadcasts.every(value => typeof value === 'string' && !value.includes('confirmedAt')));
  assert.match(f.views[0].notice ?? '', /제출 완료/);
});

test('lost confirmation response reloads the confirmed state in both clients', async t => {
  const { f } = await mount(t, 2);
  f.loseSaveResponse = true;
  await act(async () => { await f.views[0].confirm(); await tick(); });
  assert.equal(f.edits, 0);
  assert.ok(f.views.every(view => view.state?.submission?.confirmedAt === f.confirmedAt));
  assert.equal(f.views[0].saveError, 'lost response after commit');
});
