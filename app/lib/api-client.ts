type ErrorPayload = { error?: unknown };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as ErrorPayload | T | null;

  if (!response.ok) {
    const payloadError = payload && typeof payload === 'object'
      ? (payload as ErrorPayload).error
      : undefined;
    const message = typeof payloadError === 'string'
      ? payloadError
      : `요청에 실패했어요. (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (payload === null) {
    throw new ApiError('서버 응답을 읽지 못했어요.', response.status);
  }

  return payload as T;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
