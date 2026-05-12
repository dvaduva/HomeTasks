import { api } from './client';

export interface VoiceServerAvailable {
  available: boolean;
  tts_available: boolean;
}

export interface VoiceListenResult {
  available: boolean;
  text: string | null;
  error?: string | null;
}

export const voiceApi = {
  serverAvailable: () => api.get<VoiceServerAvailable>('/api/voice/server-available'),
  listen: (language?: string) =>
    api.post<VoiceListenResult>('/api/voice/listen', language ? { language } : {}),
  debugLog: (message: string) =>
    api.post<unknown>('/api/voice-debug-log', { message }).catch(() => undefined),
  speakUrl: () => '/api/voice/speak',
};
