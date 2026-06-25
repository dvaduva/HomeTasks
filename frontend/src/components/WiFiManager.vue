<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotification } from '@/composables/useNotification';
import { wifiApi, type WifiNetwork, type WifiStatusInfo } from '@/api/wifi';
import OnScreenKeyboard from './OnScreenKeyboard.vue';

// Embeddable Wi-Fi panel for the Settings "Network" tab. Only rendered when the
// host actually has NetworkManager (i.e. we're on the RPi); the parent gates it
// on wifiApi.status().available. Mirrors BluetoothManager's scan/connect flow but
// lives inline in a tab rather than its own modal.
const props = defineProps<{ active: boolean }>();

const { success, error: errorToast } = useNotification();
const { t } = useI18n();

const scanning = ref(false);
const loadingStatus = ref(false);
const networks = ref<WifiNetwork[]>([]);
const status = ref<WifiStatusInfo | null>(null);
const selected = ref<string | null>(null); // SSID with the password field open
const password = ref('');
const connecting = ref<string | null>(null); // SSID currently connecting
const showPassword = ref(false); // reveal the typed characters (useful with the OSK)
const showKeyboard = ref(false); // on-screen keyboard for kiosks without a hardware keyboard

// Hidden-network form: a hidden AP doesn't broadcast its SSID, so it never shows
// up in scan() — the operator has to type the name in by hand. We then connect
// with hidden=true so NetworkManager marks the saved profile as hidden and probes
// for it on reconnect.
const showHidden = ref(false);
const hiddenSsid = ref('');
const hiddenPassword = ref('');
const hiddenShowPassword = ref(false);
const hiddenShowKeyboard = ref(false);
const hiddenField = ref<'ssid' | 'password'>('ssid'); // which field the OSK types into
const connectingHidden = ref(false);

// The single OSK drives whichever hidden-form field is focused.
const hiddenOskValue = computed<string>({
  get: () => (hiddenField.value === 'ssid' ? hiddenSsid.value : hiddenPassword.value),
  set: (v) => {
    if (hiddenField.value === 'ssid') hiddenSsid.value = v;
    else hiddenPassword.value = v;
  },
});

async function loadStatus(): Promise<void> {
  loadingStatus.value = true;
  try {
    status.value = await wifiApi.status();
  } catch {
    status.value = null;
  } finally {
    loadingStatus.value = false;
  }
}

async function doScan(): Promise<void> {
  if (scanning.value) return;
  scanning.value = true;
  try {
    const res = await wifiApi.scan();
    networks.value = res.networks || [];
    if (res.error) errorToast(res.error);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('wifi_scan_fail'));
  } finally {
    scanning.value = false;
  }
}

function selectNetwork(n: WifiNetwork): void {
  if (n.security) {
    // Toggle the inline password field for secured networks.
    selected.value = selected.value === n.ssid ? null : n.ssid;
    password.value = '';
    showPassword.value = false;
    showKeyboard.value = false;
  } else {
    doConnect(n); // open network — connect straight away
  }
}

async function doConnect(n: WifiNetwork): Promise<void> {
  connecting.value = n.ssid;
  try {
    await wifiApi.connect(n.ssid, n.security ? password.value : undefined);
    success(t('wifi_connect_ok', { ssid: n.ssid }));
    selected.value = null;
    password.value = '';
    showKeyboard.value = false;
    showPassword.value = false;
    await Promise.all([loadStatus(), doScan()]);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('wifi_connect_fail'));
  } finally {
    connecting.value = null;
  }
}

async function doDisconnect(): Promise<void> {
  try {
    await wifiApi.disconnect();
    success(t('wifi_disconnect_ok'));
    await Promise.all([loadStatus(), doScan()]);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('wifi_disconnect_fail'));
  }
}

function toggleHidden(): void {
  showHidden.value = !showHidden.value;
  if (!showHidden.value) resetHidden();
}

function resetHidden(): void {
  hiddenSsid.value = '';
  hiddenPassword.value = '';
  hiddenShowPassword.value = false;
  hiddenShowKeyboard.value = false;
  hiddenField.value = 'ssid';
}

