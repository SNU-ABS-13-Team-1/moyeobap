import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getNotificationSummary } from './notificationSummary.ts';

test('header queries only own memberships and metadata; keeps old joined pots', async () => {
  const requests: URL[] = [];
  const db = createClient('https://example.com', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      let data: unknown = [];
      if (url.pathname.endsWith('/pot_participants')) {
        assert.equal(url.searchParams.get('user_id'), 'eq.me');
        assert.equal(url.searchParams.get('pots.status'), 'neq.failed');
        data = [
          { pot_id: 'old', joined_at: '2026-01-01T00:00:00Z', pots: { restaurant_id: 'custom' } },
          { pot_id: 'read', joined_at: '2026-01-01T00:00:00Z', pots: { restaurant_id: 'custom' } },
          { pot_id: 'self', joined_at: '2026-01-01T00:00:00Z', pots: { restaurant_id: 'custom' } },
        ];
      } else if (url.pathname.endsWith('/message_reads')) {
        assert.equal(url.searchParams.get('user_id'), 'eq.me');
        data = [{ pot_id: 'read', last_read_at: '2026-10-11T00:00:00Z' }];
      } else if (url.pathname.endsWith('/restaurants')) {
        assert.equal(url.searchParams.get('select'), 'id,name');
        data = [{ id: 'custom', name: '테스트 식당' }];
      } else if (url.searchParams.get('select')?.includes('messages(')) {
        assert.equal(url.searchParams.get('messages.limit'), '1');
        data = [
          { id: 'old', messages: [{ author_id: 'other', created_at: '2026-10-10T00:00:00Z' }] },
          { id: 'read', messages: [{ author_id: 'other', created_at: '2026-10-10T00:00:00Z' }] },
          { id: 'self', messages: [{ author_id: 'me', created_at: '2026-10-10T00:00:00Z' }] },
        ];
      }
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const result = await getNotificationSummary('me', new Date('2026-10-11T00:00:00Z'), db);
  assert.deepEqual(result?.myPotIds, ['old', 'read', 'self']);
  assert.deepEqual(result?.unread, [{ potId: 'old', name: '테스트 식당' }]);
  for (const url of requests) {
    const select = url.searchParams.get('select') ?? '';
    assert.ok(!select.includes('*'));
    assert.ok(!select.includes('text'));
    assert.ok(!select.includes('bank'));
  }
});
