import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { radioApi, type RadioStation } from '@/api/radio';
import { castApi, type CastDevice } from '@/api/cast';

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

  // Cast target: 'local' = play in this browser (HTMLAudioElement, the default),
  // or a device id = stream on that Google Cast speaker via the backend. Not
  // persisted across reloads — playback always resumes locally on a fresh load.
  const castTarget = ref<string>('local');
  const castDevices = ref<CastDevice[]>([]);

  // Whether the user explicitly closed the mini player. Reset whenever playback
  // (re)starts so the widget reappears.
  const miniDismissed = ref(localStorage.getItem(DISMISS_KEY) === '1');

  // ── getters ────────────────────────────────────────────────────────────────
  const muted = computed(() => volume.value === 0);

  const isCasting = computed(() => castTarget.value !== 'local');

  function castDeviceName(id: string): string {
    if (id === 'local') return 'Local';
    const d = castDevices.value.find((x) => x.id === id);
    return d ? d.name : 'dispozitiv';
  }

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
    // While casting we deliberately pause the local element; ignore its event
    // so it doesn't clobber the cast status messages.
    if (isCasting.value) return;
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

  // ── cast status polling ──────────────────────────────────────────────────────
  let castTimer: number | null = null;
  function stopCastStatusPolling(): void {
    if (castTimer !== null) {
      clearInterval(castTimer);
      castTimer = null;
    }
  }
  function fetchCastStatus(): void {
    if (!isCasting.value) return;
    const dev = castTarget.value;
    castApi
      .status(dev)
      .then((s) => {
        if (dev !== castTarget.value) return;
        npTrack.value = s.title || '';
        const state = (s.player_state || '').toUpperCase();
        if (state === 'PLAYING' || state === 'BUFFERING') {
          isPlaying.value = true;
        } else if (state) {
          // Device stopped/idle (e.g. someone cast something else to it).
          isPlaying.value = false;
        }
      })
      .catch(() => undefined);
  }
  function startCastStatusPolling(): void {
    stopCastStatusPolling();
    fetchCastStatus();
    castTimer = window.setInterval(fetchCastStatus, 5000);
  }

  function stopLocalAudio(): void {
    if (audio && !audio.paused) audio.pause();
    stopNowPlayingPolling();
  }

  // ── cast playback actions ────────────────────────────────────────────────────
  function playCast(station: RadioStation): void {
    stopLocalAudio();
    const name = castDeviceName(castTarget.value);
    npStatus.value = `Se trimite către ${name}...`;
    npStatusClass.value = 'loading';
    castApi
      .play(castTarget.value, station.id)
      .then(() => {
        isPlaying.value = true;
        npStatus.value = `Redare pe ${name} ●`;
        npStatusClass.value = '';
        startCastStatusPolling();
      })
      .catch((err: { message?: string }) => {
        isPlaying.value = false;
        npStatus.value = `Eroare cast: ${err?.message || 'dispozitiv indisponibil'}`;
        npStatusClass.value = 'error';
      });
  }

  function stopCast(): void {
    const dev = castTarget.value;
    stopCastStatusPolling();
    isPlaying.value = false;
    npStatus.value = 'Oprit';
    npStatusClass.value = '';
    localStorage.setItem(PLAY_KEY, '0');
    if (dev !== 'local') castApi.stop(dev).catch(() => undefined);
  }

  function loadCastDevices(): Promise<void> {
    return castApi
      .devices()
      .then((d) => {
        castDevices.value = d.devices || [];
      })
      .catch(() => undefined);
  }

  // Switch output between Local and a Cast device. If something is playing, it
  // moves to the new target (stopping the old one first — Problem 8 in the doc).
  function setCastTarget(target: string): void {
    if (target === castTarget.value) return;
    const wasPlaying = isPlaying.value;
    const station = currentStation.value;
    if (isCasting.value) stopCast();
    else stopLocalAudio();
    isPlaying.value = false;
    castTarget.value = target;
    // Pre-warm the device connection on selection: the cold connect (socket +
    // first status) is the bulk of the cast latency, so doing it now makes the
    // eventual Play near-instant. The cached live connection is reused by play.
    if (target !== 'local') castApi.status(target).catch(() => undefined);
    if (wasPlaying && station) play(station);
  }

  // ── playback actions ───────────────────────────────────────────────────────
  function markActive(): void {
    localStorage.setItem(PLAY_KEY, '1');
    localStorage.removeItem(DISMISS_KEY);
    miniDismissed.value = false;
  }

  function play(station: RadioStation): void {
    currentId.value = station.id;
    npName.value = station.name;
    npTrack.value = '';
    localStorage.setItem(LAST_KEY, station.id);
    markActive();
    if (isCasting.value) playCast(station);
    else playLocal(station);
  }

  function playLocal(station: RadioStation): void {
    const a = ensureAudio();
    npStatus.value = 'Se conectează...';
    npStatusClass.value = 'loading';

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
  }

  // Clicking a station in the list: toggles when it's the current one,
  // otherwise switches to the new station.
  function onStationClick(station: RadioStation): void {
    if (isCasting.value) {
      if (station.id === currentId.value && isPlaying.value) {
        stopCast();
        return;
      }
      play(station);
      return;
    }
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
    if (!currentId.value) return;
    if (isCasting.value) {
      if (isPlaying.value) stopCast();
      else if (currentStation.value) play(currentStation.value);
      return;
    }
    const a = ensureAudio();
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
    localStorage.setItem(VOL_KEY, String(clamped));
    if (clamped > 0) prevVolume = clamped;
    if (isCasting.value) {
      castApi.volume(castTarget.value, clamped / 100).catch(() => undefined);
    } else if (audio) {
      audio.volume = clamped / 100;
    }
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
    if (isCasting.value) stopCast();
    else if (audio) audio.pause();
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
    castTarget,
    castDevices,
    // getters
    muted,
    isCasting,
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
    loadCastDevices,
    setCastTarget,
    stopCast,
  };
});
