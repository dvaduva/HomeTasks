import { api } from './client';

export interface TuyaDevice {
  id?: string;
  name: string;
  online?: boolean;
  current_temperature?: number | null;
  target_temperature?: number | null;
  humidity?: number | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface TuyaTemperatures {
  devices?: TuyaDevice[];
  updated_at?: string | null;
  error?: string;
  [key: string]: unknown;
}

export const tuyaApi = {
  temperatures: () => api.get<TuyaTemperatures>('/api/tuya/temperatures'),
  refresh: () => api.post<TuyaTemperatures>('/api/tuya/refresh'),
};
