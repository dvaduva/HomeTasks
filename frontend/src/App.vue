<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { setLocale, type Locale } from '@/i18n';
import { useNow, formatDate, formatTime } from '@/composables/useDateTime';
import { usePreferencesStore } from '@/stores/preferences';
import { useAiStore } from '@/stores/ai';
import { useTuyaStore } from '@/stores/tuya';
import { useRadioStore } from '@/stores/radio';
import WeatherWidget from '@/components/WeatherWidget.vue';
import AiChat from '@/components/AiChat.vue';
import VoiceController from '@/components/VoiceController.vue';
import TuyaPanel from '@/components/TuyaPanel.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import RadioMiniPlayer from '@/components/RadioMiniPlayer.vue';
import ToastHost from '@/components/ToastHost.vue';

const { locale } = useI18n();
const route = useRoute();
const prefs = usePreferencesStore();
const ai = useAiStore();
const tuya = useTuyaStore();
const radio = useRadioStore();

// The floating radio widget shows everywhere except the /radio page (which has
// its own player), as long as a station is selected and not user-dismissed.
const showMiniPlayer = computed(
  () =>
    !!radio.currentStation &&
    route.path !== '/radio' &&
    (!radio.miniDismissed || radio.isPlaying),
);

const settingsOpen = ref(false);
const tuyaOpen = ref(false);
const now = useNow(1000);

const isRo = computed(() => locale.value === 'ro');
const dateFormat = computed(() => (prefs.data?.date_format as 'short' | 'long' | 'full') || 'full');
const timeFormat = computed(() => (prefs.data?.time_format as '24' | '12') || '24');
const dateTimeLabel = computed(() => `${formatDate(now.value, dateFormat.value)} ${formatTime(now.value, timeFormat.value)}`);

function switchLocale(): void {
  const next: Locale = isRo.value ? 'en' : 'ro';
  setLocale(next);
}

function openTuya(): void {
  tuyaOpen.value = true;
  tuya.fetch();
}

function toggleAi(): void {
  ai.setOpen(!ai.open);
}

onMounted(() => {
  if (!prefs.data) prefs.fetch();
  // Restore the last radio station so the mini player can resume across reloads.
  radio.init();
});
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-brand">
        <strong>HomeTasks</strong>
      </div>
      <div class="date-time">{{ dateTimeLabel }}</div>
      <div class="header-right">
        <WeatherWidget />
        <button type="button" class="icon-btn" :title="$t('title_reload')" @click="$router.go(0)" aria-label="Reload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <button type="button" class="icon-btn" :title="$t('title_settings')" @click="settingsOpen = true" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button type="button" class="icon-btn lang-btn" @click="switchLocale" :title="isRo ? 'English' : 'Română'" aria-label="Language">
          {{ isRo ? 'EN' : 'RO' }}
        </button>
      </div>
    </header>

    <RouterView />

    <footer class="footer">
      <div class="footer-left">
        <VoiceController />
      </div>
      <div class="footer-right">
        <button type="button" class="footer-btn btn-tuya" :title="$t('tuya_btn_label')" @click="openTuya" aria-label="Tuya">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
        </button>
        <RouterLink class="footer-btn btn-history" to="/history" :title="$t('history_btn_label')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </RouterLink>
        <RouterLink class="footer-btn btn-calendar" to="/calendar" title="Calendar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </RouterLink>
        <RouterLink class="footer-btn btn-transport" to="/transport" title="Transport Public">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </RouterLink>
        <RouterLink class="footer-btn btn-radio" to="/radio" title="Radio Online">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9-9"/><path d="M4 15a5 5 0 0 1 5-5"/><circle cx="5" cy="19" r="2"/><path d="M14 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/></svg>
        </RouterLink>
        <button type="button" class="footer-btn btn-ai" @click="toggleAi" title="AI Chat" aria-label="AI Chat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </footer>

    <AiChat />
    <TuyaPanel :open="tuyaOpen" @close="tuyaOpen = false" />
    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
    <RadioMiniPlayer v-if="showMiniPlayer" />
    <ToastHost />
  </div>
</template>

<style>
.lang-btn { font-size: 13px !important; font-weight: 700; letter-spacing: 0.5px; }
</style>
