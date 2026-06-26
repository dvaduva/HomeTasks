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

export interface MicrophoneDevice {
  index: number;
  name: string;
}

export interface VoiceMicrophones {
  available: boolean;
  devices: MicrophoneDevice[];
  selected: string;
}

export const voiceApi = {
  serverAvailable: () => api.get<VoiceServerAvailable>('/api/voice/server-available'),
  microphones: () => api.get<VoiceMicrophones>('/api/voice/microphones'),
  listen: (language?: string) =>
    api.post<VoiceListenResult>('/api/voice/listen', language ? { language } : {}),
  debugLog: (message: string) =>
    api.post<unknown>('/api/voice-debug-log', { message }).catch(() => undefined),
  speakUrl: () => '/api/voice/speak',
};
