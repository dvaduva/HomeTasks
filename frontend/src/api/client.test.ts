import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiRequest } from './client';

function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(impl as any);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('parses a JSON success body', async () => {
    mockFetch(() => jsonResponse({ id: 1, name: 'Ana' }));
    const out = await apiRequest<{ id: number; name: string }>('/api/users/1');
    expect(out).toEqual({ id: 1, name: 'Ana' });
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    const out = await apiRequest('/api/tasks/1', { method: 'DELETE' });
    expect(out).toBeUndefined();
  });

  it('throws ApiError carrying the backend error message', async () => {
    mockFetch(() => jsonResponse({ error: 'name este obligatoriu' }, 400));
    await expect(apiRequest('/api/radio/stations', { method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'name este obligatoriu',
    });
  });

  it('falls back to "HTTP <status>" when no error field is present', async () => {
    mockFetch(() => new Response('', { status: 500 }));
    await expect(apiRequest('/api/x')).rejects.toThrow('HTTP 500');
  });

  it('builds a query string, skipping null/undefined', async () => {
    const spy = mockFetch(() => jsonResponse([]));
    await apiRequest('/api/tasks', { query: { user_id: 3, days: undefined, q: null, done: false } });
    const calledUrl = spy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('user_id=3');
    expect(calledUrl).toContain('done=false');
    expect(calledUrl).not.toContain('days');
    expect(calledUrl).not.toContain('q=');
  });

  it('serializes a body and sets Content-Type', async () => {
    const spy = mockFetch(() => jsonResponse({ ok: true }));
    await api.post('/api/tasks', { description: 'x' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ description: 'x' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not set Content-Type when there is no body', async () => {
    const spy = mockFetch(() => jsonResponse([]));
    await api.get('/api/tasks');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('exposes status and payload on ApiError', () => {
    const err = new ApiError('boom', 502, { error: 'boom' });
    expect(err.status).toBe(502);
    expect(err.payload).toEqual({ error: 'boom' });
  });
});
