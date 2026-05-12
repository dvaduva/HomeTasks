<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWeatherStore } from '@/stores/weather';
import { usePreferencesStore } from '@/stores/preferences';
import { usePolling } from '@/composables/usePolling';

const store = useWeatherStore();
const prefs = usePreferencesStore();

const popupOpen = ref(false);

const updateMs = computed(() => Math.max(5, prefs.data?.weather_update_interval ?? 30) * 60 * 1000);

usePolling(
  async () => { await store.fetchCurrent(prefs.data?.weather_city); },
  { intervalMs: updateMs.value, immediate: true },
);

watch(
  () => prefs.data?.weather_city,
  (city) => { if (city) store.fetchCurrent(city); },
);

async function openPopup(): Promise<void> {
  popupOpen.value = true;
  if (!store.forecast) await store.fetchForecast(prefs.data?.weather_city ?? undefined);
}

function iconUrl(icon: string | undefined): string {
  return icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : '';
}

const tempDisplay = computed(() => {
  if (store.current?.temperature === undefined || store.current?.temperature === null) return '—°';
  return `${Math.round(store.current.temperature)}°`;
});

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}
</script>

<template>
  <div class="weather" :title="$t('title_weather')" @click="openPopup">
    <img v-if="store.current?.icon" :src="iconUrl(store.current.icon)" :alt="store.current.description" class="wh-emoji" style="width:24px;height:24px;" />
    <span class="weather-temp" :class="{ dim: !store.current }">{{ tempDisplay }}</span>
  </div>

  <div v-if="popupOpen" class="weather-popup">
    <div class="weather-popup-head">
      <span class="weather-popup-title">{{ $t('weather_popup_title') }} — {{ store.forecast?.city || store.current?.city || '' }}</span>
      <button type="button" class="weather-popup-close" :title="$t('btn_close')" @click="popupOpen = false">✕</button>
    </div>

    <div v-if="!store.forecast" class="weather-popup-forecast">
      <span class="forecast-skeleton"></span>
      <span class="forecast-skeleton"></span>
      <span class="forecast-skeleton"></span>
      <span class="forecast-skeleton"></span>
      <span class="forecast-skeleton"></span>
    </div>
    <div v-else class="weather-popup-forecast">
      <div
        v-for="d in store.forecast.daily.slice(0, 7)"
        :key="d.date"
        class="forecast-day"
        :class="{ today: isToday(d.date) }"
      >
        <span class="forecast-day-name">{{ new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }) }}</span>
        <img :src="d.icon_url" :alt="d.description" class="forecast-emoji" style="width:24px;height:24px;" />
        <span class="forecast-temps">
          <span class="forecast-temp-high">{{ Math.round(d.temp_max) }}°</span>
          <span class="forecast-temp-low">{{ Math.round(d.temp_min) }}°</span>
        </span>
        <span v-if="d.pop_avg > 0" class="forecast-pop">💧{{ Math.round(d.pop_avg * 100) }}%</span>
      </div>
    </div>

    <div v-if="store.forecast" class="weather-popup-hours" style="height:auto;display:flex;flex-wrap:wrap;gap:4px;padding:8px 16px;">
      <div
        v-for="h in store.forecast.hourly.slice(0, 12)"
        :key="h.datetime"
        class="weather-hour-item"
        style="position:static;transform:none;"
      >
        <span class="wh-time">{{ new Date(h.datetime).toLocaleTimeString(undefined, { hour: '2-digit' }) }}</span>
        <img :src="h.icon_url" :alt="h.description" style="width:22px;height:22px;" />
        <span class="wh-temp">{{ Math.round(h.temperature) }}°</span>
        <span v-if="h.pop > 0" class="wh-pop">{{ Math.round(h.pop * 100) }}%</span>
      </div>
    </div>
  </div>
</template>
