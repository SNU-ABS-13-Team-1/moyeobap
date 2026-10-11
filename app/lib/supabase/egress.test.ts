import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeasuredFetch } from './egress.ts';

test('metrics are opt-in and do not consume a response when disabled', async () => {
  const previous = process.env.SUPABASE_EGRESS_METRICS;
  delete process.env.SUPABASE_EGRESS_METRICS;
  try {
    const response = new Response('unchanged');
    response.clone = () => { throw new Error('must not inspect body'); };
    const measured = createMeasuredFetch('test', async () => response);
    assert.equal(await measured('https://example.com/rest/v1/pots'), response);
    assert.equal(await response.text(), 'unchanged');
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_EGRESS_METRICS;
    else process.env.SUPABASE_EGRESS_METRICS = previous;
  }
});

test('metrics preserve the body and omit credentials, filters and response contents', async () => {
  const previous = process.env.SUPABASE_EGRESS_METRICS;
  const originalLog = console.info;
  const logs: string[] = [];
  process.env.SUPABASE_EGRESS_METRICS = '1';
  console.info = (message: string) => { logs.push(message); };
  try {
    const body = JSON.stringify({ private: '계좌번호-secret' });
    const measured = createMeasuredFetch('session', async () => new Response(body));
    const response = await measured('https://example.com/rest/v1/rpc/moyeo_apply_state?user_id=secret', {
      method: 'POST', headers: { Authorization: 'Bearer secret' }, body: 'secret',
    });
    assert.equal(await response.text(), body);
    assert.equal(logs.length, 2);
    const metric = JSON.parse(logs[1]);
    assert.equal(metric.resource, 'rest/v1/rpc/moyeo_apply_state');
    assert.equal(metric.decodedBodyBytes, Buffer.byteLength(body));
    assert.equal(metric.method, 'POST');
    assert.ok(logs.every((entry) => !entry.includes('secret')));
  } finally {
    console.info = originalLog;
    if (previous === undefined) delete process.env.SUPABASE_EGRESS_METRICS;
    else process.env.SUPABASE_EGRESS_METRICS = previous;
  }
});
