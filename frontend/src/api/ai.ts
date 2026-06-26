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

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (
    message: string,
    opts?: { temperature?: number; max_tokens?: number; history?: ChatHistoryTurn[] },
  ) => api.post<AiChatResponse>('/api/ai/chat', { message, ...opts }),
  models: (provider?: string) =>
    api.get<{ provider?: string; models: AiModel[] }>('/api/ai/models', {
      query: provider ? { provider } : undefined,
    }),
  status: () => api.get<AiStatus>('/api/ai/status'),
};
