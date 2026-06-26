<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAiStore } from '@/stores/ai';
import { usePreferencesStore } from '@/stores/preferences';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import { useTts, voiceMatchesLang } from '@/composables/useTts';
import { useI18n } from 'vue-i18n';
import type { Preferences } from '@/api/types';
import { wifiApi } from '@/api/wifi';
import { voiceApi, type MicrophoneDevice } from '@/api/voice';
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

// Server-side microphone picker (RPi kiosk). Devices are listed only where the
// server has a capture device; on dev/Windows the list stays empty and hidden.
const microphones = ref<MicrophoneDevice[]>([]);

const draft = ref<Partial<Preferences>>({});

// Copy prefs into the editable draft, normalizing the feature switches so an
// absent flag on older payloads reads as enabled (matches the store getters).
function makeDraft(p: Preferences): Partial<Preferences> {
  return { ...p, ai_enabled: p.ai_enabled !== false, tuya_enabled: p.tuya_enabled !== false };
}

const newUserName = ref('');
const newUserColor = ref('#3498db');
const saving = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open && prefs.data) draft.value = makeDraft(prefs.data);
    if (open) {
      if (draft.value.ai_enabled !== false) ai.loadModels(draft.value.ai_provider).catch(() => undefined);
      users.fetchAll().catch(() => undefined);
      wifiApi
        .status()
        .then((s) => (wifiAvailable.value = !!s.available))
        .catch(() => (wifiAvailable.value = false));
      voiceApi
        .microphones()
        .then((m) => (microphones.value = m.available ? m.devices : []))
        .catch(() => (microphones.value = []));
    }
  },
);

watch(
  () => prefs.data,
  (p) => {
    if (props.open && p) draft.value = makeDraft(p);
  },
);

// Provider catalog. `keyField` is the draft field that holds the credential —
// the Ollama URL for the local provider, an API key for cloud ones.
const AI_PROVIDERS = [
  { id: 'ollama', cloud: false, keyField: 'ollama_base_url' },
  { id: 'openrouter', cloud: true, keyField: 'openrouter_api_key' },
  { id: 'groq', cloud: true, keyField: 'groq_api_key' },
  { id: 'mistral', cloud: true, keyField: 'mistral_api_key' },
  { id: 'gemini', cloud: true, keyField: 'gemini_api_key' },
] as const;

const activeProvider = computed(
  () => AI_PROVIDERS.find((p) => p.id === draft.value.ai_provider) ?? AI_PROVIDERS[0],
);
const isCloudProvider = computed(() => activeProvider.value.cloud);

// Bind the active cloud provider's API-key field generically; the underlying
// draft key changes with the selected provider.
const apiKeyModel = computed<string>({
  get: () => String((draft.value as Record<string, unknown>)[activeProvider.value.keyField] ?? ''),
  set: (v) => ((draft.value as Record<string, unknown>)[activeProvider.value.keyField] = v),
});

const aiTemp = computed({
  get: () => Number(draft.value.ai_temperature ?? 0.7),
  set: (v: number) => (draft.value.ai_temperature = v),
});
const voiceSens = computed({
  get: () => Number(draft.value.voice_sensitivity ?? 0.5),
  set: (v: number) => (draft.value.voice_sensitivity = v),
});

// Browser TTS voice picker (per-device, persisted in localStorage by useTts).
const { voiceName: ttsVoiceName, voices: ttsVoices, loadVoices, setVoice } = useTts();
const voiceSearch = ref('');
const filteredVoices = computed(() => {
  // Only voices for the selected language, then narrowed by the search box.
  const lang = draft.value.voice_language || 'ro-RO';
  const q = voiceSearch.value.trim().toLowerCase();
  return ttsVoices.value.filter(
    (v) =>
      voiceMatchesLang(v.lang, lang) &&
      (!q || `${v.name} ${v.lang}`.toLowerCase().includes(q)),
  );
});

