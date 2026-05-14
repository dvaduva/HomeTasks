import { api } from './client';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  logo?: string;
  genre?: string;
  description?: string;
  proxy?: boolean;
}

export interface RadioNowPlaying {
  title?: string | null;
}

export const radioApi = {
  stations: () => api.get<{ stations: RadioStation[] }>('/api/radio/stations'),
  nowPlaying: (id: string) =>
    api.get<RadioNowPlaying>('/api/radio/now-playing', { query: { id } }),
  proxyUrl: (id: string) => `/api/radio/proxy/${encodeURIComponent(id)}`,
};
