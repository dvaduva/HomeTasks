<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRadioStore } from '@/stores/radio';
import RadioStationsManager from '@/components/RadioStationsManager.vue';
import BluetoothManager from '@/components/BluetoothManager.vue';
import '@/assets/css/radio.css';

const managerOpen = ref(false);
const btManagerOpen = ref(false);
const targetPickerOpen = ref(false);
const query = ref('');

// Full radio page. All playback state and the <audio> element now live in the
// radio store, so this view and the floating RadioMiniPlayer stay in sync and
// playback keeps going when the user navigates away.

const radio = useRadioStore();

const visibleStations = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return radio.sortedStations;
  return radio.sortedStations.filter((s) =>
    [s.name, s.genre, s.description, s.url].some((f) => (f || '').toLowerCase().includes(q)),
  );
});

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

// Pick a destination from the popup, then close it.
function pickTarget(tgt: string): void {
  radio.setTarget(tgt);
  targetPickerOpen.value = false;
}

// Open the pairing dialog from inside the destination popup.
function openBtManager(): void {
  targetPickerOpen.value = false;
  btManagerOpen.value = true;
}

onMounted(() => {
  radio.init();
  radio.loadOutputDevices();
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
            class="rd-btn-output"
            :class="{ active: radio.target !== 'local' }"
            :title="$t('radio_play_on') + ': ' + radio.targetName(radio.target)"
            :aria-label="$t('radio_play_on') + ': ' + radio.targetName(radio.target)"
            @click="targetPickerOpen = true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>
          </button>
          <button
            type="button"
            class="rd-btn-play"
            :disabled="!radio.currentId"
            :aria-label="$t('radio_play_pause')"
            :title="$t('radio_play_pause')"
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
              :aria-label="$t('radio_mute')"
              :title="$t('radio_mute')"
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
              :aria-label="$t('radio_volume')"
              @input="onVolumeInput"
            >
          </div>
        </div>
      </div>

      <!-- Stations list -->
      <div class="rd-stations-head">
        <h2 class="rd-stations-title">{{ $t('radio_stations_title') }}</h2>
        <button type="button" class="rd-manage-btn" :title="$t('radio_manage_title')" @click="managerOpen = true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
      <div v-if="radio.stations.length" class="rd-search">
        <svg class="rd-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" v-model="query" :placeholder="$t('radio_search_ph')" :aria-label="$t('radio_search_ph')">
        <button
          v-if="query"
          type="button"
          class="rd-search-clear"
          :aria-label="$t('radio_search_clear')"
          :title="$t('radio_search_clear')"
          @click="query = ''"
        >✕</button>
      </div>
      <section class="rd-stations">
        <p v-if="radio.loadFailed" class="rd-empty">{{ $t('radio_load_failed') }}</p>
        <p v-else-if="!radio.stations.length" class="rd-empty">{{ $t('radio_loading') }}</p>
        <p v-else-if="!visibleStations.length" class="rd-empty">{{ $t('radio_search_empty') }}</p>
        <div
          v-for="s in visibleStations"
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
            :aria-label="$t('radio_play_station', { name: s.name })"
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
            :aria-label="$t('radio_favorite')"
            :title="$t('radio_favorite_toggle')"
            @click.stop="radio.toggleFavorite(s.id)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      </section>
    </div>

    <!-- Output destination picker (opened by the compact "Redă pe" button) -->
    <div v-if="targetPickerOpen" class="modal-overlay active" @click.self="targetPickerOpen = false">
      <div class="modal rd-output-modal">
        <div class="modal-head">
          <h2>{{ $t('radio_play_on') }}</h2>
          <button type="button" class="icon-btn" :title="$t('radio_bt_close')" @click="targetPickerOpen = false">✕</button>
        </div>
        <ul class="rd-output-list">
          <li>
            <button
              type="button"
              class="rd-output-opt"
              :class="{ active: radio.target === 'local' }"
              @click="pickTarget('local')"
            >
              <svg class="rd-output-opt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span class="rd-output-opt-name">{{ $t('radio_this_device') }}</span>
              <svg v-if="radio.target === 'local'" class="rd-output-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </li>

          <template v-if="radio.castDevices.length">
            <li class="rd-output-group">{{ $t('radio_cast_group') }}</li>
            <li v-for="d in radio.castDevices" :key="'cast:' + d.id">
              <button
                type="button"
                class="rd-output-opt"
                :class="{ active: radio.target === 'cast:' + d.id }"
                @click="pickTarget('cast:' + d.id)"
              >
                <svg class="rd-output-opt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>
                <span class="rd-output-opt-name">{{ d.name }}</span>
                <svg v-if="radio.target === 'cast:' + d.id" class="rd-output-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </li>
          </template>

          <template v-if="radio.btDevices.length">
            <li class="rd-output-group">{{ $t('radio_bt_group') }}</li>
            <li v-for="d in radio.btDevices" :key="'bt:' + d.id">
              <button
                type="button"
                class="rd-output-opt"
                :class="{ active: radio.target === 'bt:' + d.id }"
                @click="pickTarget('bt:' + d.id)"
              >
                <svg class="rd-output-opt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>
                <span class="rd-output-opt-name">{{ d.name }}</span>
                <svg v-if="radio.target === 'bt:' + d.id" class="rd-output-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </li>
          </template>
        </ul>

        <div class="modal-actions rd-output-actions">
          <button type="button" class="btn btn-secondary btn-sm" @click="radio.loadOutputDevices()">
            ⟳
          </button>
          <button v-if="radio.btAvailable" type="button" class="btn btn-secondary btn-sm" @click="openBtManager">
             {{ $t('radio_bt_manage_title') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="targetPickerOpen = false">
            X {{ $t('radio_bt_close') }}
          </button>
        </div>
      </div>
    </div>

    <RadioStationsManager :open="managerOpen" @close="managerOpen = false" />
    <BluetoothManager :open="btManagerOpen" @close="btManagerOpen = false" />
  </div>
</template>

<style scoped>
/* Compact destination button, placed inside the now-playing controls (no extra
   row — vertical space is scarce on the 7" screen). Opens the picker popup. */
.rd-btn-output {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--rd-gray-300);
  background: var(--rd-gray-50);
  color: var(--rd-gray-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.rd-btn-output:hover {
  background: var(--rd-accent-lt);
  color: var(--rd-accent-dk);
  border-color: var(--rd-accent);
}
/* Highlighted when playing somewhere other than this browser (Cast / Bluetooth). */
.rd-btn-output.active {
  background: var(--rd-accent);
  color: var(--rd-white);
  border-color: var(--rd-accent);
}

.rd-stations-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 2px 10px;
}
.rd-stations-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--rd-gray-700);
  margin: 0;
}
.rd-manage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--rd-gray-300);
  background: var(--rd-white);
  color: var(--rd-gray-700);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.rd-manage-btn:hover {
  background: var(--rd-accent-lt);
  color: var(--rd-accent-dk);
  border-color: var(--rd-accent);
}
.rd-manage-btn svg { flex: 0 0 auto; }

.rd-search {
  position: relative;
  margin: 0 2px 12px;
}
.rd-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rd-gray-500);
  pointer-events: none;
}
.rd-search input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 40px 10px 36px;
  border-radius: 8px;
  border: 1px solid var(--rd-gray-300);
  background: var(--rd-white);
  color: var(--rd-gray-900);
  font-size: 14px;
  font-family: inherit;
}
.rd-search input:focus {
  outline: none;
  border-color: var(--rd-accent);
  box-shadow: 0 0 0 3px var(--rd-accent-lt);
}
.rd-search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--rd-gray-100, #f1f5f9);
  color: var(--rd-gray-500);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rd-search-clear:hover {
  background: var(--rd-accent-lt);
  color: var(--rd-accent-dk);
}

/* Destination picker popup (reuses the global .modal / .modal-head / .modal-actions). */
.rd-output-modal {
  max-width: 440px;
}
.rd-output-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  max-height: min(55vh, 420px);
}
.rd-output-group {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rd-gray-500, #64748b);
  padding: 12px 8px 4px;
}
.rd-output-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--rd-gray-900);
  font-size: 14px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.rd-output-opt:hover {
  background: var(--rd-gray-50, #f8fafc);
}
.rd-output-opt.active {
  background: var(--rd-accent-lt);
  border-color: var(--rd-accent);
  color: var(--rd-accent-dk);
}
.rd-output-opt-icon {
  flex: 0 0 auto;
  color: var(--rd-gray-500);
}
.rd-output-opt.active .rd-output-opt-icon {
  color: var(--rd-accent-dk);
}
.rd-output-opt-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.rd-output-check {
  flex: 0 0 auto;
  color: var(--rd-accent);
}
/* let the action buttons wrap on narrow screens instead of overflowing */
.rd-output-actions {
  flex-wrap: wrap;
}
</style>
