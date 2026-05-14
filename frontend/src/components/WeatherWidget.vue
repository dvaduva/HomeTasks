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
  // 5 daily entries for the strip + the hourly series for the chart, like the
  // legacy popup (which fetched days=5 and days=2 separately).
  if (!store.forecast) await store.fetchForecast(prefs.data?.weather_city ?? undefined, 5);
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

// First ~16 hourly points feed both the chart and the hour strip below it.
const chartHours = computed(() => store.forecast?.hourly.slice(0, 16) ?? []);

// Cardinal-spline temperature chart — ported from the legacy drawWeatherChart().
const chart = computed(() => {
  const hours = chartHours.value;
  if (hours.length < 2) return null;
  const W = 1000, H = 120;
  const temps = hours.map((h) => h.temperature);
  const tMin = Math.min(...temps) - 1;
  const tMax = Math.max(...temps) + 1;
  const n = hours.length;
  const px = (i: number) => Math.round((i / (n - 1)) * (W - 24) + 12);
  const py = (t: number) => Math.round(H - 28 - ((t - tMin) / (tMax - tMin || 1)) * (H - 46));
  const pts = hours.map((h, i) => ({
    x: px(i),
    y: py(h.temperature),
    temp: Math.round(h.temperature),
    showLabel: i % 2 === 0 || i === n - 1,
  }));
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    line += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const fill = `${line} L ${pts[n - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  return { W, H, line, fill, pts };
});

function hourLabel(iso: string): string {
  return `${String(new Date(iso).getHours()).padStart(2, '0')}:00`;
}

function hourIsNow(iso: string): boolean {
  const dt = new Date(iso);
  const now = new Date();
  return dt.getDate() === now.getDate() && dt.getHours() === now.getHours();
}

// Place each hour item under its chart point (same formula as the chart's px()).
function hourStyle(i: number): Record<string, string> {
  const n = chartHours.value.length;
  if (i === 0) return { left: '0', transform: 'none' };
  if (i === n - 1) return { right: '0', left: 'auto', transform: 'none' };
  const pct = (((i / (n - 1)) * (1000 - 24) + 12) / 1000) * 100;
  return { left: `${pct.toFixed(2)}%` };
}
</script>

<template>
  <div class="weather" :title="$t('title_weather')" @click="openPopup">
    <img v-if="store.current?.icon" :src="iconUrl(store.current.icon)" :alt="store.current.description" class="wh-emoji" style="width:24px;height:24px;" />
    <span class="weather-temp" :class="{ dim: !store.current }">{{ tempDisplay }}</span>
    <div v-if="store.current" class="weather-info">
      <span class="weather-desc">{{ store.current.description }}</span>
      <span class="weather-city">{{ store.current.city }}</span>
    </div>
  </div>

  <div v-if="popupOpen" class="weather-popup">
    <div class="weather-popup-head">
      <span class="weather-popup-title">{{ $t('weather_popup_title') }} — {{ store.forecast?.city || store.current?.city || '' }}</span>
      <button type="button" class="weather-popup-close" :title="$t('btn_close')" @click="popupOpen = false">✕</button>
    </div>

    <div v-if="!store.forecast" class="weather-popup-forecast">
      <span v-for="i in 5" :key="i" class="forecast-skeleton"></span>
    </div>
    <div v-else class="weather-popup-forecast">
      <div
        v-for="d in store.forecast.daily.slice(0, 5)"
        :key="d.date"
        class="forecast-day"
        :class="{ today: isToday(d.date) }"
      >
        <span class="forecast-day-name">
          {{ isToday(d.date) ? $t('today_label') : new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }) }}
        </span>
        <img :src="d.icon_url" :alt="d.description" class="forecast-emoji" style="width:24px;height:24px;" />
        <div class="forecast-temps">
          <span class="forecast-temp-high">{{ Math.round(d.temp_max) }}°</span>
          <span class="forecast-temp-low">{{ Math.round(d.temp_min) }}°</span>
        </div>
        <span v-if="d.pop_avg > 0.1" class="forecast-pop">💧{{ Math.round(d.pop_avg * 100) }}%</span>
      </div>
    </div>

    <div v-if="chart" class="weather-popup-chart-wrap">
      <svg class="weather-chart" :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="chart.fill" fill="url(#wg)" stroke="none" />
        <path :d="chart.line" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" />
        <template v-for="(p, i) in chart.pts" :key="i">
          <circle :cx="p.x" :cy="p.y" r="3" fill="#3b82f6" stroke="white" stroke-width="1.5" />
          <text
            v-if="p.showLabel"
            :x="p.x"
            :y="p.y - 7"
            text-anchor="middle"
            font-size="11"
            fill="#334155"
            font-weight="600"
          >{{ p.temp }}°</text>
        </template>
      </svg>
    </div>

    <div v-if="chartHours.length" class="weather-popup-hours">
      <div
        v-for="(h, i) in chartHours"
        :key="h.datetime"
        class="weather-hour-item"
        :class="{ 'current-hour': hourIsNow(h.datetime) }"
        :style="hourStyle(i)"
      >
        <span class="wh-time">{{ hourLabel(h.datetime) }}</span>
        <img :src="h.icon_url" :alt="h.description" style="width:22px;height:22px;" />
        <span class="wh-temp">{{ Math.round(h.temperature) }}°</span>
        <span v-if="h.pop > 0.05" class="wh-pop">💧{{ Math.round(h.pop * 100) }}%</span>
      </div>
    </div>
  </div>
</template>
