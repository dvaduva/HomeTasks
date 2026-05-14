import { api } from './client';

export type TransportSchedule = Record<string, unknown>;

export interface TransportRoute {
  route: string;
  direction: string;
  stations_order: string[];
  departures: Record<string, Record<string, TransportSchedule>>;
}

export interface TransportChatRequest {
  message: string;
  route: string;
  station: string;
  dayType: string;
  currentTime: string;
}

export interface TransportChatResponse {
  response?: string;
  done?: boolean;
  error?: string;
}

export const transportApi = {
  routes: () => api.get<TransportRoute[]>('/api/transport/routes'),
  chat: (payload: TransportChatRequest) =>
    api.post<TransportChatResponse>('/api/transport/chat', payload),
};
