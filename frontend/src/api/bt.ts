import { api } from './client';

// Client for the server-side Bluetooth A2DP output (/api/output/bt/*). Unlike
// Cast, the RPi itself is the player: it fetches + decodes the stream and pushes
// it into a BlueZ sink routed to the speaker. So playback runs on the RPi and
// survives this tab closing. See docs/audio-streaming.ro.md.

export interface BtDevice {
  id: string; // speaker MAC address
  name: string; // friendly name
  connected: boolean;
  paired?: boolean;
}

export interface BtStatusInfo {
  device_id: string | null;
  state: 'playing' | 'idle';
  station_id?: string | null;
  title?: string | null; // ICY now-playing
}

export const btApi = {
  devices: () =>
    api.get<{ devices: BtDevice[]; error: string | null; available: boolean }>(
      '/api/output/bt/devices',
    ),
  // Pairing (RPi only): scan returns paired + freshly discovered devices.
  scan: (timeout?: number) =>
    api.post<{ devices: BtDevice[] }>('/api/output/bt/scan', { timeout: timeout ?? 10 }),
  pair: (deviceId: string) =>
    api.post<{ ok: boolean; id: string; paired: boolean; connected: boolean }>(
      '/api/output/bt/pair',
      { device_id: deviceId },
    ),
  remove: (deviceId: string) =>
    api.post<{ ok: boolean; id: string; removed: boolean }>('/api/output/bt/remove', {
      device_id: deviceId,
    }),
  play: (deviceId: string, stationId: string) =>
    api.post<{ ok: boolean; url: string }>('/api/output/bt/play', {
      device_id: deviceId,
      station_id: stationId,
    }),
  stop: (deviceId: string) =>
    api.post<{ ok: boolean }>('/api/output/bt/stop', { device_id: deviceId }),
  volume: (deviceId: string, volume: number) =>
    api.post<{ ok: boolean; volume: number }>('/api/output/bt/volume', {
      device_id: deviceId,
      volume,
    }),
  status: (deviceId: string) =>
    api.get<BtStatusInfo>('/api/output/bt/status', { query: { device_id: deviceId } }),
};
