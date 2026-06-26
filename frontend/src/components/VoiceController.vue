<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { voiceApi } from '@/api/voice';
import { usePreferencesStore } from '@/stores/preferences';
import { useAiStore } from '@/stores/ai';
import { useNotification } from '@/composables/useNotification';
import { useTts } from '@/composables/useTts';
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
const { speak: speakReply } = useTts();
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
        // Voice-triggered replies are read back aloud (legacy parity); skip on
        // error so we don't speak the failure text.
        ai.send(transcript).then((reply) => { if (!ai.error) void speakReply(reply); }).catch(() => {/* error toast already in store */});
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
        const reply = await ai.send(res.text);
        if (!ai.error) void speakReply(reply);
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
  <button
    type="button"
    class="footer-btn btn-voice"
    :class="{ listening: isListening }"
    :disabled="status === 'unavailable'"
    :title="status === 'unavailable' ? $t('voice_unavailable') : (isListening ? $t('stop_listening') : $t('start_listening'))"
    @click="toggleListen"
    aria-label="Voice"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  </button>
  <span class="status-text">{{ statusLabel }}</span>
</template>
