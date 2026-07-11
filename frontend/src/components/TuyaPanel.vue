<script setup lang="ts">
import { computed } from 'vue';
import { useTuyaStore } from '@/stores/tuya';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const tuya = useTuyaStore();
const { error: errorToast } = useNotification();
const { t } = useI18n();

const updatedLabel = computed(() => (tuya.updatedAt ? new Date(tuya.updatedAt).toLocaleString() : ''));

async function refresh(): Promise<void> {
  try {
    await tuya.refresh();
    if (tuya.error) errorToast(t('tuya_load_error') + tuya.error);
  } catch (e) {
    errorToast(t('tuya_load_error') + (e instanceof Error ? e.message : String(e)));
  }
}

function tempClass(current: number | null | undefined, target: number | null | undefined): string {
  if (typeof current !== 'number') return 'neutral';
  const ref = typeof target === 'number' ? target : current;
  return current >= ref ? 'warm' : 'cool';
}
</script>

<template>
  <div v-if="open" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal tuya-modal">
      <div class="modal-head">
        <h2>{{ $t('tuya_modal_title') }}</h2>
        <div class="tuya-head-actions">
          <button
            type="button"
            class="icon-btn tuya-refresh-btn"
            :class="{ 'tuya-refreshing': tuya.loading }"
            :disabled="tuya.loading"
            :title="$t('tuya_refresh_title')"
            @click="refresh"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button type="button" class="icon-btn" :title="$t('btn_close')" @click="emit('close')">✕</button>
        </div>
      </div>

      <div class="tuya-actions">
        <span class="tuya-updated">
          <template v-if="updatedLabel">{{ $t('tuya_updated_prefix') }}{{ updatedLabel }}</template>
        </span>
      </div>

      <div class="tuya-grid" :class="{ 'tuya-refreshing': tuya.loading }">
        <p v-if="tuya.loading && tuya.devices.length === 0" class="empty">{{ $t('tuya_connecting') }}</p>
        <p v-else-if="tuya.devices.length === 0" class="empty">{{ $t('tuya_no_devices') }}</p>
        <div
          v-for="d in tuya.devices"
          :key="(d.id as string) || d.name"
          class="tuya-card"
          :class="{ offline: !d.online }"
        >
          <div class="tuya-card-name">{{ d.name }}</div>
          <div v-if="typeof d.temp_current === 'number'" class="tuya-card-temp" :class="tempClass(d.temp_current, d.temp_set)">
            {{ d.temp_current.toFixed(1) }}°
          </div>
          <div v-if="typeof d.temp_set === 'number'" class="tuya-card-set">
            {{ $t('tuya_target_prefix') }}{{ d.temp_set.toFixed(1) }}°
          </div>
          <div class="tuya-card-status">
            <span class="tuya-dot" :class="d.online ? 'online' : 'offline'"></span>
            {{ d.online ? $t('tuya_online') : $t('tuya_offline') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