async function connectHidden(): Promise<void> {
  const ssid = hiddenSsid.value.trim();
  if (!ssid || connectingHidden.value) return;
  connectingHidden.value = true;
  try {
    await wifiApi.connect(ssid, hiddenPassword.value || undefined, true);
    success(t('wifi_connect_ok', { ssid }));
    showHidden.value = false;
    resetHidden();
    await Promise.all([loadStatus(), doScan()]);
  } catch (e) {
    errorToast((e as { message?: string })?.message || t('wifi_connect_fail'));
  } finally {
    connectingHidden.value = false;
  }
}

function signalBars(signal: number): string {
  if (signal >= 75) return '▂▄▆█';
  if (signal >= 50) return '▂▄▆';
  if (signal >= 25) return '▂▄';
  return '▂';
}

// Load status + scan once each time the tab becomes active.
watch(
  () => props.active,
  (active) => {
    if (active) {
      loadStatus();
      doScan();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="wifi-mgr">
    <p class="wifi-status" :class="{ connected: status?.connected }">
      <template v-if="loadingStatus">{{ $t('wifi_status_loading') }}</template>
      <template v-else-if="status?.connected">
        {{ $t('wifi_status_connected', { ssid: status.ssid }) }}
        <span v-if="status.ip" class="wifi-ip">{{ status.ip }}</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="doDisconnect">
          {{ $t('wifi_disconnect') }}
        </button>
      </template>
      <template v-else>{{ $t('wifi_status_disconnected') }}</template>
    </p>

    <div class="wifi-toolbar">
      <button type="button" class="btn btn-primary btn-sm" :disabled="scanning" @click="doScan">
        {{ scanning ? $t('wifi_scanning') : $t('wifi_scan') }}
      </button>
      <span v-if="scanning" class="wifi-spin" aria-hidden="true">⟳</span>
    </div>

    <ul v-if="networks.length" class="wifi-list">
      <li v-for="n in networks" :key="n.ssid" class="wifi-item-wrap">
        <button type="button" class="wifi-item" @click="selectNetwork(n)">
          <span class="wifi-bars" aria-hidden="true">{{ signalBars(n.signal) }}</span>
          <span class="wifi-name">{{ n.ssid }}</span>
          <span v-if="n.security" class="wifi-lock" :title="n.security" aria-hidden="true">🔒</span>
          <span v-if="n.in_use" class="wifi-badge connected">{{ $t('wifi_connected') }}</span>
        </button>

        <template v-if="selected === n.ssid && !n.in_use">
          <div class="wifi-connect-row">
            <div class="wifi-pw-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="$t('wifi_password_placeholder')"
                autocomplete="off"
                @keyup.enter="doConnect(n)"
              />
              <button
                type="button"
                class="wifi-pw-btn"
                :title="showPassword ? $t('wifi_password_hide') : $t('wifi_password_show')"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '🙈' : '👁' }}
              </button>
              <button
                type="button"
                class="wifi-pw-btn"
                :class="{ active: showKeyboard }"
                :title="$t('wifi_keyboard_toggle')"
                :aria-pressed="showKeyboard"
                @click="showKeyboard = !showKeyboard"
              >
                ⌨
              </button>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="connecting === n.ssid"
              @click="doConnect(n)"
            >
              {{ connecting === n.ssid ? $t('wifi_connecting') : $t('wifi_connect') }}
            </button>
          </div>
          <OnScreenKeyboard
            v-if="showKeyboard"
            v-model="password"
            @submit="doConnect(n)"
            @close="showKeyboard = false"
          />
        </template>
      </li>
    </ul>
    <p v-else-if="!scanning" class="wifi-empty">{{ $t('wifi_empty') }}</p>

    <div class="wifi-hidden">
      <button type="button" class="wifi-hidden-toggle" :aria-expanded="showHidden" @click="toggleHidden">
        <span class="wifi-hidden-icon" aria-hidden="true">＋</span>
        {{ $t('wifi_hidden_add') }}
      </button>

      <div v-if="showHidden" class="wifi-hidden-form">
        <p class="wifi-hidden-hint">{{ $t('wifi_hidden_hint') }}</p>
        <input
          v-model="hiddenSsid"
          class="wifi-hidden-ssid"
          :placeholder="$t('wifi_hidden_ssid_placeholder')"
          autocomplete="off"
          @focus="hiddenField = 'ssid'"
        />
        <div class="wifi-connect-row">
          <div class="wifi-pw-field">
            <input
              v-model="hiddenPassword"
              :type="hiddenShowPassword ? 'text' : 'password'"
              :placeholder="$t('wifi_password_placeholder')"
              autocomplete="off"
              @focus="hiddenField = 'password'"
              @keyup.enter="connectHidden"
            />
            <button
              type="button"
              class="wifi-pw-btn"
              :title="hiddenShowPassword ? $t('wifi_password_hide') : $t('wifi_password_show')"
              :aria-pressed="hiddenShowPassword"
              @click="hiddenShowPassword = !hiddenShowPassword"
            >
              {{ hiddenShowPassword ? '🙈' : '👁' }}
            </button>
            <button
              type="button"
              class="wifi-pw-btn"
              :class="{ active: hiddenShowKeyboard }"
              :title="$t('wifi_keyboard_toggle')"
              :aria-pressed="hiddenShowKeyboard"
              @click="hiddenShowKeyboard = !hiddenShowKeyboard"
            >
              ⌨
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!hiddenSsid.trim() || connectingHidden"
            @click="connectHidden"
          >
            {{ connectingHidden ? $t('wifi_connecting') : $t('wifi_connect') }}
          </button>
        </div>
        <OnScreenKeyboard
          v-if="hiddenShowKeyboard"
          v-model="hiddenOskValue"
          @submit="connectHidden"
          @close="hiddenShowKeyboard = false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wifi-status {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--rd-gray-500, #64748b);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.wifi-status.connected {
  color: #15803d;
  font-weight: 600;
}
.wifi-ip {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--rd-gray-500, #64748b);
  font-weight: 400;
}
.wifi-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wifi-spin {
  animation: wifi-spin 1s linear infinite;
  color: var(--rd-gray-500, #64748b);
}
@keyframes wifi-spin {
  to { transform: rotate(360deg); }
}
.wifi-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.wifi-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rd-gray-200, #e2e8f0);
  border-radius: 10px;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.wifi-item:hover {
  background: var(--rd-gray-100, #f1f5f9);
}
.wifi-bars {
  font-family: ui-monospace, monospace;
  color: var(--rd-gray-500, #64748b);
  min-width: 36px;
}
.wifi-name {
  font-weight: 600;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wifi-lock {
  font-size: 13px;
}
.wifi-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.wifi-badge.connected {
  background: #dcfce7;
  color: #15803d;
}
.wifi-connect-row {
  display: flex;
  gap: 8px;
  padding: 8px 12px 4px;
}
.wifi-pw-field {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
.wifi-pw-field input {
  flex: 1;
  width: 100%;
  padding-right: 76px; /* room for the two trailing buttons */
}
.wifi-pw-btn {
  position: absolute;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.wifi-pw-btn:hover {
  background: var(--rd-gray-100, #f1f5f9);
}
.wifi-pw-btn.active {
  color: var(--blue, #1d4ed8);
}
.wifi-pw-field .wifi-pw-btn:nth-of-type(1) {
  right: 40px;
}
.wifi-pw-field .wifi-pw-btn:nth-of-type(2) {
  right: 4px;
}
.wifi-empty {
  text-align: center;
  color: var(--rd-gray-500, #64748b);
  padding: 20px 0;
}
.wifi-hidden {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--rd-gray-200, #e2e8f0);
}
.wifi-hidden-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 4px;
  border: none;
  background: none;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  color: var(--blue, #1d4ed8);
}
.wifi-hidden-icon {
  font-size: 18px;
  line-height: 1;
}
.wifi-hidden-form {
  padding: 4px 0 8px;
}
.wifi-hidden-hint {
  margin: 0 0 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--rd-gray-500, #64748b);
}
.wifi-hidden-ssid {
  width: 100%;
  margin-bottom: 8px;
}
.wifi-hidden-form .wifi-connect-row {
  padding: 0;
}
</style>
