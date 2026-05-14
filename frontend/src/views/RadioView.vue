<script setup lang="ts">
import { onMounted } from 'vue';
import { useRadioStore } from '@/stores/radio';
import '@/assets/css/radio.css';

// Full radio page. All playback state and the <audio> element now live in the
// radio store, so this view and the floating RadioMiniPlayer stay in sync and
// playback keeps going when the user navigates away.

const radio = useRadioStore();

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

function onVolumeInput(e: Event): void {
  radio.setVolume(Number((e.target as HTMLInputElement).value));
}

onMounted(() => {
  radio.init();
});
</script>

<template>
  <div class="radio-view">
    <div class="rd-body">
      <!-- Now playing bar -->
      <div class="rd-now-playing" :class="{ playing: radio.isPlaying }">
        <div class="rd-np-info">
          <div class="rd-np-icon">
            <img
              v-if="radio.currentStation && radio.currentStation.logo"
              :src="radio.currentStation.logo"
              :alt="radio.currentStation.name"
            >
            <span v-else-if="radio.currentStation">{{ initials(radio.currentStation.name) }}</span>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9-9"/><path d="M4 15a5 5 0 0 1 5-5"/><circle cx="5" cy="19" r="2"/></svg>
          </div>
          <div class="rd-np-text">
            <div class="rd-np-name">{{ radio.npName }}</div>
            <div class="rd-np-status" :class="radio.npStatusClass">{{ radio.npStatus }}</div>
            <div class="rd-np-track">{{ radio.npTrack }}</div>
          </div>
        </div>
        <div class="rd-np-controls">
          <button
            type="button"
            class="rd-btn-play"
            :disabled="!radio.currentId"
            aria-label="Play/Pauză"
            title="Play/Pauză"
            @click="radio.togglePlayPause()"
          >
            <svg v-if="!radio.isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
          <div class="rd-volume-wrap">
            <button
              type="button"
              class="rd-btn-mute"
              :class="{ muted: radio.muted }"
              aria-label="Mute"
              title="Mute/Unmute"
              @click="radio.toggleMute()"
            >
              <svg v-if="!radio.muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
            <input
              :value="radio.volume"
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
        <p v-if="radio.loadFailed" class="rd-empty">Nu s-a putut încărca lista de posturi.</p>
        <p v-else-if="!radio.stations.length" class="rd-empty">Se încarcă lista posturilor...</p>
        <div
          v-for="s in radio.sortedStations"
          v-else
          :key="s.id"
          class="rd-station"
          :class="{
            favorite: radio.isFavorite(s.id),
            active: s.id === radio.currentId,
            playing: s.id === radio.currentId && radio.isPlaying,
          }"
        >
          <button
            type="button"
            class="rd-station-main"
            :aria-label="`Redă ${s.name}`"
            @click="radio.onStationClick(s)"
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
            @click.stop="radio.toggleFavorite(s.id)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
