<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { voiceApi } from '@/api/voice';
import { usePreferencesStore } from '@/stores/preferences';
import { useAiStore } from '@/stores/ai';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

// Lightweight Vue port of the legacy voice subsystem.
// Web Speech API for client-side recognition; falls back to server STT if available.
// Wake-word loop (autoStart) is re-implemented as a single self-contained component.

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
}

const SRCtor: (new () => SpeechRecognitionLike) | undefined =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const prefs = usePreferencesStore();
const ai = useAiStore();
const { error: errorToast, toast } = useNotification();
const { t } = useI18n();

const serverMicAvailable = ref(false);
const serverTtsAvailable = ref(false);
const isListening = ref(false);
const status = ref<'inactive' | 'wake' | 'listening' | 'unavailable'>('inactive');

let currentRec: SpeechRecognitionLike | null = null;
let wakeRec: SpeechRecognitionLike | null = null;
let wakeActive = false;
let inCommandAfterWake = false;
let listeningViaButton = false;

const language = computed(() => prefs.data?.voice_language || 'ro-RO');
const wakeWord = computed(() => prefs.data?.voice_activation_word || 'Hey HomeTasks');
const autoStart = computed(() => prefs.data?.voice_auto_start || false);

const statusLabel = computed(() => {
  switch (status.value) {
    case 'unavailable': return t('mic_unavailable');
    case 'listening': return t('listening');
    case 'wake': return t('voice_status_wake_word', { phrase: wakeWord.value });
    default: return t('mic_available_status');
  }
});

function normalizeWake(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

function stopWakeLoop(): void {
  if (!wakeRec) return;
  try { wakeRec.abort(); } catch { /* noop */ }
  wakeRec = null;
  wakeActive = false;
  if (!listeningViaButton) status.value = 'inactive';
}

function startWakeLoopIfEnabled(): void {
  if (!SRCtor || !autoStart.value || !wakeWord.value || serverMicAvailable.value) {
    stopWakeLoop();
    return;
  }
  if (wakeActive || inCommandAfterWake) return;
  const phraseNorm = normalizeWake(wakeWord.value);
  if (!phraseNorm) return;

  try {
    const r = new SRCtor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = language.value;
    r.onresult = (ev: any) => {
      if (inCommandAfterWake) return;
      let transcript = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) transcript += ev.results[i][0].transcript;
      if (!normalizeWake(transcript).includes(phraseNorm)) return;
      stopWakeLoop();
      inCommandAfterWake = true;
      status.value = 'listening';
      runOneShot().finally(() => {
        inCommandAfterWake = false;
        startWakeLoopIfEnabled();
      });
    };
    r.onerror = () => { /* keep loop alive via onend */ };
    r.onend = () => {
      wakeActive = false;
      if (autoStart.value && !inCommandAfterWake && !listeningViaButton) {
        // restart with a small delay so we don't tight-loop on errors
        setTimeout(() => startWakeLoopIfEnabled(), 400);
      }
    };
    wakeRec = r;
    wakeActive = true;
    status.value = 'wake';
    r.start();
  } catch (e) {
    console.warn('wake-word start failed', e);
    wakeRec = null;
    wakeActive = false;
  }
}

async function runOneShot(): Promise<void> {
  if (!SRCtor) return;
  return new Promise<void>((resolve) => {
    try {
      const r = new SRCtor();
      r.continuous = false;
      r.interimResults = false;
      r.lang = language.value;
      r.onresult = (ev: any) => {
        const transcript = ev.results[0][0].transcript.trim();
        ai.setOpen(true);
        ai.send(transcript).catch(() => {/* error toast already in store */});
      };
      r.onerror = (ev: any) => {
        if (ev.error === 'audio-capture') errorToast(t('voice_error_audio_capture'));
        else if (ev.error === 'network') errorToast(t('voice_error_network'));
        else if (ev.error !== 'aborted' && ev.error !== 'no-speech') errorToast(t('voice_error') + ev.error);
      };
      r.onend = () => {
        currentRec = null;
        isListening.value = false;
        resolve();
      };
      currentRec = r;
      isListening.value = true;
      r.start();
    } catch (e) {
      errorToast(t('voice_error_start'));
      isListening.value = false;
      resolve();
    }
  });
}

async function toggleListen(): Promise<void> {
  if (isListening.value) {
    try { currentRec?.stop(); } catch { /* noop */ }
    currentRec = null;
    isListening.value = false;
    listeningViaButton = false;
    status.value = 'inactive';
    startWakeLoopIfEnabled();
    return;
  }

  // Prefer server mic when available
  if (serverMicAvailable.value) {
    stopWakeLoop();
    listeningViaButton = true;
    isListening.value = true;
    status.value = 'listening';
    toast(t('voice_listening_prompt'));
    try {
      const res = await voiceApi.listen(language.value);
      if (res.text) {
        ai.setOpen(true);
        await ai.send(res.text);
      } else if (res.error) {
        errorToast(res.error);
      }
    } catch (e) {
      errorToast(t('ai_connection_error'));
    } finally {
      listeningViaButton = false;
      isListening.value = false;
      status.value = 'inactive';
      startWakeLoopIfEnabled();
    }
    return;
  }

  if (!SRCtor) {
    errorToast(t('voice_unavailable'));
    return;
  }

  stopWakeLoop();
  listeningViaButton = true;
  status.value = 'listening';
  toast(t('voice_listening_prompt'));
  await runOneShot();
  listeningViaButton = false;
  status.value = 'inactive';
  startWakeLoopIfEnabled();
}

watch(
  () => [autoStart.value, language.value, wakeWord.value, serverMicAvailable.value],
  () => {
    stopWakeLoop();
    startWakeLoopIfEnabled();
  },
);

onMounted(async () => {
  try {
    const data = await voiceApi.serverAvailable();
    serverMicAvailable.value = !!data.available;
    serverTtsAvailable.value = !!data.tts_available;
  } catch { /* server might be offline */ }
  if (!SRCtor && !serverMicAvailable.value) {
    status.value = 'unavailable';
    return;
  }
  startWakeLoopIfEnabled();
});

onBeforeUnmount(() => {
  stopWakeLoop();
  try { currentRec?.abort(); } catch { /* noop */ }
});
</script>

<template>
  <div class="voice-controller">
    <button
      type="button"
      class="footer-btn btn-voice"
      :class="{ listening: isListening, disabled: status === 'unavailable' }"
      :disabled="status === 'unavailable'"
      :title="status === 'unavailable' ? $t('voice_unavailable') : (isListening ? $t('stop_listening') : $t('start_listening'))"
      @click="toggleListen"
      aria-label="Voice"
    >🎙</button>
    <span class="voice-status">{{ statusLabel }}</span>
  </div>
</template>

<style scoped>
.voice-controller {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.footer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
}
.footer-btn.listening {
  background: #c62828;
  color: #fff;
  animation: pulse 1.2s infinite;
}
.footer-btn.disabled { opacity: 0.5; cursor: not-allowed; }
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(198, 40, 40, 0.5); }
  70% { box-shadow: 0 0 0 8px rgba(198, 40, 40, 0); }
  100% { box-shadow: 0 0 0 0 rgba(198, 40, 40, 0); }
}
.voice-status {
  font-size: 0.8rem;
  color: #555;
}
</style>
