<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWeatherStore } from '@/stores/weather';
import { usePreferencesStore } from '@/stores/preferences';
import { usePolling } from '@/composables/usePolling';
import type { WeatherHourly } from '@/api/weather';
import { dateKey, isTodayDate, todayKey, weekdayIndexLocal } from '@/utils/localDate';

const POS_KEY = 'weather-popup-pos';
const SLOT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

type DaySlot =
  | { slotHour: number; kind: 'empty' }
  | {
      slotHour: number;
      kind: 'data' | 'current';
      temperature: number;
      icon_url: string;
      description: string;
      pop: number;
      datetime: string;
    };

const store = useWeatherStore();
const prefs = usePreferencesStore();
const { t, tm } = useI18n();

const popupOpen = ref(false);
const popupEl = ref<HTMLElement | null>(null);
const dragging = ref(false);
const selectedDayDate = ref('');

let startX = 0;
let startY = 0;
let origLeft = 0;
let origTop = 0;
let moved = false;

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
  if (!store.forecast) await store.fetchForecast(prefs.data?.weather_city ?? undefined, 5);
  selectedDayDate.value = defaultSelectedDay();
}

function defaultSelectedDay(): string {
  const days = store.forecast?.daily.slice(0, 5) ?? [];
  const today = days.find((d) => isToday(d.date));
  return today?.date ?? days[0]?.date ?? '';
}

function selectDay(date: string): void {
  selectedDayDate.value = date;
}

function iconUrl(icon: string | undefined): string {
  return icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : '';
}

const tempDisplay = computed(() => {
  if (store.current?.temperature === undefined || store.current?.temperature === null) return '—°';
  return `${Math.round(store.current.temperature)}°`;
});

function isToday(iso: string): boolean {
  return isTodayDate(iso);
}

function dayNameShort(iso: string): string {
  if (!iso) return '';
  if (isToday(iso)) return t('today_label');
  const names = tm('day_names_short') as string[];
  const idx = weekdayIndexLocal(iso);
  return Number.isNaN(idx) ? '' : (names[idx] ?? '');
}

const popupCity = computed(
  () => store.forecast?.city || store.current?.city || '',
);

function currentSlotHour(): number {
  return Math.floor(new Date().getHours() / 3) * 3;
}

function buildDaySlots(day: string): DaySlot[] {
  const hourly = store.forecast?.hourly ?? [];
  const byHour = new Map<number, WeatherHourly>();
  for (const h of hourly) {
    if (dateKey(h.datetime) !== day) continue;
    byHour.set(new Date(h.datetime).getHours(), h);
  }

  const today = isToday(day);
  const nowSlot = currentSlotHour();

  return SLOT_HOURS.map((slotHour) => {
    const api = byHour.get(slotHour);
    if (api) {
      return {
        slotHour,
        kind: today && slotHour === nowSlot ? 'current' : 'data',
        temperature: api.temperature,
        icon_url: api.icon_url,
        description: api.description,
        pop: api.pop,
        datetime: api.datetime,
      };
    }
    if (today && slotHour === nowSlot && store.current) {
      return {
        slotHour,
        kind: 'current',
        temperature: store.current.temperature,
        icon_url: iconUrl(store.current.icon),
        description: store.current.description ?? '',
        pop: 0,
        datetime: new Date().toISOString(),
      };
    }
    return { slotHour, kind: 'empty' };
  });
}

function slotLabel(slot: DaySlot): string {
  if (slot.kind === 'current') return t('weather_now');
  return `${String(slot.slotHour).padStart(2, '0')}:00`;
}

const daySlots = computed(() => {
  const day = selectedDayDate.value;
  if (!day) return [] as DaySlot[];
  return buildDaySlots(day);
});

const chartSlots = computed(() =>
  daySlots.value
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot.kind !== 'empty'),
);

