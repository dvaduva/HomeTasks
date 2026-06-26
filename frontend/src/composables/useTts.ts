import { ref } from 'vue';
import { voiceApi } from '@/api/voice';
import { usePreferencesStore } from '@/stores/preferences';

// Speak assistant text aloud, matching the legacy behaviour: prefer the server
// TTS endpoint (so on the RPi kiosk playback goes through the same ALSA device
// as the rest of the audio), and fall back to the browser SpeechSynthesis API.
//
// State is module-level so only one utterance plays at a time across the whole
// app (a new speak() cancels the previous one), mirroring the legacy global
// `currentServerTtsAudio` / speechSynthesis.cancel() singleton.

const serverTtsAvailable = ref(false);
const language = ref('ro-RO');
const speaking = ref(false);
let currentAudio: HTMLAudioElement | null = null;
let availabilityChecked = false;

// The browser SpeechSynthesis voice is a per-device choice (voices differ by
// browser/OS), so it lives in localStorage rather than the server prefs — same
// as the legacy app's `ttsVoiceName`. It only affects the browser TTS path;
// server TTS uses the system voice.
const VOICE_KEY = 'ttsVoiceName';
const voiceName = ref(localStorage.getItem(VOICE_KEY) || '');
const voices = ref<SpeechSynthesisVoice[]>([]);
let voicesRetryScheduled = false;

// Populate the available browser voices. On Chromium/Linux (e.g. the RPi kiosk)
// getVoices() is often empty until 'voiceschanged' fires, so retry a couple of
// times after a short delay.
function loadVoices(): void {
  if (!window.speechSynthesis) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length) {
    voices.value = list;
    voicesRetryScheduled = false;
    return;
  }
  if (!voicesRetryScheduled) {
    voicesRetryScheduled = true;
    window.speechSynthesis.onvoiceschanged = loadVoices;
    setTimeout(loadVoices, 400);
    setTimeout(loadVoices, 1200);
  }
}

function setVoice(name: string): void {
  voiceName.value = name;
  if (name) localStorage.setItem(VOICE_KEY, name);
  else localStorage.removeItem(VOICE_KEY);
}

// Whether a browser voice belongs to the selected locale. Exact locale match
// (ro-RO ≠ en-US ≠ en-GB), but region-less voices (plain "en") count for any
// region of that language. Tolerates the `_`/`-` and case differences browsers
// use (e.g. "en_US" vs "en-US").
export function voiceMatchesLang(voiceLang: string, selected: string): boolean {
  const v = (voiceLang || '').toLowerCase().replace(/_/g, '-');
  const s = (selected || '').toLowerCase().replace(/_/g, '-');
  if (!s) return true;
  if (v === s) return true;
  return v === s.split('-')[0];
}

async function ensureReady(): Promise<void> {
  const prefs = usePreferencesStore();
  try {
    if (!prefs.data) await prefs.fetch();
    language.value = (prefs.data?.voice_language || 'ro-RO').trim() || 'ro-RO';
  } catch {
    language.value = 'ro-RO';
  }
  if (availabilityChecked) return;
  availabilityChecked = true;
  try {
    const data = await voiceApi.serverAvailable();
    serverTtsAvailable.value = data.tts_available === true;
  } catch {
    serverTtsAvailable.value = false;
  }
}

function stop(): void {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  speaking.value = false;
}

// Speak `text`. Resolves when playback ends (or immediately if nothing can
// play). Never rejects — TTS is a convenience and must not break the chat flow.
async function speak(text: string): Promise<void> {
  const clean = (text || '').trim();
  if (!clean) return;
  await ensureReady();
  stop();

  if (serverTtsAvailable.value) {
    try {
      const res = await fetch(voiceApi.speakUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, lang: language.value }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      speaking.value = true;
      await new Promise<void>((resolve) => {
        const done = () => {
          if (currentAudio === audio) currentAudio = null;
          speaking.value = false;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.addEventListener('ended', done);
        audio.addEventListener('error', done);
        audio.play().catch(done);
      });
      return;
    } catch {
      // fall through to browser TTS
    }
  }

  if (!window.speechSynthesis) return;
  await new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = language.value;
    // Apply the user-picked voice if it's still available and matches the
    // current language; otherwise fall back to the first voice for that
    // language, else the engine default.
    const list = voices.value.length ? voices.value : window.speechSynthesis.getVoices();
    const named = voiceName.value ? list.find((v) => v.name === voiceName.value) : undefined;
    const picked = named && voiceMatchesLang(named.lang, language.value)
      ? named
      : list.find((v) => voiceMatchesLang(v.lang, language.value));
    if (picked) utter.voice = picked;
    const done = () => { speaking.value = false; resolve(); };
    utter.onend = done;
    utter.onerror = done;
    speaking.value = true;
    window.speechSynthesis.speak(utter);
  });
}

export function useTts() {
  return {
    serverTtsAvailable, speaking, speak, stop, ensureReady,
    voiceName, voices, loadVoices, setVoice,
  };
}
