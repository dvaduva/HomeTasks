<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale, type Locale } from '@/i18n';
import { useNow, formatDate, formatTime } from '@/composables/useDateTime';
import { usePreferencesStore } from '@/stores/preferences';
import { useAiStore } from '@/stores/ai';
import { useTuyaStore } from '@/stores/tuya';
import WeatherWidget from '@/components/WeatherWidget.vue';
import AiChat from '@/components/AiChat.vue';
import VoiceController from '@/components/VoiceController.vue';
import TuyaPanel from '@/components/TuyaPanel.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import ToastHost from '@/components/ToastHost.vue';

const { locale } = useI18n();
const prefs = usePreferencesStore();
const ai = useAiStore();
const tuya = useTuyaStore();

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
  // Preferences are loaded eagerly so date/time formats reflect user settings.
  if (!prefs.data) prefs.fetch();
});
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <div class="header-brand"><strong>HomeTasks</strong></div>
      <div class="date-time">{{ dateTimeLabel }}</div>
      <div class="header-right">
        <WeatherWidget />
        <button class="icon-btn" @click="$router.go(0)" :title="$t('title_reload')">↻</button>
        <button class="icon-btn" @click="settingsOpen = true" :title="$t('title_settings')">⚙</button>
        <button class="lang-toggle" @click="switchLocale">{{ isRo ? 'EN' : 'RO' }}</button>
      </div>
    </header>

    <main>
      <RouterView />
    </main>

    <footer class="app-footer">
      <div class="footer-left">
        <VoiceController />
      </div>
      <div class="footer-right">
        <button class="footer-btn" @click="openTuya" :title="$t('tuya_btn_label')">🌡</button>
        <a class="footer-btn" href="/history" :title="$t('history_btn_label')">⏱</a>
        <a class="footer-btn" href="/calendar" title="Calendar">📅</a>
        <a class="footer-btn" href="/transport" title="Transport">🚌</a>
        <a class="footer-btn" href="/radio" title="Radio">📻</a>
        <button class="footer-btn ai-btn" @click="toggleAi" title="AI Chat">🤖</button>
      </div>
    </footer>

    <AiChat />
    <TuyaPanel :open="tuyaOpen" @close="tuyaOpen = false" />
    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
    <ToastHost />
  </div>
</template>

<style>
:root {
  --header-bg: #2c3e50;
  --header-fg: #fff;
  --footer-bg: #fff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #fafafa;
}
#app-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--header-bg);
  color: var(--header-fg);
  height: 56px;
  flex-shrink: 0;
}
.app-header strong { font-size: 1.15rem; }
.date-time {
  font-size: 0.9rem;
  opacity: 0.9;
}
.header-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.icon-btn {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lang-toggle {
  background: transparent;
  color: var(--header-fg);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}
main { flex: 1; overflow: hidden; }
.app-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--footer-bg);
  border-top: 1px solid #eee;
  height: 56px;
  flex-shrink: 0;
}
.footer-left, .footer-right { display: flex; gap: 0.4rem; align-items: center; }
.footer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #333;
}
.footer-btn:hover { background: #f0f0f0; }
.footer-btn.ai-btn { background: #e3f2fd; }
</style>
