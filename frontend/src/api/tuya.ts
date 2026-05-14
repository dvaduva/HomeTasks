import { api } from './client';

// Field names mirror what the Flask backend actually returns from
// TuyaService.get_temperatures() — temp_current/temp_set/generated_at.
export interface TuyaDevice {
  id?: string;
  name: string;
  online?: boolean;
  temp_current?: number | null;
  temp_set?: number | null;
  [key: string]: unknown;
}

export interface TuyaTemperatures {
  devices?: TuyaDevice[];
  generated_at?: string | null;
  error?: string;
  [key: string]: unknown;
}

// /api/tuya/refresh returns a status object, not the temperatures payload.
export interface TuyaRefreshResult {
  success?: boolean;
  device_count?: number;
  error?: string;
}

export const tuyaApi = {
  temperatures: () => api.get<TuyaTemperatures>('/api/tuya/temperatures'),
  refresh: () => api.post<TuyaRefreshResult>('/api/tuya/refresh'),
};
