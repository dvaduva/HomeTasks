import { api } from './client';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  logo?: string | null;
  genre?: string;
  description?: string;
  content_type?: string | null;
  proxy?: boolean;
}

// Fields the editor can set; `id` (slug) and `position` are managed server-side.
export type RadioStationInput = Omit<RadioStation, 'id'>;

export interface RadioNowPlaying {
  title?: string | null;
}

export const radioApi = {
  stations: () => api.get<{ stations: RadioStation[] }>('/api/radio/stations'),
  nowPlaying: (id: string) =>
    api.get<RadioNowPlaying>('/api/radio/now-playing', { query: { id } }),
  proxyUrl: (id: string) => `/api/radio/proxy/${encodeURIComponent(id)}`,

  create: (data: RadioStationInput) =>
    api.post<RadioStation>('/api/radio/stations', data),
  update: (id: string, data: Partial<RadioStationInput>) =>
    api.put<RadioStation>(`/api/radio/stations/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    api.delete<{ message: string }>(`/api/radio/stations/${encodeURIComponent(id)}`),
  reorder: (order: string[]) =>
    api.post<{ stations: RadioStation[] }>('/api/radio/stations/reorder', { order }),
};
