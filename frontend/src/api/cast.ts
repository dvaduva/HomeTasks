import { api } from './client';

// Client for the server-side Google Cast controller (/api/cast/*). The backend
// (pychromecast) tells a device to fetch a radio stream itself, so playback on
// the speaker survives this tab closing. See docs/audio-streaming.md.

export interface CastDevice {
  id: string;            // device uuid
  name: string;          // friendly name
  model?: string | null;
  cast_type?: string | null;
  manufacturer?: string | null;
}

export interface CastStatusInfo {
  device_id: string;
  volume: number | null;     // 0.0–1.0
  muted: boolean | null;
  app?: string | null;
  player_state?: string | null;  // PLAYING | PAUSED | IDLE | BUFFERING | ...
  title?: string | null;
  content_id?: string | null;
}

export const castApi = {
  devices: () => api.get<{ devices: CastDevice[]; error: string | null }>('/api/cast/devices'),
  play: (deviceId: string, stationId: string) =>
    api.post<{ ok: boolean; url: string }>('/api/cast/play', {
      device_id: deviceId,
      station_id: stationId,
    }),
  stop: (deviceId: string) =>
    api.post<{ ok: boolean }>('/api/cast/stop', { device_id: deviceId }),
  volume: (deviceId: string, volume: number) =>
    api.post<{ ok: boolean; volume: number }>('/api/cast/volume', {
      device_id: deviceId,
      volume,
    }),
  status: (deviceId: string) =>
    api.get<CastStatusInfo>('/api/cast/status', { query: { device_id: deviceId } }),
};