// Populate the voice list when the Voice tab is opened (getVoices() may be empty
// until the first call wakes the engine).
watch(
  () => [props.open, tab.value] as const,
  ([open, t]) => { if (open && t === 'voice') loadVoices(); },
);

async function loadModels(): Promise<void> {
  await ai.loadModels(draft.value.ai_provider);
  if (ai.models.length === 0) errorToast(t('ollama_unavailable'));
}

// Switching provider: the shared `ai_model` pref is interpreted per provider, so
// clear the stale selection and re-fetch the new provider's model list.
async function onProviderChange(): Promise<void> {
  draft.value.ai_model = '';
  ai.models = [];
  await ai.loadModels(draft.value.ai_provider);
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
        <div class="form-group form-inline">
          <label for="ai-enabled">{{ $t('lbl_ai_enabled') }}</label>
          <input id="ai-enabled" type="checkbox" v-model="draft.ai_enabled" />
        </div>
        <p class="form-hint form-hint-spaced">{{ $t('hint_ai_enabled') }}</p>
        <template v-if="draft.ai_enabled">
        <div class="form-group">
          <label for="ai-provider">{{ $t('lbl_ai_provider') }}</label>
          <select id="ai-provider" v-model="draft.ai_provider" @change="onProviderChange">
            <option v-for="p in AI_PROVIDERS" :key="p.id" :value="p.id">{{ $t('opt_provider_' + p.id) }}</option>
          </select>
        </div>
        <p v-if="isCloudProvider" class="form-hint form-hint-spaced">{{ $t('hint_cloud_privacy') }}</p>
        <div v-if="!isCloudProvider" class="form-group">
          <label for="ollama-url">{{ $t('lbl_ollama_url') }}</label>
          <div class="input-with-btn">
            <KeyboardInput id="ollama-url" v-model="draft.ollama_base_url" placeholder="http://localhost:11434" />
            <button type="button" class="btn btn-secondary btn-sm" :title="$t('title_check_models')" @click="loadModels">{{ $t('models_btn_label') }}</button>
          </div>
        </div>
        <div v-else class="form-group">
          <label for="ai-api-key">{{ $t('lbl_api_key') }}</label>
          <div class="input-with-btn">
            <KeyboardInput id="ai-api-key" v-model="apiKeyModel" type="password" />
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
        </template>
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
        <div v-if="microphones.length" class="form-group">
          <label for="voice-mic">{{ $t('lbl_voice_mic') }}</label>
          <select id="voice-mic" v-model="draft.voice_mic_device">
            <option value="">{{ $t('opt_voice_mic_auto') }}</option>
            <option v-for="m in microphones" :key="m.index" :value="m.name">
              {{ m.name }}
            </option>
          </select>
          <small class="form-hint">{{ $t('hint_voice_mic') }}</small>
        </div>
        <div class="form-group">
          <label for="tts-voice">{{ $t('lbl_tts_voice') }}</label>
          <input
            id="tts-voice-search"
            v-model="voiceSearch"
            type="search"
            :placeholder="$t('tts_voice_search')"
            autocomplete="off"
          />
          <select
            id="tts-voice"
            size="5"
            :value="ttsVoiceName"
            @change="setVoice(($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ $t('opt_tts_auto') }}</option>
            <option v-if="ttsVoices.length === 0" disabled>{{ $t('tts_no_voices_browser') }}</option>
            <option v-for="v in filteredVoices" :key="v.name" :value="v.name">
              {{ v.name }} ({{ v.lang }}){{ v.localService ? '' : ' ☁' }}
            </option>
          </select>
          <small class="form-hint">{{ $t('hint_tts_voices') }}</small>
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
        <div class="form-group form-inline">
          <label for="tuya-enabled">{{ $t('lbl_tuya_enabled') }}</label>
          <input id="tuya-enabled" type="checkbox" v-model="draft.tuya_enabled" />
        </div>
        <p class="form-hint form-hint-spaced">{{ $t('hint_tuya_enabled') }}</p>
        <template v-if="draft.tuya_enabled">
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
        </template>
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
