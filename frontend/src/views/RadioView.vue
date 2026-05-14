<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { radioApi } from '@/api/radio';
import type { RadioStation } from '@/api/radio';
import '@/assets/css/radio.css';

const VOL_KEY = 'rd-volume';
const LAST_KEY = 'rd-last-station';
const FAV_KEY = 'rd-favorites';
const PLAY_KEY = 'rd-playing';
const DISMISS_KEY = 'rd-mini-dismissed';

const audioEl = ref<HTMLAudioElement | null>(null);

const stations = ref<RadioStation[]>([]);
const currentId = ref<string | null>(null);
const favorites = ref<Set<string>>(new Set(loadFavorites()));
const loadFailed = ref(false);

const isPlaying = ref(false);
const npName = ref('Niciun post selectat');
const npStatus = ref('Selectați un post din listă pentru a porni redarea');
const npStatusClass = ref('');
const npTrack = ref('');

const volume = ref(loadVolume());
let prevVolume = volume.value > 0 ? volume.value : 80;

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
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

function streamUrlFor(station: RadioStation): string {
  return station.proxy ? radioApi.proxyUrl(station.id) : station.url;
}

// ── Now-playing (ICY metadata) polling ───────────────────────────────────────
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
      const audio = audioEl.value;
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

// ── Playback ─────────────────────────────────────────────────────────────────
function play(station: RadioStation): void {
  const audio = audioEl.value;
  if (!audio) return;
  currentId.value = station.id;
  npName.value = station.name;
  npStatus.value = 'Se conectează...';
  npStatusClass.value = 'loading';
  npTrack.value = '';

  audio.src = streamUrlFor(station);
  audio.play().catch((err: DOMException) => {
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
}

function onStationClick(station: RadioStation): void {
  const audio = audioEl.value;
  if (!audio) return;
  localStorage.setItem(PLAY_KEY, '1');
  localStorage.removeItem(DISMISS_KEY);

  if (station.id === currentId.value && !audio.paused) {
    audio.pause();
    localStorage.setItem(PLAY_KEY, '0');
    return;
  }
  if (station.id === currentId.value && audio.paused && audio.src) {
    audio.play().catch(() => undefined);
    return;
  }
  play(station);
}

function togglePlayPause(): void {
  const audio = audioEl.value;
  if (!audio || !currentId.value) return;
  if (audio.paused) {
    localStorage.setItem(PLAY_KEY, '1');
    localStorage.removeItem(DISMISS_KEY);
    audio.play().catch(() => undefined);
  } else {
    localStorage.setItem(PLAY_KEY, '0');
    audio.pause();
  }
}

function onVolumeInput(): void {
  const audio = audioEl.value;
  if (audio) audio.volume = volume.value / 100;
  localStorage.setItem(VOL_KEY, String(volume.value));
  if (volume.value > 0) prevVolume = volume.value;
}
function toggleMute(): void {
  const audio = audioEl.value;
  if (volume.value > 0) {
    prevVolume = volume.value;
    volume.value = 0;
  } else {
    volume.value = prevVolume || 80;
  }
  if (audio) audio.volume = volume.value / 100;
  localStorage.setItem(VOL_KEY, String(volume.value));
}

// ── Audio events ─────────────────────────────────────────────────────────────
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

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  const audio = audioEl.value;
  if (audio) audio.volume = volume.value / 100;

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
    play(last);
  } else {
    currentId.value = last.id;
    npName.value = last.name;
    npStatus.value = 'Apăsați play pentru a porni';
    npStatusClass.value = '';
  }
});

onUnmounted(() => {
  stopNowPlayingPolling();
  const audio = audioEl.value;
  if (audio) {
    try {
      audio.pause();
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <div class="radio-view">
    <div class="rd-body">
      <!-- Now playing bar -->
      <div class="rd-now-playing" :class="{ playing: isPlaying }">
        <div class="rd-np-info">
          <div class="rd-np-icon">
            <img
              v-if="currentStation && currentStation.logo"
              :src="currentStation.logo"
              :alt="currentStation.name"
            >
            <span v-else-if="currentStation">{{ initials(currentStation.name) }}</span>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9-9"/><path d="M4 15a5 5 0 0 1 5-5"/><circle cx="5" cy="19" r="2"/></svg>
          </div>
          <div class="rd-np-text">
            <div class="rd-np-name">{{ npName }}</div>
            <div class="rd-np-status" :class="npStatusClass">{{ npStatus }}</div>
            <div class="rd-np-track">{{ npTrack }}</div>
          </div>
        </div>
        <div class="rd-np-controls">
          <button
            type="button"
            class="rd-btn-play"
            :disabled="!currentId"
            aria-label="Play/Pauză"
            title="Play/Pauză"
            @click="togglePlayPause"
          >
            <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
          <div class="rd-volume-wrap">
            <button
              type="button"
              class="rd-btn-mute"
              :class="{ muted }"
              aria-label="Mute"
              title="Mute/Unmute"
              @click="toggleMute"
            >
              <svg v-if="!muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
            <input
              v-model.number="volume"
              type="range"
              class="rd-volume"
              min="0"
              max="100"
              aria-label="Volum"
              @input="onVolumeInput"
            >
          </div>
        </div>
      </div>

      <!-- Stations list -->
      <section class="rd-stations">
        <p v-if="loadFailed" class="rd-empty">Nu s-a putut încărca lista de posturi.</p>
        <p v-else-if="!stations.length" class="rd-empty">Se încarcă lista posturilor...</p>
        <div
          v-for="s in sortedStations"
          v-else
          :key="s.id"
          class="rd-station"
          :class="{
            favorite: isFavorite(s.id),
            active: s.id === currentId,
            playing: s.id === currentId && isPlaying,
          }"
        >
          <button
            type="button"
            class="rd-station-main"
            :aria-label="`Redă ${s.name}`"
            @click="onStationClick(s)"
          >
            <div class="rd-station-logo">
              <img v-if="s.logo" :src="s.logo" alt="">
              <span v-else>{{ initials(s.name) }}</span>
            </div>
            <div class="rd-station-info">
              <div class="rd-station-name">{{ s.name }}</div>
              <div class="rd-station-genre">{{ s.genre || s.description || '' }}</div>
            </div>
            <svg class="rd-station-playing-indicator" viewBox="0 0 12 12">
              <rect class="bar" x="1" y="2" width="2" height="8"/>
              <rect class="bar" x="5" y="2" width="2" height="8"/>
              <rect class="bar" x="9" y="2" width="2" height="8"/>
            </svg>
          </button>
          <button
            type="button"
            class="rd-station-fav"
            aria-label="Favorit"
            title="Adaugă/scoate din favorite"
            @click.stop="toggleFavorite(s.id)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      </section>
    </div>

    <audio
      ref="audioEl"
      preload="none"
      @playing="onAudioPlaying"
      @pause="onAudioPause"
      @waiting="onAudioWaiting"
      @error="onAudioError"
    ></audio>
  </div>
</template>
