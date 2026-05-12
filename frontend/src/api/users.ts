import { api } from './client';
import type { User } from './types';

export const usersApi = {
  list: () => api.get<User[]>('/api/users'),
  get: (id: number) => api.get<User>(`/api/users/${id}`),
  create: (data: { name: string; color?: string }) => api.post<User>('/api/users', data),
  update: (id: number, data: Partial<Pick<User, 'name' | 'color'>>) =>
    api.put<User>(`/api/users/${id}`, data),
  remove: (id: number) => api.delete<void>(`/api/users/${id}`),
};
