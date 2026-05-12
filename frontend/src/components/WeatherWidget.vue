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
  async () => {
    await store.fetchCurrent(prefs.data?.weather_city);
  },
  { intervalMs: updateMs.value, immediate: true },
);

watch(
  () => prefs.data?.weather_city,
  (city) => {
    if (city) store.fetchCurrent(city);
  },
);

async function openPopup(): Promise<void> {
  popupOpen.value = true;
  if (!store.forecast) {
    await store.fetchForecast(prefs.data?.weather_city ?? undefined);
  }
}

function iconUrl(icon: string | undefined): string {
  return icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : '';
}

const tempDisplay = computed(() => {
  if (store.current?.temperature === undefined || store.current?.temperature === null) return '—°';
  return `${Math.round(store.current.temperature)}°`;
});
</script>

<template>
  <div class="weather-widget" @click="openPopup" :title="$t('title_weather')">
    <img v-if="store.current?.icon" :src="iconUrl(store.current.icon)" :alt="store.current.description" class="weather-icon" />
    <span class="weather-temp" :class="{ dim: !store.current }">{{ tempDisplay }}</span>
  </div>

  <div v-if="popupOpen" class="weather-popup-overlay" @click.self="popupOpen = false">
    <div class="weather-popup">
      <div class="weather-popup-head">
        <span class="weather-popup-title">{{ $t('weather_popup_title') }} — {{ store.forecast?.city || store.current?.city || '' }}</span>
        <button class="icon-btn" @click="popupOpen = false">✕</button>
      </div>

      <div v-if="!store.forecast" class="weather-popup-loading">{{ $t('loading') }}</div>

      <div v-else>
        <div class="weather-popup-forecast">
          <div v-for="d in store.forecast.daily.slice(0, 7)" :key="d.date" class="forecast-day">
            <div class="forecast-day-label">{{ new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }) }}</div>
            <img :src="d.icon_url" :alt="d.description" />
            <div class="forecast-temps">
              <span class="t-max">{{ Math.round(d.temp_max) }}°</span>
              <span class="t-min">{{ Math.round(d.temp_min) }}°</span>
            </div>
          </div>
        </div>

        <div class="weather-popup-hours">
          <div v-for="h in store.forecast.hourly.slice(0, 12)" :key="h.datetime" class="hour-cell">
            <div class="hour-time">{{ new Date(h.datetime).toLocaleTimeString(undefined, { hour: '2-digit' }) }}</div>
            <img :src="h.icon_url" :alt="h.description" />
            <div>{{ Math.round(h.temperature) }}°</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather-widget {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.weather-widget:hover {
  background: rgba(255, 255, 255, 0.1);
}
.weather-icon {
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}
.weather-temp {
  font-weight: 600;
}
.weather-temp.dim {
  opacity: 0.6;
}
.weather-popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.weather-popup {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  min-width: 380px;
  max-width: 720px;
  max-height: 85vh;
  overflow: auto;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}
.weather-popup-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.weather-popup-title {
  font-weight: 600;
}
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
}
.weather-popup-loading {
  padding: 1rem 0;
  color: #666;
}
.weather-popup-forecast {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.forecast-day {
  text-align: center;
  padding: 0.5rem 0.25rem;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 0.85rem;
}
.forecast-day img {
  width: 36px;
  height: 36px;
}
.forecast-temps {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
}
.t-max { font-weight: 600; }
.t-min { color: #888; }
.weather-popup-hours {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
  gap: 0.25rem;
}
.hour-cell {
  text-align: center;
  padding: 0.3rem 0.1rem;
  border-radius: 4px;
  font-size: 0.8rem;
  background: #fafafa;
}
.hour-cell img {
  width: 28px;
  height: 28px;
}
</style>
