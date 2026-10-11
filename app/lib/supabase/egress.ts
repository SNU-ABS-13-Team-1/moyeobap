/** Optional server-side diagnostics. Bytes are decoded response-body bytes,
 * not Supabase's billed wire bytes. Never logs queries, credentials or bodies. */
export function createMeasuredFetch(source: string, fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (process.env.SUPABASE_EGRESS_METRICS !== '1') return fetcher(input, init);
    const startedAt = Date.now();
    const url = new URL(input instanceof Request ? input.url : String(input));
    const parts = url.pathname.split('/').filter(Boolean);
    const resource = parts[0] === 'rest' && parts[1] === 'v1'
      ? parts.slice(0, parts[2] === 'rpc' ? 4 : 3).join('/')
      : `${parts[0] ?? 'unknown'}/${parts[1] ?? ''}`;
    console.info(JSON.stringify({ event: 'supabase_request', source, resource }));
    let response: Response;
    try {
      response = await fetcher(input, init);
    } catch (error) {
      console.info(JSON.stringify({ event: 'supabase_request_failed', source, resource,
        elapsedMs: Date.now() - startedAt }));
      throw error;
    }
    try {
      const bytes = (await response.clone().arrayBuffer()).byteLength;
      console.info(JSON.stringify({ event: 'supabase_response', source, resource,
        method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
        status: response.status, elapsedMs: Date.now() - startedAt, decodedBodyBytes: bytes }));
    } catch {
      // Diagnostics must never turn a successful request into a failed one.
    }
    return response;
  };
}
