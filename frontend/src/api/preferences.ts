import { api } from './client';
import type { Preferences } from './types';

export const preferencesApi = {
  get: () => api.get<Preferences>('/api/preferences'),
  update: (data: Partial<Preferences>) => api.put<Preferences>('/api/preferences', data),
};
