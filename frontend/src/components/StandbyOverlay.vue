<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/composables/useDateTime';

const emit = defineEmits<{ (e: 'wake'): void }>();

const { locale } = useI18n();
const now = ref(new Date());
const clockRef = ref<HTMLElement | null>(null);
const skipMinuteAnim = ref(true);
const localeTag = computed(() => (locale.value === 'ro' ? 'ro-RO' : 'en-US'));
const timeParts = computed(() => {
  const d = now.value;
  return {
    hours: String(d.getHours()).padStart(2, '0'),
    minutes: String(d.getMinutes()).padStart(2, '0'),
  };
});
const timeLabel = computed(() => `${timeParts.value.hours}:${timeParts.value.minutes}`);
const dateLabel = computed(() => formatDate(now.value, 'full', localeTag.value));

const pos = ref({ x: 50, y: 50 });
let moveTimer: number | null = null;
let minuteTimer: number | null = null;

function scheduleMinuteUpdate(): void {
  minuteTimer = window.setTimeout(() => {
    now.value = new Date();
    scheduleMinuteUpdate();
  }, 60_000 - (Date.now() % 60_000));
}

const SAFE_PAD_PX = 24;

async function randomPos(): Promise<void> {
  await nextTick();
  const el = clockRef.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!el || vw <= 0 || vh <= 0) {
    pos.value = { x: 50, y: 50 };
    return;
  }

  const halfW = el.offsetWidth / 2;
  const halfH = el.offsetHeight / 2;
  const minX = ((halfW + SAFE_PAD_PX) / vw) * 100;
  const maxX = ((vw - halfW - SAFE_PAD_PX) / vw) * 100;
  const minY = ((halfH + SAFE_PAD_PX) / vh) * 100;
  const maxY = ((vh - halfH - SAFE_PAD_PX) / vh) * 100;

  if (minX >= maxX || minY >= maxY) {
    pos.value = { x: 50, y: 50 };
    return;
  }

  pos.value = {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

function wake(): void {
  emit('wake');
}

function onResize(): void {
  void randomPos();
}

onMounted(async () => {
  now.value = new Date();
  scheduleMinuteUpdate();
  void randomPos();
  moveTimer = window.setInterval(() => void randomPos(), 45_000);
  window.addEventListener('resize', onResize);
  await nextTick();
  skipMinuteAnim.value = false;
});

onUnmounted(() => {
  if (moveTimer !== null) clearInterval(moveTimer);
  if (minuteTimer !== null) clearTimeout(minuteTimer);
  window.removeEventListener('resize', onResize);
});</script>

<template>
  <div
    class="standby-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="$t('standby_title')"
    @click="wake"
    @keydown="wake"
  >
    <div
      ref="clockRef"
      class="standby-clock"
      :style="{ left: `${pos.x}%`, top: `${pos.y}%` }"
      role="timer"
      :aria-label="timeLabel"
    >
      <div class="standby-time">
        <span class="standby-hours">{{ timeParts.hours }}</span><span class="standby-colon">:</span><span
          :key="timeParts.minutes"
          class="standby-minutes"
          :class="{ 'standby-minutes--turn': !skipMinuteAnim }"
        >{{ timeParts.minutes }}</span>
      </div>
      <div class="standby-date">{{ dateLabel }}</div>
      <div class="standby-hint">{{ $t('standby_tap_to_wake') }}</div>
    </div>
  </div>
</template>

<style src="@/assets/css/standby.css"></style>
