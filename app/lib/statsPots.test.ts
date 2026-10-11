import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { fetchAllPotRows, POT_ROW_SELECT } from './statsPots.ts';

function clientWith(pages: unknown[][], requests: URL[]) {
  return createClient('https://example.com', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const page = pages[requests.length - 1] ?? [];
      return new Response(JSON.stringify(page), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
}

test('reads every pot page until a short page, without the list-view cap', async () => {
  const requests: URL[] = [];
  const full = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}` }));
  const db = clientWith([full, full, [{ id: 'last' }]], requests);

  const rows = await fetchAllPotRows(db, 3);

  assert.equal(rows.length, 7);
  assert.deepEqual(requests.map((u) => [u.searchParams.get('offset'), u.searchParams.get('limit')]),
    [['0', '3'], ['3', '3'], ['6', '3']]);
  for (const url of requests) {
    assert.equal(url.pathname.endsWith('/pots'), true);
    assert.equal(url.searchParams.get('select'), POT_ROW_SELECT.replace(/\s+/g, ''));
    assert.ok(!url.searchParams.get('select')?.includes('bank'));
  }
});

test('an empty table is a single request', async () => {
  const requests: URL[] = [];
  const rows = await fetchAllPotRows(clientWith([[]], requests), 3);
  assert.deepEqual(rows, []);
  assert.equal(requests.length, 1);
});

test('a page exactly at the limit triggers one more read', async () => {
  const requests: URL[] = [];
  const rows = await fetchAllPotRows(clientWith([[{ id: 'a' }, { id: 'b' }], []], requests), 2);
  assert.equal(rows.length, 2);
  assert.equal(requests.length, 2);
});
