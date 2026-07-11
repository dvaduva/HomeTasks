<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNow, formatDate } from '@/composables/useDateTime';
import { usePreferencesStore } from '@/stores/preferences';

const emit = defineEmits<{ (e: 'wake'): void }>();

const { locale } = useI18n();
const prefs = usePreferencesStore();
const now = useNow(1000);

const localeTag = computed(() => (locale.value === 'ro' ? 'ro-RO' : 'en-US'));
const timeLabel = computed(() => {
  const hour12 = prefs.data?.time_format === '12';
  return now.value.toLocaleTimeString(localeTag.value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  });
});
const dateLabel = computed(() => formatDate(now.value, 'full', localeTag.value));

const pos = ref({ x: 50, y: 50 });
let moveTimer: number | null = null;

function randomPos(): void {
  pos.value = {
    x: 10 + Math.random() * 80,
    y: 12 + Math.random() * 76,
  };
}

function wake(): void {
  emit('wake');
}

onMounted(() => {
  randomPos();
  moveTimer = window.setInterval(randomPos, 45_000);
});

onUnmounted(() => {
  if (moveTimer !== null) clearInterval(moveTimer);
});
</script>

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
      class="standby-clock"
      :style="{ left: `${pos.x}%`, top: `${pos.y}%` }"
      role="timer"
      :aria-label="timeLabel"
    >
      <div class="standby-time">{{ timeLabel }}</div>
      <div class="standby-date">{{ dateLabel }}</div>
      <div class="standby-hint">{{ $t('standby_tap_to_wake') }}</div>
    </div>
  </div>
</template>

<style src="@/assets/css/standby.css"></style>
