import { api } from './client';
import type { Comment, Task, TaskCreate, TaskQuery, TaskUpdate } from './types';

export const tasksApi = {
  list: (query?: TaskQuery) => api.get<Task[]>('/api/tasks', { query: query as any }),
  get: (id: number) => api.get<Task>(`/api/tasks/${id}`),
  create: (data: TaskCreate) => api.post<Task>('/api/tasks', data),
  update: (id: number, data: TaskUpdate) => api.put<Task>(`/api/tasks/${id}`, data),
  remove: (id: number) => api.delete<void>(`/api/tasks/${id}`),
  today: (query?: { user_id?: number }) => api.get<Task[]>('/api/tasks/today', { query }),
  upcoming: (query?: { user_id?: number; days?: number }) =>
    api.get<Task[]>('/api/tasks/upcoming', { query }),

  listComments: (taskId: number) => api.get<Comment[]>(`/api/tasks/${taskId}/comments`),
  addComment: (taskId: number, data: { text: string; user_id: number }) =>
    api.post<Comment>(`/api/tasks/${taskId}/comments`, data),
};
