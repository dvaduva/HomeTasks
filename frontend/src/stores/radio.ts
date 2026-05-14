import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { radioApi, type RadioStation } from '@/api/radio';

// Persistent radio store — owns a single <audio> element that lives as long as
// the app does. Both RadioView.vue (full page) and RadioMiniPlayer.vue (floating
// widget mounted in App.vue) are thin UIs over this store, so playback survives
// client-side navigation between views.

const VOL_KEY = 'rd-volume';
const LAST_KEY = 'rd-last-station';
const FAV_KEY = 'rd-favorites';
const PLAY_KEY = 'rd-playing';
const DISMISS_KEY = 'rd-mini-dismissed';

function loadFavorites(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function loadVolume(): number {
  const v = parseInt(localStorage.getItem(VOL_KEY) ?? '80', 10);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80;
}

export const useRadioStore = defineStore('radio', () => {
  // ── state ──────────────────────────────────────────────────────────────────
  const stations = ref<RadioStation[]>([]);
  const currentId = ref<string | null>(null);
  const favorites = ref<Set<string>>(new Set(loadFavorites()));
  const loadFailed = ref(false);

  const isPlaying = ref(false);
  const npName = ref('Niciun post selectat');
  const npStatus = ref('Selectați un post din listă pentru a porni redarea');
  const npStatusClass = ref<'' | 'loading' | 'error'>('');
  const npTrack = ref('');

  const volume = ref(loadVolume());
  let prevVolume = volume.value > 0 ? volume.value : 80;

  // Whether the user explicitly closed the mini player. Reset whenever playback
  // (re)starts so the widget reappears.
  const miniDismissed = ref(localStorage.getItem(DISMISS_KEY) === '1');

  // ── getters ────────────────────────────────────────────────────────────────
  const muted = computed(() => volume.value === 0);

  const currentStation = computed<RadioStation | null>(
    () => stations.value.find((s) => s.id === currentId.value) || null,
  );

  const sortedStations = computed<RadioStation[]>(() =>
    [...stations.value].sort((a, b) => {
      const fa = favorites.value.has(a.id) ? 0 : 1;
      const fb = favorites.value.has(b.id) ? 0 : 1;
      return fa - fb;
    }),
  );

  // ── audio element (singleton; persists for the app lifetime) ───────────────
  let audio: HTMLAudioElement | null = null;
  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio;
    const a = new Audio();
    a.preload = 'none';
    a.volume = volume.value / 100;
    a.addEventListener('playing', onAudioPlaying);
    a.addEventListener('pause', onAudioPause);
    a.addEventListener('waiting', onAudioWaiting);
    a.addEventListener('error', onAudioError);
    audio = a;
    return a;
  }

  // ── now-playing (ICY metadata) polling ─────────────────────────────────────
  let npTimer: number | null = null;
  function stopNowPlayingPolling(): void {
    if (npTimer !== null) {
      clearInterval(npTimer);
      npTimer = null;
    }
    npTrack.value = '';
  }
  function fetchNowPlaying(): void {
    const requestedId = currentId.value;
    if (!requestedId) return;
    radioApi
      .nowPlaying(requestedId)
      .then((data) => {
        if (requestedId !== currentId.value || !audio || audio.paused) return;
        npTrack.value = data && data.title ? data.title : '';
      })
      .catch(() => undefined);
  }
  function startNowPlayingPolling(): void {
    stopNowPlayingPolling();
    fetchNowPlaying();
    npTimer = window.setInterval(fetchNowPlaying, 20000);
  }

  // ── audio events ───────────────────────────────────────────────────────────
  function onAudioPlaying(): void {
    isPlaying.value = true;
    npStatus.value = 'În redare ●';
    npStatusClass.value = '';
    startNowPlayingPolling();
  }
  function onAudioPause(): void {
    isPlaying.value = false;
    if (currentId.value) {
      npStatus.value = 'În pauză';
      npStatusClass.value = '';
    }
    stopNowPlayingPolling();
  }
  function onAudioWaiting(): void {
    npStatus.value = 'Se încarcă...';
    npStatusClass.value = 'loading';
  }
  function onAudioError(): void {
    npStatus.value = 'Eroare: stream indisponibil sau format neacceptat.';
    npStatusClass.value = 'error';
    isPlaying.value = false;
    stopNowPlayingPolling();
  }

  function streamUrlFor(station: RadioStation): string {
    return station.proxy ? radioApi.proxyUrl(station.id) : station.url;
  }

  // ── playback actions ───────────────────────────────────────────────────────
  function markActive(): void {
    localStorage.setItem(PLAY_KEY, '1');
    localStorage.removeItem(DISMISS_KEY);
    miniDismissed.value = false;
  }

  function play(station: RadioStation): void {
    const a = ensureAudio();
    currentId.value = station.id;
    npName.value = station.name;
    npStatus.value = 'Se conectează...';
    npStatusClass.value = 'loading';
    npTrack.value = '';

    a.src = streamUrlFor(station);
    a.play().catch((err: DOMException) => {
      if (err && err.name === 'NotAllowedError') {
        npStatus.value = 'Apăsați play pentru a relua redarea';
        npStatusClass.value = '';
      } else {
        npStatus.value = 'Eroare la redare. Verificați adresa stream-ului.';
        npStatusClass.value = 'error';
      }
      isPlaying.value = false;
      stopNowPlayingPolling();
    });

    localStorage.setItem(LAST_KEY, station.id);
    markActive();
  }

  // Clicking a station in the list: toggles when it's the current one,
  // otherwise switches to the new station.
  function onStationClick(station: RadioStation): void {
    const a = ensureAudio();
    if (station.id === currentId.value && !a.paused) {
      a.pause();
      localStorage.setItem(PLAY_KEY, '0');
      return;
    }
    if (station.id === currentId.value && a.paused && a.src) {
      markActive();
      a.play().catch(() => undefined);
      return;
    }
    play(station);
  }

  function togglePlayPause(): void {
    const a = ensureAudio();
    if (!currentId.value) return;
    if (a.paused) {
      // Station restored from a previous session but never streamed yet.
      if (!a.src) {
        const st = currentStation.value;
        if (st) {
          play(st);
          return;
        }
      }
      markActive();
      a.play().catch(() => undefined);
    } else {
      localStorage.setItem(PLAY_KEY, '0');
      a.pause();
    }
  }

  function setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    volume.value = clamped;
    if (audio) audio.volume = clamped / 100;
    localStorage.setItem(VOL_KEY, String(clamped));
    if (clamped > 0) prevVolume = clamped;
  }
  function toggleMute(): void {
    if (volume.value > 0) {
      prevVolume = volume.value;
      setVolume(0);
    } else {
      setVolume(prevVolume || 80);
    }
  }

  function isFavorite(id: string): boolean {
    return favorites.value.has(id);
  }
  function toggleFavorite(id: string): void {
    const next = new Set(favorites.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    favorites.value = next;
    localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
  }

  // User closed the floating widget — stop playback and remember the choice.
  function dismissMini(): void {
    if (audio) audio.pause();
    localStorage.setItem(PLAY_KEY, '0');
    localStorage.setItem(DISMISS_KEY, '1');
    miniDismissed.value = true;
  }

  // ── init ───────────────────────────────────────────────────────────────────
  // Idempotent: App.vue and RadioView.vue both call it; only the first runs.
  let initPromise: Promise<void> | null = null;
  function init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      ensureAudio();
      try {
        const data = await radioApi.stations();
        stations.value = data.stations || [];
      } catch {
        loadFailed.value = true;
        return;
      }

      const lastId = localStorage.getItem(LAST_KEY);
      if (!lastId) return;
      const last = stations.value.find((s) => s.id === lastId);
      if (!last) return;

      if (localStorage.getItem(PLAY_KEY) === '1') {
        // Browsers may block autoplay — play() degrades gracefully to a prompt.
        play(last);
      } else {
        currentId.value = last.id;
        npName.value = last.name;
        npStatus.value = 'Apăsați play pentru a porni';
        npStatusClass.value = '';
      }
    })();
    return initPromise;
  }

  return {
    // state
    stations,
    currentId,
    favorites,
    loadFailed,
    isPlaying,
    npName,
    npStatus,
    npStatusClass,
    npTrack,
    volume,
    miniDismissed,
    // getters
    muted,
    currentStation,
    sortedStations,
    // actions
    init,
    play,
    onStationClick,
    togglePlayPause,
    setVolume,
    toggleMute,
    isFavorite,
    toggleFavorite,
    dismissMini,
  };
});
