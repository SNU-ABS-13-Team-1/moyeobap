import { requestJson } from './api-client';

export async function fetcher<T>(url: string): Promise<T> {
  return requestJson<T>(url, { cache: 'no-store' });
}
