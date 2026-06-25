<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAiStore } from '@/stores/ai';
import { usePreferencesStore } from '@/stores/preferences';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';
import type { Preferences } from '@/api/types';
import { wifiApi } from '@/api/wifi';
import WiFiManager from '@/components/WiFiManager.vue';
import KeyboardInput from '@/components/KeyboardInput.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const prefs = usePreferencesStore();
const users = useUsersStore();
const ai = useAiStore();
const { success, error: errorToast, confirm } = useNotification();
const { t } = useI18n();

type Tab = 'general' | 'utilizatori' | 'weather' | 'ai' | 'voice' | 'tuya' | 'network';
const tab = ref<Tab>('general');

// Wi-Fi config is RPi-only: probe nmcli availability when the modal opens and
// only surface the Network tab where it actually works.
const wifiAvailable = ref(false);

const draft = ref<Partial<Preferences>>({});

const newUserName = ref('');
const newUserColor = ref('#3498db');
const saving = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open && prefs.data) draft.value = { ...prefs.data };
    if (open) {
      users.fetchAll().catch(() => undefined);
      wifiApi
        .status()
        .then((s) => (wifiAvailable.value = !!s.available))
        .catch(() => (wifiAvailable.value = false));
    }
  },
);

watch(
  () => prefs.data,
  (p) => {
    if (props.open && p) draft.value = { ...p };
  },
);

const aiTemp = computed({
  get: () => Number(draft.value.ai_temperature ?? 0.7),
  set: (v: number) => (draft.value.ai_temperature = v),
});
const voiceSens = computed({
  get: () => Number(draft.value.voice_sensitivity ?? 0.5),
  set: (v: number) => (draft.value.voice_sensitivity = v),
});

async function loadModels(): Promise<void> {
  await ai.loadModels();
  if (ai.models.length === 0) errorToast(t('ollama_unavailable'));
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    await prefs.update(draft.value);
    success(t('settings_saved_applied'));
    emit('close');
  } catch (e) {
    errorToast(e instanceof Error ? e.message : t('settings_save_error'));
  } finally {
    saving.value = false;
  }
}

async function addUser(): Promise<void> {
  const name = newUserName.value.trim();
  if (!name) { errorToast(t('user_enter_name')); return; }
  try {
    await users.create(name, newUserColor.value);
    newUserName.value = '';
    success(t('user_added'));
  } catch { errorToast(t('user_add_error')); }
}

async function removeUser(id: number, name: string): Promise<void> {
  const ok = await confirm(t('user_delete_confirm', { name }));
  if (!ok) return;
  try {
    await users.remove(id);
    success(t('user_deleted'));
  } catch { errorToast(t('user_delete_error')); }
}

async function renameUser(id: number, name: string, color: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) { errorToast(t('user_empty_name')); return; }
  try {
    await users.update(id, { name: trimmed, color });
    success(t('user_updated'));
  } catch { errorToast(t('user_update_error')); }
}
</script>

