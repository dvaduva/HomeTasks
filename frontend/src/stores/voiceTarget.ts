import { defineStore } from 'pinia';
import { ref } from 'vue';

// Lets a view claim voice commands while it's mounted, so the single global
// microphone (VoiceController) routes spoken text to that view's own assistant
// instead of the general AI chat. When no view has claimed it, voice falls back
// to the general AI assistant.
export type VoiceHandler = (text: string) => void;

export const useVoiceTargetStore = defineStore('voiceTarget', () => {
  const handler = ref<VoiceHandler | null>(null);

  function setHandler(fn: VoiceHandler): void {
    handler.value = fn;
  }

  // Only clear when the caller still owns the slot, so a view unmounting late
  // can't wipe a handler a freshly mounted view just installed.
  function clearHandler(fn?: VoiceHandler): void {
    if (!fn || handler.value === fn) handler.value = null;
  }

  // Returns true when a view handled the transcript; false means "fall back to
  // the general AI assistant".
  function dispatch(text: string): boolean {
    if (handler.value) {
      handler.value(text);
      return true;
    }
    return false;
  }

  return { handler, setHandler, clearHandler, dispatch };
});
