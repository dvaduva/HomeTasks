import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { radioApi, type RadioStation, type RadioStationInput } from '@/api/radio';
import { castApi, type CastDevice } from '@/api/cast';
import { btApi, type BtDevice } from '@/api/bt';
import { i18n } from '@/i18n';

// Status strings shown in the now-playing UI go through i18n. The store isn't a
// component, so we use the global instance rather than useI18n().
const t = (key: string, params?: Record<string, unknown>) =>
  i18n.global.t(key, params ?? {});

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
  // Now-playing name/status are locale-reactive: we store the i18n key (+ params)
  // rather than a pre-translated string, then derive the text via computed so a
  // language switch updates it live. A real value (e.g. a station name) is held
  // as a literal with key = null.
  const npNameKey = ref<string | null>('radio_np_none');
  const npNameLiteral = ref('');
  const npStatusKey = ref<string | null>('radio_np_hint');
  const npStatusParams = ref<Record<string, unknown>>({});
  const npStatusClass = ref<'' | 'loading' | 'error'>('');
  const npTrack = ref('');

  const npName = computed(() => {
    void i18n.global.locale.value; // re-evaluate on locale change
    return npNameKey.value ? t(npNameKey.value) : npNameLiteral.value;
  });
  const npStatus = computed(() => {
    void i18n.global.locale.value;
    return npStatusKey.value ? t(npStatusKey.value, npStatusParams.value) : '';
  });

  function setStatus(key: string, params?: Record<string, unknown>): void {
    npStatusKey.value = key;
    npStatusParams.value = params ?? {};
  }
  function setName(key: string): void {
    npNameKey.value = key;
  }
  function setNameLiteral(text: string): void {
    npNameKey.value = null;
    npNameLiteral.value = text;
  }

  const volume = ref(loadVolume());
  let prevVolume = volume.value > 0 ? volume.value : 80;

  // Output target — a single selector unifying all destinations:
  //   'local'        → play in this browser (HTMLAudioElement, the default)
  //   'cast:<id>'    → stream on a Google Cast speaker (backend tells it the URL)
  //   'bt:<mac>'     → play on a Bluetooth speaker (RPi is the player, backend)
  // Not persisted across reloads — playback always resumes locally on a fresh load.
  const target = ref<string>('local');
  const castDevices = ref<CastDevice[]>([]);
  const btDevices = ref<BtDevice[]>([]);
  // Whether this host can actually do Bluetooth (i.e. we're on the RPi). Gates
  // the pairing UI — it stays hidden on dev machines without BlueZ.
  const btAvailable = ref(false);

  // Whether the user explicitly closed the mini player. Reset whenever playback
  // (re)starts so the widget reappears.
  const miniDismissed = ref(localStorage.getItem(DISMISS_KEY) === '1');

  // ── getters ────────────────────────────────────────────────────────────────
  const muted = computed(() => volume.value === 0);

  // Output kind derived from the target prefix. 'isRemote' = anything the backend
  // drives (Cast or Bluetooth), as opposed to the local <audio> element.
  const outputKind = computed<'local' | 'cast' | 'bt'>(() => {
    if (target.value.startsWith('cast:')) return 'cast';
    if (target.value.startsWith('bt:')) return 'bt';
    return 'local';
  });
  const isRemote = computed(() => outputKind.value !== 'local');
  // The device id with its 'cast:'/'bt:' prefix stripped, for the backend calls.
  const bareDeviceId = computed(() => target.value.replace(/^(cast|bt):/, ''));

  function targetName(tgt: string): string {
    if (tgt === 'local') return t('radio_cast_local');
    const id = tgt.replace(/^(cast|bt):/, '');
    const list = tgt.startsWith('bt:') ? btDevices.value : castDevices.value;
    const d = list.find((x) => x.id === id);
    return d ? d.name : t('radio_cast_device');
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
    setStatus('radio_np_playing');
    npStatusClass.value = '';
    startNowPlayingPolling();
  }
  function onAudioPause(): void {
    // While playing remotely we deliberately pause the local element; ignore its
    // event so it doesn't clobber the remote status messages.
    if (isRemote.value) return;
    isPlaying.value = false;
    if (currentId.value) {
      setStatus('radio_np_paused');
      npStatusClass.value = '';
    }
    stopNowPlayingPolling();
  }
  function onAudioWaiting(): void {
    setStatus('radio_np_buffering');
    npStatusClass.value = 'loading';
  }
  function onAudioError(): void {
    setStatus('radio_np_error');
    npStatusClass.value = 'error';
    isPlaying.value = false;
    stopNowPlayingPolling();
  }

  function streamUrlFor(station: RadioStation): string {
    return station.proxy ? radioApi.proxyUrl(station.id) : station.url;
  }

  // ── remote status polling (Cast + Bluetooth) ─────────────────────────────────
  let remoteTimer: number | null = null;
  function stopRemoteStatusPolling(): void {
    if (remoteTimer !== null) {
      clearInterval(remoteTimer);
      remoteTimer = null;
    }
  }
  function fetchRemoteStatus(): void {
    if (!isRemote.value) return;
    const tgt = target.value;
    const dev = bareDeviceId.value;
    if (outputKind.value === 'bt') {
      btApi
        .status(dev)
        .then((s) => {
          if (tgt !== target.value) return;
          npTrack.value = s.title || '';
          isPlaying.value = s.state === 'playing';
        })
        .catch(() => undefined);
      return;
    }
    castApi
      .status(dev)
      .then((s) => {
        if (tgt !== target.value) return;
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
  function startRemoteStatusPolling(): void {
    stopRemoteStatusPolling();
    fetchRemoteStatus();
    remoteTimer = window.setInterval(fetchRemoteStatus, 5000);
  }

  function stopLocalAudio(): void {
    if (audio && !audio.paused) audio.pause();
    stopNowPlayingPolling();
  }

  // ── remote playback actions (Cast + Bluetooth) ───────────────────────────────
  function playRemote(station: RadioStation): void {
    stopLocalAudio();
    const name = targetName(target.value);
    const dev = bareDeviceId.value;
    const sender = outputKind.value === 'bt' ? btApi : castApi;
    setStatus('radio_cast_sending', { name });
    npStatusClass.value = 'loading';
    sender
      .play(dev, station.id)
      .then(() => {
        isPlaying.value = true;
        setStatus('radio_cast_playing', { name });
        npStatusClass.value = '';
        startRemoteStatusPolling();
      })
      .catch((err: { message?: string }) => {
        isPlaying.value = false;
        setStatus('radio_cast_error', {
          msg: err?.message || t('radio_cast_device_unavailable'),
        });
        npStatusClass.value = 'error';
      });
  }

  function stopRemote(): void {
    const kind = outputKind.value;
    const dev = bareDeviceId.value;
    stopRemoteStatusPolling();
    isPlaying.value = false;
    setStatus('radio_cast_stopped');
    npStatusClass.value = '';
    localStorage.setItem(PLAY_KEY, '0');
    if (kind === 'bt') btApi.stop(dev).catch(() => undefined);
    else if (kind === 'cast') castApi.stop(dev).catch(() => undefined);
  }

  function loadCastDevices(): Promise<void> {
    return castApi
      .devices()
      .then((d) => {
        castDevices.value = d.devices || [];
      })
      .catch(() => undefined);
  }

  function loadBtDevices(): Promise<void> {
    return btApi
      .devices()
      .then((d) => {
        btDevices.value = d.devices || [];
        btAvailable.value = !!d.available;
      })
      .catch(() => undefined);
  }

  // Load both remote device lists (Cast + Bluetooth) for the unified selector.
  function loadOutputDevices(): Promise<void> {
    return Promise.all([loadCastDevices(), loadBtDevices()]).then(() => undefined);
  }

  // Switch output between Local, a Cast device and a Bluetooth speaker. If
  // something is playing, it moves to the new target (stopping the old one
  // first — Problem 8 in the doc).
  function setTarget(next: string): void {
    if (next === target.value) return;
    const wasPlaying = isPlaying.value;
    const station = currentStation.value;
    if (isRemote.value) stopRemote();
    else stopLocalAudio();
    isPlaying.value = false;
    target.value = next;
    // Pre-warm a Cast device on selection: the cold connect (socket + first
    // status) is the bulk of the cast latency, so doing it now makes the eventual
    // Play near-instant. (Bluetooth connects inside play, so no pre-warm here.)
    if (next.startsWith('cast:')) {
      castApi.status(next.slice('cast:'.length)).catch(() => undefined);
    }
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
    setNameLiteral(station.name);
    npTrack.value = '';
    localStorage.setItem(LAST_KEY, station.id);
    markActive();
    if (isRemote.value) playRemote(station);
    else playLocal(station);
  }

  function playLocal(station: RadioStation): void {
    const a = ensureAudio();
    setStatus('radio_np_connecting');
    npStatusClass.value = 'loading';

    a.src = streamUrlFor(station);
    a.play().catch((err: DOMException) => {
      if (err && err.name === 'NotAllowedError') {
        setStatus('radio_np_press_play_resume');
        npStatusClass.value = '';
      } else {
        setStatus('radio_np_play_error');
        npStatusClass.value = 'error';
      }
      isPlaying.value = false;
      stopNowPlayingPolling();
    });
  }

  // Clicking a station in the list: toggles when it's the current one,
  // otherwise switches to the new station.
  function onStationClick(station: RadioStation): void {
    if (isRemote.value) {
      if (station.id === currentId.value && isPlaying.value) {
        stopRemote();
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

  // Step to the next/previous station in list order, wrapping around. Used by
  // voice/AI commands ("postul următor"). Plays on the current output target.
  function stepStation(delta: number): void {
    const list = stations.value;
    if (!list.length) return;
    const idx = currentId.value ? list.findIndex((s) => s.id === currentId.value) : -1;
    const next = list[(idx + delta + list.length) % list.length] ?? list[0];
    if (next) play(next);
  }
  function playNext(): void {
    stepStation(1);
  }
  function playPrev(): void {
    stepStation(-1);
  }

  function togglePlayPause(): void {
    if (!currentId.value) return;
    if (isRemote.value) {
      if (isPlaying.value) stopRemote();
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
    if (isRemote.value) {
      const dev = bareDeviceId.value;
      const sender = outputKind.value === 'bt' ? btApi : castApi;
      sender.volume(dev, clamped / 100).catch(() => undefined);
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
    if (isRemote.value) stopRemote();
    else if (audio) audio.pause();
    localStorage.setItem(PLAY_KEY, '0');
    localStorage.setItem(DISMISS_KEY, '1');
    miniDismissed.value = true;
  }

  // ── admin (station management) ───────────────────────────────────────────────
  // Editor mutations go straight to the backend (DB), then we re-pull the list so
  // the player, mini-widget and favorites all reflect the new set immediately.
  async function refreshStations(): Promise<void> {
    const data = await radioApi.stations();
    stations.value = data.stations || [];
    loadFailed.value = false;
  }

  async function createStation(data: RadioStationInput): Promise<RadioStation> {
    const created = await radioApi.create(data);
    await refreshStations();
    return created;
  }

  async function updateStation(id: string, data: Partial<RadioStationInput>): Promise<void> {
    await radioApi.update(id, data);
    await refreshStations();
    // If the live station changed, refresh the now-playing label.
    if (id === currentId.value) {
      const st = currentStation.value;
      if (st) setNameLiteral(st.name);
    }
  }

  async function deleteStation(id: string): Promise<void> {
    // If we're deleting what's currently playing, stop first so we don't leave a
    // dangling reference to a station that no longer exists.
    if (id === currentId.value) {
      if (isRemote.value) stopRemote();
      else stopLocalAudio();
      isPlaying.value = false;
      currentId.value = null;
      setName('radio_np_none');
      setStatus('radio_np_hint');
      npStatusClass.value = '';
      localStorage.setItem(PLAY_KEY, '0');
    }
    await radioApi.remove(id);
    if (favorites.value.has(id)) toggleFavorite(id);
    await refreshStations();
  }

  async function reorderStations(order: string[]): Promise<void> {
    const data = await radioApi.reorder(order);
    stations.value = data.stations || [];
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
        setNameLiteral(last.name);
        setStatus('radio_np_press_play_start');
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
    target,
    castDevices,
    btDevices,
    btAvailable,
    // getters
    muted,
    outputKind,
    isRemote,
    currentStation,
    sortedStations,
    // actions
    init,
    play,
    playNext,
    playPrev,
    onStationClick,
    togglePlayPause,
    setVolume,
    toggleMute,
    isFavorite,
    toggleFavorite,
    dismissMini,
    targetName,
    loadCastDevices,
    loadBtDevices,
    loadOutputDevices,
    setTarget,
    stopRemote,
    // admin
    refreshStations,
    createStation,
    updateStation,
    deleteStation,
    reorderStations,
  };
});
