<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRadioStore } from '@/stores/radio';
import { useNotification } from '@/composables/useNotification';
import { btApi, type BtDevice } from '@/api/bt';

// Bluetooth pairing modal. Only mounted/shown when the host actually has BlueZ
// (radio.btAvailable, i.e. we're on the RPi). Automates the one-time
// `bluetoothctl scan/pair/trust/connect` flow so the user never needs a shell.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const radio = useRadioStore();
const { success, error: errorToast, confirm } = useNotification();
const { t } = useI18n();

const scanning = ref(false);
const devices = ref<BtDevice[]>([]);
const busy = ref<string | null>(null); // MAC currently pairing/forgetting

async function doScan(): Promise<void> {
  if (scanning.value) return;
  scanning.value = true;
  try {
    const res = await btApi.scan(10);
    devices.value = res.devices || [];
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('radio_bt_scan_fail'));
  } finally {
    scanning.value = false;
  }
}

async function doPair(d: BtDevice): Promise<void> {
  busy.value = d.id;
  try {
    await btApi.pair(d.id);
    success(t('radio_bt_pair_ok', { name: d.name }));
    await Promise.all([doScan(), radio.loadBtDevices()]);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('radio_bt_pair_fail'));
  } finally {
    busy.value = null;
  }
}

async function doForget(d: BtDevice): Promise<void> {
  const ok = await confirm(t('radio_bt_forget_confirm', { name: d.name }));
  if (!ok) return;
  busy.value = d.id;
  try {
    await btApi.remove(d.id);
    success(t('radio_bt_forget_ok', { name: d.name }));
    await Promise.all([doScan(), radio.loadBtDevices()]);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('radio_bt_forget_fail'));
  } finally {
    busy.value = null;
  }
}

// Auto-scan once each time the modal is opened.
watch(
  () => props.open,
  (open) => {
    if (open) {
      devices.value = [];
      doScan();
    }
  },
);
</script>

<template>
  <div v-if="open" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal bt-mgr">
      <div class="modal-head">
        <h2>{{ $t('radio_bt_manage_title') }}</h2>
        <button type="button" class="icon-btn" :title="$t('radio_bt_close')" @click="emit('close')">✕</button>
      </div>

      <p class="bt-mgr-hint">{{ $t('radio_bt_hint') }}</p>

      <div class="bt-mgr-toolbar">
        <button type="button" class="btn btn-primary btn-sm" :disabled="scanning" @click="doScan">
          {{ scanning ? $t('radio_bt_scanning') : $t('radio_bt_scan') }}
        </button>
        <span v-if="scanning" class="bt-mgr-spin" aria-hidden="true">⟳</span>
      </div>

      <ul v-if="devices.length" class="bt-mgr-list">
        <li v-for="d in devices" :key="d.id" class="bt-mgr-item">
          <div class="bt-mgr-info">
            <span class="bt-mgr-name">{{ d.name }}</span>
            <span class="bt-mgr-mac">{{ d.id }}</span>
          </div>
          <span
            class="bt-mgr-badge"
            :class="d.connected ? 'connected' : d.paired ? 'paired' : 'new'"
          >
            {{ d.connected ? $t('radio_bt_connected') : d.paired ? $t('radio_bt_paired') : $t('radio_bt_new') }}
          </span>
          <button
            v-if="d.paired"
            type="button"
            class="btn btn-danger btn-sm"
            :disabled="busy === d.id"
            @click="doForget(d)"
          >
            {{ $t('radio_bt_forget') }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="busy === d.id"
            @click="doPair(d)"
          >
            {{ busy === d.id ? $t('radio_bt_pairing') : $t('radio_bt_pair') }}
          </button>
        </li>
      </ul>
      <p v-else-if="!scanning" class="bt-mgr-empty">{{ $t('radio_bt_empty') }}</p>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('radio_bt_close') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bt-mgr-hint {
  font-size: 13px;
  color: var(--rd-gray-500, #64748b);
  margin: 0 0 12px;
}
.bt-mgr-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.bt-mgr-spin {
  animation: bt-spin 1s linear infinite;
  color: var(--rd-gray-500, #64748b);
}
@keyframes bt-spin {
  to { transform: rotate(360deg); }
}
.bt-mgr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bt-mgr-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--rd-gray-200, #e2e8f0);
  border-radius: 10px;
}
.bt-mgr-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.bt-mgr-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bt-mgr-mac {
  font-size: 12px;
  color: var(--rd-gray-500, #64748b);
  font-family: ui-monospace, monospace;
}
.bt-mgr-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.bt-mgr-badge.connected {
  background: #dcfce7;
  color: #15803d;
}
.bt-mgr-badge.paired {
  background: #e0e7ff;
  color: #4338ca;
}
.bt-mgr-badge.new {
  background: var(--rd-gray-100, #f1f5f9);
  color: var(--rd-gray-500, #64748b);
}
.bt-mgr-empty {
  text-align: center;
  color: var(--rd-gray-500, #64748b);
  padding: 20px 0;
}
</style>
