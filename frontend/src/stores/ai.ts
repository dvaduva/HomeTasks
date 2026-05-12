import { defineStore } from 'pinia';
import { ref } from 'vue';
import { aiApi, type AiModel } from '@/api/ai';

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

  async function send(text: string, opts?: { temperature?: number; max_tokens?: number }): Promise<string> {
    push('user', text);
    typing.value = true;
    error.value = null;
    try {
      const res = await aiApi.chat(text, opts);
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
