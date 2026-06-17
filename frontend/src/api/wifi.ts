import { api } from './client';

// Client for the RPi self-configuration Wi-Fi endpoints (/api/wifi/*). The RPi
// joins a network via NetworkManager (nmcli). Linux/RPi only — `available` is
// false elsewhere so the UI can hide the option. See src/wifi/service.py.

export interface WifiNetwork {
  ssid: string;
  signal: number; // 0-100
  security: string | null; // e.g. "WPA2"; null = open network
  in_use: boolean; // currently connected to this SSID
}

export interface WifiStatusInfo {
  available: boolean;
  connected: boolean;
  ssid: string | null;
  ip: string | null;
}

export const wifiApi = {
  status: () => api.get<WifiStatusInfo>('/api/wifi/status'),
  scan: () =>
    api.post<{ networks: WifiNetwork[]; available: boolean; error: string | null }>(
      '/api/wifi/scan',
    ),
  connect: (ssid: string, password?: string, hidden?: boolean) =>
    api.post<{ ok: boolean; ssid: string; connected: boolean }>('/api/wifi/connect', {
      ssid,
      password,
      hidden,
    }),
  disconnect: () =>
    api.post<{ ok: boolean; connected: boolean }>('/api/wifi/disconnect'),
};