// Fixed 8-column grid (00:00 … 21:00) so today matches the other days visually.
const chart = computed(() => {
  const entries = chartSlots.value;
  if (entries.length < 2) return null;
  const W = 1000, H = 120;
  const temps = entries.map(({ slot }) => (slot as Exclude<DaySlot, { kind: 'empty' }>).temperature);
  const tMin = Math.min(...temps) - 1;
  const tMax = Math.max(...temps) + 1;
  const px = (slotIndex: number) => Math.round((slotIndex / 7) * (W - 24) + 12);
  const py = (temp: number) => Math.round(H - 28 - ((temp - tMin) / (tMax - tMin || 1)) * (H - 46));
  const pts = entries.map(({ slot, index }) => {
    const s = slot as Exclude<DaySlot, { kind: 'empty' }>;
    return {
      x: px(index),
      y: py(s.temperature),
      isNow: s.kind === 'current',
    };
  });
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    line += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const fill = `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  return { W, H, line, fill, pts };
});

const hourGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${SLOT_HOURS.length}, minmax(0, 1fr))`,
}));

const hasHourlyData = computed(() => chartSlots.value.length > 0);

const dailyDays = computed(() => store.forecast?.daily.slice(0, 5) ?? []);

function clampToViewport(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const maxLeft = window.innerWidth - width - 4;
  const maxTop = window.innerHeight - height - 4;
  return {
    left: Math.max(4, Math.min(left, maxLeft)),
    top: Math.max(4, Math.min(top, maxTop)),
  };
}

function setExplicitPosition(wrap: HTMLElement, left: number, top: number, width: number): void {
  wrap.style.right = 'auto';
  wrap.style.width = `${width}px`;
  const height = wrap.getBoundingClientRect().height;
  const clamped = clampToViewport(left, top, width, height);
  wrap.style.left = `${clamped.left}px`;
  wrap.style.top = `${clamped.top}px`;
}

function clearInlinePosition(wrap: HTMLElement): void {
  wrap.style.left = '';
  wrap.style.top = '';
  wrap.style.right = '';
  wrap.style.width = '';
}

function applySavedPosition(): void {
  const wrap = popupEl.value;
  if (!wrap) return;
  const saved = localStorage.getItem(POS_KEY);
  if (!saved) {
    clearInlinePosition(wrap);
    return;
  }
  try {
    const { left, top, width } = JSON.parse(saved);
    if (typeof left !== 'number' || typeof top !== 'number') return;
    const w = typeof width === 'number' ? width : wrap.getBoundingClientRect().width;
    setExplicitPosition(wrap, left, top, w);
  } catch {
    clearInlinePosition(wrap);
  }
}

function ensureExplicitPosition(wrap: HTMLElement): { left: number; top: number; width: number } {
  const rect = wrap.getBoundingClientRect();
  setExplicitPosition(wrap, rect.left, rect.top, rect.width);
  return { left: rect.left, top: rect.top, width: rect.width };
}

function onDragStart(e: PointerEvent): void {
  const wrap = popupEl.value;
  if (!wrap || (e.button !== undefined && e.button !== 0)) return;
  if ((e.target as HTMLElement).closest('.weather-popup-close')) return;
  const pos = ensureExplicitPosition(wrap);
  origLeft = pos.left;
  origTop = pos.top;
  startX = e.clientX;
  startY = e.clientY;
  dragging.value = true;
  moved = false;
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

function onDragMove(e: PointerEvent): void {
  const wrap = popupEl.value;
  if (!dragging.value || !wrap) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
  const width = wrap.getBoundingClientRect().width;
  setExplicitPosition(wrap, origLeft + dx, origTop + dy, width);
}

function onDragEnd(e: PointerEvent): void {
  const wrap = popupEl.value;
  if (!dragging.value || !wrap) return;
  dragging.value = false;
  const handle = e.currentTarget as HTMLElement;
  if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture?.(e.pointerId);
  if (moved) {
    const rect = wrap.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top, width: rect.width }));
  }
}

