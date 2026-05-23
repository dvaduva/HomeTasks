import { api } from './client';

export interface RadioAction {
  verb: 'play' | 'stop' | 'pause' | 'next' | 'prev' | 'volume';
  station_id?: string;
  station_name?: string;
  cast_target?: string;
  cast_name?: string;
  volume?: number;
}

export interface AiChatResponse {
  response: string;
  model?: string;
  created_at?: string;
  done?: boolean;
  action?: string | null;
  action_data?: RadioAction | null;
  error?: string;
}

export interface AiStatus {
  available: boolean;
  base_url?: string;
  model?: string;
  models?: { name: string; size?: number }[];
  error?: string;
}

export interface AiModel {
  name: string;
  size?: number;
}

export const aiApi = {
  chat: (message: string, opts?: { temperature?: number; max_tokens?: number }) =>
    api.post<AiChatResponse>('/api/ai/chat', { message, ...opts }),
  models: () => api.get<{ models: AiModel[] }>('/api/ai/models'),
  status: () => api.get<AiStatus>('/api/ai/status'),
};
