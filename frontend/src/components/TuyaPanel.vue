<script setup lang="ts">
import { useTuyaStore } from '@/stores/tuya';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const tuya = useTuyaStore();
const { error: errorToast } = useNotification();
const { t } = useI18n();

async function refresh(): Promise<void> {
  try {
    await tuya.refresh();
    if (tuya.error) errorToast(t('tuya_load_error') + tuya.error);
  } catch (e) {
    errorToast(t('tuya_load_error') + (e instanceof Error ? e.message : String(e)));
  }
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal tuya-modal">
      <div class="modal-head">
        <h2>{{ $t('tuya_modal_title') }}</h2>
        <button class="icon-btn" @click="emit('close')">✕</button>
      </div>

      <div class="tuya-actions">
        <span class="tuya-updated">
          <template v-if="tuya.updatedAt">{{ $t('tuya_updated_prefix') }}{{ new Date(tuya.updatedAt).toLocaleString() }}</template>
        </span>
        <button class="btn btn-secondary btn-sm" @click="refresh" :disabled="tuya.loading">↻</button>
      </div>

      <div class="tuya-grid">
        <p v-if="tuya.loading" class="empty">{{ $t('tuya_connecting') }}</p>
        <p v-else-if="tuya.devices.length === 0" class="empty">{{ $t('tuya_no_devices') }}</p>
        <div v-for="d in tuya.devices" :key="(d.id as string) || d.name" class="tuya-card">
          <div class="tuya-card-head">
            <span class="tuya-name">{{ d.name }}</span>
            <span class="tuya-status" :class="d.online ? 'on' : 'off'">
              {{ d.online ? $t('tuya_online') : $t('tuya_offline') }}
            </span>
          </div>
          <div class="tuya-temp" v-if="typeof d.current_temperature === 'number'">
            {{ d.current_temperature.toFixed(1) }}°C
          </div>
          <div v-if="typeof d.humidity === 'number'" class="tuya-meta">💧 {{ Math.round(d.humidity) }}%</div>
          <div v-if="typeof d.target_temperature === 'number'" class="tuya-meta">
            {{ $t('tuya_target_prefix') }}{{ d.target_temperature.toFixed(1) }}°C
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  width: min(600px, 92vw);
  max-height: 85vh;
  overflow: auto;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.modal-head h2 { margin: 0; font-size: 1.1rem; }
.icon-btn { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; }
.tuya-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}
.tuya-updated { color: #666; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
.btn-secondary { background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
.btn-secondary:disabled { opacity: 0.6; cursor: wait; }
.tuya-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.5rem;
}
.empty { grid-column: 1 / -1; text-align: center; color: #888; padding: 1rem; }
.tuya-card {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  background: #fafafa;
}
.tuya-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}
.tuya-name { font-weight: 600; }
.tuya-status.on { color: #2e7d32; }
.tuya-status.off { color: #b71c1c; }
.tuya-temp { font-size: 1.4rem; font-weight: 600; }
.tuya-meta { font-size: 0.78rem; color: #666; }
</style>