watch(popupOpen, async (open) => {
  if (!open) return;
  await nextTick();
  applySavedPosition();
});

onMounted(() => {
  window.addEventListener('resize', applySavedPosition);
});

onUnmounted(() => {
  window.removeEventListener('resize', applySavedPosition);
});
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

  <div v-if="popupOpen" ref="popupEl" class="weather-popup" :class="{ dragging }">
    <div
      class="weather-popup-head"
      :title="$t('weather_popup_drag')"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
    >
      <div class="weather-popup-drag" aria-hidden="true">
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/><circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/><circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/></svg>
      </div>
      <div class="weather-popup-head-text">
        <span class="weather-popup-title">{{ $t('weather_popup_title') }}</span>
        <span v-if="popupCity" class="weather-popup-city">{{ popupCity }}</span>
      </div>
      <button type="button" class="weather-popup-close" :title="$t('btn_close')" @pointerdown.stop @click="popupOpen = false">✕</button>
    </div>

    <div v-if="!store.forecast" class="weather-popup-forecast">
      <span v-for="i in 5" :key="i" class="forecast-skeleton"></span>
    </div>
    <div v-else class="weather-popup-forecast">
      <button
        v-for="d in dailyDays"
        :key="d.date"
        type="button"
        class="forecast-day"
        :class="{ today: isToday(d.date), selected: d.date === selectedDayDate }"
        :aria-pressed="d.date === selectedDayDate"
        :aria-label="$t('weather_select_day', { day: dayNameShort(d.date) })"
        @click="selectDay(d.date)"
      >
        <span class="forecast-day-name">{{ dayNameShort(d.date) }}</span>
        <img :src="d.icon_url" :alt="d.description" class="forecast-emoji">
        <div class="forecast-temps">
          <span class="forecast-temp-high">{{ Math.round(d.temp_max) }}°</span>
          <span class="forecast-temp-sep">/</span>
          <span class="forecast-temp-low">{{ Math.round(d.temp_min) }}°</span>
        </div>
        <span v-if="d.pop_avg > 0.1" class="forecast-pop">{{ Math.round(d.pop_avg * 100) }}%</span>
      </button>
    </div>

    <p v-if="store.forecast && selectedDayDate && !hasHourlyData" class="weather-popup-empty">
      {{ $t('weather_no_hourly') }}
    </p>

    <p v-else-if="store.forecast && selectedDayDate && isToday(selectedDayDate)" class="weather-popup-hint">
      {{ $t('weather_today_hint') }}
    </p>

    <div v-if="chart" class="weather-popup-chart-wrap">
      <svg class="weather-chart" :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="weather-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#64748b" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#64748b" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="chart.fill" fill="url(#weather-chart-fill)" stroke="none" />
        <path :d="chart.line" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <template v-for="(p, i) in chart.pts" :key="i">
          <circle
            v-if="p.isNow"
            :cx="p.x"
            :cy="p.y"
            r="5"
            fill="#1d4ed8"
            stroke="#fff"
            stroke-width="2"
          />
        </template>
      </svg>
    </div>

    <div v-if="selectedDayDate && daySlots.length" class="weather-popup-hours" :style="hourGridStyle">
      <div
        v-for="slot in daySlots"
        :key="slot.slotHour"
        class="weather-hour-item"
        :class="{
          'current-hour': slot.kind === 'current',
          'wh-slot-empty': slot.kind === 'empty',
        }"
      >
        <span class="wh-time">{{ slotLabel(slot) }}</span>
        <template v-if="slot.kind !== 'empty'">
          <img :src="slot.icon_url" :alt="slot.description" class="wh-icon">
          <span class="wh-temp">{{ Math.round(slot.temperature) }}°</span>
          <span v-if="slot.pop > 0.05" class="wh-pop">{{ Math.round(slot.pop * 100) }}%</span>
        </template>
        <span v-else class="wh-missing" aria-hidden="true">—</span>
      </div>
    </div>
  </div>
</template>
