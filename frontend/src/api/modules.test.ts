/**
 * Integration tests for the thin API modules. They run the *real* modules and
 * the real client.ts with only `fetch` stubbed, so they pin down the
 * URL/method/body/query each call produces — the contract with the Flask backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { radioApi } from './radio';
import { castApi } from './cast';
import { btApi } from './bt';
import { weatherApi } from './weather';
import { usersApi } from './users';
import { preferencesApi } from './preferences';
import { tasksApi } from './tasks';
import { aiApi } from './ai';
import { voiceApi } from './voice';
import { wifiApi } from './wifi';
import { tuyaApi } from './tuya';

let lastCall: { url: string; init: RequestInit };

beforeEach(() => {
  const spy = vi.fn((url: string, init: RequestInit = {}) => {
    lastCall = { url, init };
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', spy);
});

afterEach(() => vi.unstubAllGlobals());

const method = () => lastCall.init.method;
const body = () => (lastCall.init.body ? JSON.parse(lastCall.init.body as string) : undefined);

describe('radioApi', () => {
  it('stations -> GET /api/radio/stations', async () => {
    await radioApi.stations();
    expect(lastCall.url).toBe('/api/radio/stations');
    expect(method()).toBe('GET');
  });

  it('nowPlaying -> GET with id query', async () => {
    await radioApi.nowPlaying('zu');
    expect(lastCall.url).toBe('/api/radio/now-playing?id=zu');
  });

  it('proxyUrl encodes the id (no fetch)', () => {
    expect(radioApi.proxyUrl('a b/c')).toBe('/api/radio/proxy/a%20b%2Fc');
  });

  it('create -> POST with the station body', async () => {
    await radioApi.create({ name: 'New', url: 'http://x' } as any);
    expect(lastCall.url).toBe('/api/radio/stations');
    expect(method()).toBe('POST');
    expect(body()).toEqual({ name: 'New', url: 'http://x' });
  });

  it('update -> PUT to the encoded id', async () => {
    await radioApi.update('a b', { name: 'X' });
    expect(lastCall.url).toBe('/api/radio/stations/a%20b');
    expect(method()).toBe('PUT');
  });

  it('remove -> DELETE', async () => {
    await radioApi.remove('zu');
    expect(method()).toBe('DELETE');
  });

  it('reorder -> POST { order }', async () => {
    await radioApi.reorder(['b', 'a']);
    expect(lastCall.url).toBe('/api/radio/stations/reorder');
    expect(body()).toEqual({ order: ['b', 'a'] });
  });
});

describe('castApi', () => {
  it('play -> POST device_id/station_id', async () => {
    await castApi.play('uuid-1', 's1');
    expect(lastCall.url).toBe('/api/cast/play');
    expect(body()).toEqual({ device_id: 'uuid-1', station_id: 's1' });
  });

  it('volume -> POST device_id/volume', async () => {
    await castApi.volume('uuid-1', 0.5);
    expect(body()).toEqual({ device_id: 'uuid-1', volume: 0.5 });
  });

  it('status -> GET with device_id query', async () => {
    await castApi.status('uuid-1');
    expect(lastCall.url).toBe('/api/cast/status?device_id=uuid-1');
  });
});

describe('btApi', () => {
  it('scan -> POST with default timeout', async () => {
    await btApi.scan();
    expect(lastCall.url).toBe('/api/output/bt/scan');
    expect(body()).toEqual({ timeout: 10 });
  });

  it('pair -> POST device_id', async () => {
    await btApi.pair('AA:BB');
    expect(body()).toEqual({ device_id: 'AA:BB' });
  });

  it('status -> GET with device_id query', async () => {
    await btApi.status('AA:BB');
    expect(lastCall.url).toBe('/api/output/bt/status?device_id=AA%3ABB');
  });
});

describe('weatherApi', () => {
  it('current with no city omits the query', async () => {
    await weatherApi.current();
    expect(lastCall.url).toBe('/api/weather/current');
  });

  it('current with a city adds the query', async () => {
    await weatherApi.current('Cluj');
    expect(lastCall.url).toBe('/api/weather/current?city=Cluj');
  });

  it('forecast passes city and days', async () => {
    await weatherApi.forecast('Cluj', 3);
    expect(lastCall.url).toBe('/api/weather/forecast?city=Cluj&days=3');
  });
});

describe('usersApi', () => {
  it('create -> POST body', async () => {
    await usersApi.create({ name: 'Ana', color: '#f00' });
    expect(lastCall.url).toBe('/api/users');
    expect(body()).toEqual({ name: 'Ana', color: '#f00' });
  });

  it('remove -> DELETE /api/users/:id', async () => {
    await usersApi.remove(7);
    expect(lastCall.url).toBe('/api/users/7');
    expect(method()).toBe('DELETE');
  });
});

describe('preferencesApi', () => {
  it('update -> PUT body', async () => {
    await preferencesApi.update({ language: 'en' } as any);
    expect(lastCall.url).toBe('/api/preferences');
    expect(method()).toBe('PUT');
    expect(body()).toEqual({ language: 'en' });
  });
});

describe('tasksApi', () => {
  it('list forwards a query', async () => {
    await tasksApi.list({ user_id: 3 } as any);
    expect(lastCall.url).toBe('/api/tasks?user_id=3');
  });

  it('addComment -> POST to the task comments path', async () => {
    await tasksApi.addComment(5, { text: 'hi', user_id: 1 });
    expect(lastCall.url).toBe('/api/tasks/5/comments');
    expect(body()).toEqual({ text: 'hi', user_id: 1 });
  });
});

describe('aiApi', () => {
  it('chat merges message and options into the body', async () => {
    await aiApi.chat('buna', { temperature: 0.2, max_tokens: 50 });
    expect(lastCall.url).toBe('/api/ai/chat');
    expect(body()).toEqual({ message: 'buna', temperature: 0.2, max_tokens: 50 });
  });
});

describe('voiceApi', () => {
  it('listen with a language sends it', async () => {
    await voiceApi.listen('en-US');
    expect(body()).toEqual({ language: 'en-US' });
  });

  it('debugLog swallows network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    await expect(voiceApi.debugLog('x')).resolves.toBeUndefined();
  });
});

describe('wifiApi', () => {
  it('connect -> POST ssid/password/hidden', async () => {
    await wifiApi.connect('HomeNet', 'secret', true);
    expect(lastCall.url).toBe('/api/wifi/connect');
    expect(body()).toEqual({ ssid: 'HomeNet', password: 'secret', hidden: true });
  });
});

describe('tuyaApi', () => {
  it('temperatures -> GET, refresh -> POST', async () => {
    await tuyaApi.temperatures();
    expect(lastCall.url).toBe('/api/tuya/temperatures');
    await tuyaApi.refresh();
    expect(lastCall.url).toBe('/api/tuya/refresh');
    expect(method()).toBe('POST');
  });
});
