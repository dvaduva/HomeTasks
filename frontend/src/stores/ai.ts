import { defineStore } from 'pinia';
import { ref } from 'vue';
import { aiApi, type AiModel, type RadioAction } from '@/api/ai';
import { useRadioStore } from '@/stores/radio';

export type ChatRole = 'user' | 'ai';

export interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  ts: number;
}

let _id = 0;

export const useAiStore = defineStore('ai', () => {
  // Persists across navigation (Pinia store lives in app, not view).
  const messages = ref<ChatMessage[]>([]);
  const typing = ref(false);
  const models = ref<AiModel[]>([]);
  const open = ref(false);
  const error = ref<string | null>(null);

  function push(role: ChatRole, text: string): ChatMessage {
    const msg = { id: ++_id, role, text, ts: Date.now() };
    messages.value = [...messages.value, msg];
    return msg;
  }

  // Execute a backend-resolved radio command against the radio store. Playback
  // itself is client-side, so the backend only tells us the verb + resolved
  // station/Cast device; we drive the store here. Local autoplay may still be
  // blocked by the browser until the user has interacted — play() degrades to a
  // "press play" prompt in that case; Cast is unaffected.
  async function dispatchRadioAction(ad: RadioAction): Promise<void> {
    const radio = useRadioStore();
    if (!radio.stations.length) {
      try { await radio.refreshStations(); } catch { /* offline — nothing to play */ }
    }
    switch (ad.verb) {
      case 'play': {
        if (ad.cast_target) radio.setCastTarget(ad.cast_target);
        const st = ad.station_id
          ? radio.stations.find((s) => s.id === ad.station_id)
          : radio.currentStation;
        if (st) radio.play(st);
        break;
      }
      case 'stop':
        if (radio.isCasting) radio.stopCast();
        else if (radio.isPlaying) radio.togglePlayPause();
        break;
      case 'pause':
        radio.togglePlayPause();
        break;
      case 'next':
        radio.playNext();
        break;
      case 'prev':
        radio.playPrev();
        break;
      case 'volume':
        if (typeof ad.volume === 'number') radio.setVolume(ad.volume);
        break;
    }
  }

  async function send(text: string, opts?: { temperature?: number; max_tokens?: number }): Promise<string> {
    push('user', text);
    typing.value = true;
    error.value = null;
    try {
      const res = await aiApi.chat(text, opts);
      if (res.action_data) void dispatchRadioAction(res.action_data);
      const reply = res.response || '';
      push('ai', reply);
      return reply;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      push('ai', msg);
      return msg;
    } finally {
      typing.value = false;
    }
  }

  async function loadModels(): Promise<void> {
    try {
      const res = await aiApi.models();
      models.value = res.models || [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      models.value = [];
    }
  }

  function clear(): void {
    messages.value = [];
  }

  function setOpen(v: boolean): void {
    open.value = v;
  }

  return { messages, typing, models, open, error, push, send, loadModels, clear, setOpen };
});