<template>
  <div v-if="open" id="settings-modal" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ $t('settings_title') }}</h2>
        <button type="button" class="icon-btn" :title="$t('btn_close')" @click="emit('close')">✕</button>
      </div>

      <div class="settings-tabs">
        <button type="button" class="tab-btn" :class="{ active: tab === 'general' }" @click="tab = 'general'">{{ $t('tab_general') }}</button>
        <button type="button" class="tab-btn" :class="{ active: tab === 'utilizatori' }" @click="tab = 'utilizatori'">{{ $t('tab_users') }}</button>
        <button type="button" class="tab-btn" :class="{ active: tab === 'weather' }" @click="tab = 'weather'">{{ $t('tab_weather') }}</button>
        <button type="button" class="tab-btn" :class="{ active: tab === 'ai' }" @click="tab = 'ai'">AI</button>
        <button type="button" class="tab-btn" :class="{ active: tab === 'voice' }" @click="tab = 'voice'">{{ $t('tab_voice') }}</button>
        <button type="button" class="tab-btn" :class="{ active: tab === 'tuya' }" @click="tab = 'tuya'">Tuya</button>
        <button v-if="wifiAvailable" type="button" class="tab-btn" :class="{ active: tab === 'network' }" @click="tab = 'network'">{{ $t('tab_network') }}</button>
      </div>

      <div v-show="tab === 'general'" class="tab-content" :class="{ active: tab === 'general' }">
        <div class="form-group">
          <label for="app-language">{{ $t('lbl_language') }}</label>
          <select id="app-language" v-model="draft.language">
            <option value="ro">{{ $t('opt_romanian') }}</option>
            <option value="en">{{ $t('opt_english') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="date-format">{{ $t('lbl_date_format') }}</label>
          <select id="date-format" v-model="draft.date_format">
            <option value="short">{{ $t('opt_date_short') }}</option>
            <option value="long">{{ $t('opt_date_long') }}</option>
            <option value="full">{{ $t('opt_date_full') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="time-format">{{ $t('lbl_time_format') }}</label>
          <select id="time-format" v-model="draft.time_format">
            <option value="24">24h</option>
            <option value="12">12h AM/PM</option>
          </select>
        </div>
      </div>

      <div v-show="tab === 'utilizatori'" class="tab-content" :class="{ active: tab === 'utilizatori' }">
        <div class="settings-users-list">
          <p v-if="users.items.length === 0" class="settings-empty">{{ $t('settings_no_users') }}</p>
          <div v-for="u in users.items" :key="u.id" class="settings-user-row">
            <input type="color" :value="u.color" @change="(e) => renameUser(u.id, u.name, (e.target as HTMLInputElement).value)" />
            <KeyboardInput
              v-model="u.name"
              @change="renameUser(u.id, u.name, u.color)"
              @submit="renameUser(u.id, u.name, u.color)"
            />
            <div class="settings-user-actions">
              <button type="button" class="btn btn-danger btn-sm" :title="$t('btn_delete')" @click="removeUser(u.id, u.name)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="settings-add-user">
          <KeyboardInput v-model="newUserName" :placeholder="$t('new_user_placeholder')" @submit="addUser" />
          <input type="color" v-model="newUserColor" :title="$t('color_user_title')" />
          <button type="button" class="btn btn-primary btn-sm" @click="addUser">{{ $t('btn_add_user') }}</button>
        </div>
      </div>

      <div v-show="tab === 'weather'" class="tab-content" :class="{ active: tab === 'weather' }">
        <div class="form-group">
          <label for="weather-city">{{ $t('lbl_weather_city') }}</label>
          <KeyboardInput id="weather-city" v-model="draft.weather_city" />
        </div>
        <div class="form-group">
          <label for="weather-units">{{ $t('lbl_weather_units') }}</label>
          <select id="weather-units" v-model="draft.weather_units">
            <option value="metric">Metric (°C)</option>
            <option value="imperial">Imperial (°F)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="weather-update">{{ $t('lbl_weather_update') }}</label>
          <KeyboardInput id="weather-update" v-model="draft.weather_update_interval" type="number" min="5" max="1440" />
        </div>
      </div>

      <div v-show="tab === 'ai'" class="tab-content" :class="{ active: tab === 'ai' }">
        <div class="form-group">
          <label for="ollama-url">{{ $t('lbl_ollama_url') }}</label>
          <div class="input-with-btn">
            <KeyboardInput id="ollama-url" v-model="draft.ollama_base_url" placeholder="http://localhost:11434" />
            <button type="button" class="btn btn-secondary btn-sm" :title="$t('title_check_models')" @click="loadModels">{{ $t('models_btn_label') }}</button>
          </div>
        </div>
        <div class="form-group">
          <label for="ai-model">{{ $t('lbl_ai_model') }}</label>
          <select id="ai-model" v-model="draft.ai_model">
            <option value="">{{ $t('opt_select_model') }}</option>
            <option v-for="m in ai.models" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="ai-temperature">{{ $t('lbl_ai_temp') }} <span>{{ aiTemp.toFixed(1) }}</span></label>
          <input id="ai-temperature" type="range" min="0" max="2" step="0.1" v-model.number="aiTemp" />
        </div>
        <div class="form-group">
          <label for="ai-max-tokens">{{ $t('lbl_ai_tokens') }}</label>
          <KeyboardInput id="ai-max-tokens" v-model="draft.ai_max_tokens" type="number" min="50" max="2000" />
        </div>
      </div>

      <div v-show="tab === 'voice'" class="tab-content" :class="{ active: tab === 'voice' }">
        <div class="form-group">
          <label for="voice-language">{{ $t('lbl_voice_lang') }}</label>
          <select id="voice-language" v-model="draft.voice_language">
            <option value="ro-RO">{{ $t('opt_voice_ro') }}</option>
            <option value="en-US">{{ $t('opt_voice_en_us') }}</option>
            <option value="en-GB">{{ $t('opt_voice_en_gb') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="voice-sensitivity">{{ $t('lbl_sensitivity') }} <span>{{ voiceSens.toFixed(1) }}</span></label>
          <input id="voice-sensitivity" type="range" min="0" max="1" step="0.1" v-model.number="voiceSens" />
        </div>
        <div class="form-group form-inline">
          <label for="voice-auto-start">{{ $t('lbl_auto_start') }}</label>
          <input id="voice-auto-start" type="checkbox" v-model="draft.voice_auto_start" />
        </div>
        <p class="form-hint form-hint-spaced">{{ $t('hint_wake_word', { phrase: draft.voice_activation_word || 'Hey HomeTasks' }) }}</p>
      </div>

      <div v-show="tab === 'tuya'" class="tab-content" :class="{ active: tab === 'tuya' }">
        <div class="form-group">
          <label for="tuya-access-id">{{ $t('tuya_lbl_access_id') }}</label>
          <KeyboardInput id="tuya-access-id" v-model="draft.tuya_access_id" />
        </div>
        <div class="form-group">
          <label for="tuya-access-secret">{{ $t('tuya_lbl_access_secret') }}</label>
          <KeyboardInput id="tuya-access-secret" v-model="draft.tuya_access_secret" type="password" />
        </div>
        <div class="form-group">
          <label for="tuya-api-region">{{ $t('tuya_lbl_region') }}</label>
          <select id="tuya-api-region" v-model="draft.tuya_api_region">
            <option value="eu">EU (eu.iot.tuya.com)</option>
            <option value="us">US (us.iot.tuya.com)</option>
            <option value="cn">CN (openapi.tuyacn.com)</option>
            <option value="in">IN (openapi.tuyain.com)</option>
          </select>
        </div>
      </div>

      <div v-if="wifiAvailable" v-show="tab === 'network'" class="tab-content" :class="{ active: tab === 'network' }">
        <p class="form-hint form-hint-spaced">{{ $t('wifi_hint') }}</p>
        <WiFiManager :active="open && tab === 'network'" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('btn_cancel') }}</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ $t('btn_save') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Keep the sibling controls (color picker, action button) at the top of the row
   so they don't recenter when a KeyboardInput expands its on-screen keyboard. */
.settings-add-user,
.settings-user-row,
.input-with-btn {
  align-items: flex-start;
}
</style>
