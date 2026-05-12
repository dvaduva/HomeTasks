// Central HTTP client — fetch wrapper with unified error handling.
// Backend (Flask) returns JSON with `{ error: string }` on failure.

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts;

  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  };

  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, query), init);

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : null) || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => apiRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: RequestOptions) => apiRequest<T>(path, { ...opts, method: 'DELETE' }),
};
