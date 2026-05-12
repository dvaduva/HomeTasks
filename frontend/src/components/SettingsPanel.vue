<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAiStore } from '@/stores/ai';
import { usePreferencesStore } from '@/stores/preferences';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';
import type { Preferences } from '@/api/types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const prefs = usePreferencesStore();
const users = useUsersStore();
const ai = useAiStore();
const { success, error: errorToast, confirm } = useNotification();
const { t } = useI18n();

type Tab = 'general' | 'utilizatori' | 'weather' | 'ai' | 'voice' | 'tuya';
const tab = ref<Tab>('general');

const draft = ref<Partial<Preferences>>({});

const newUserName = ref('');
const newUserColor = ref('#3498db');
const saving = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open && prefs.data) {
      draft.value = { ...prefs.data };
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
  if (!name) {
    errorToast(t('user_enter_name'));
    return;
  }
  try {
    await users.create(name, newUserColor.value);
    newUserName.value = '';
    success(t('user_added'));
  } catch (e) {
    errorToast(t('user_add_error'));
  }
}

async function removeUser(id: number, name: string): Promise<void> {
  const ok = await confirm(t('user_delete_confirm', { name }));
  if (!ok) return;
  try {
    await users.remove(id);
    success(t('user_deleted'));
  } catch (e) {
    errorToast(t('user_delete_error'));
  }
}

async function renameUser(id: number, name: string, color: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    errorToast(t('user_empty_name'));
    return;
  }
  try {
    await users.update(id, { name: trimmed, color });
    success(t('user_updated'));
  } catch (e) {
    errorToast(t('user_update_error'));
  }
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal settings-modal">
      <div class="modal-head">
        <h2>{{ $t('settings_title') }}</h2>
        <button class="icon-btn" @click="emit('close')">✕</button>
      </div>

      <div class="settings-tabs">
        <button :class="{ active: tab === 'general' }" @click="tab = 'general'">{{ $t('tab_general') }}</button>
        <button :class="{ active: tab === 'utilizatori' }" @click="tab = 'utilizatori'">{{ $t('tab_users') }}</button>
        <button :class="{ active: tab === 'weather' }" @click="tab = 'weather'">{{ $t('tab_weather') }}</button>
        <button :class="{ active: tab === 'ai' }" @click="tab = 'ai'">AI</button>
        <button :class="{ active: tab === 'voice' }" @click="tab = 'voice'">{{ $t('tab_voice') }}</button>
        <button :class="{ active: tab === 'tuya' }" @click="tab = 'tuya'">Tuya</button>
      </div>

      <div v-if="tab === 'general'" class="tab-content">
        <div class="form-group">
          <label>{{ $t('lbl_language') }}</label>
          <select v-model="draft.language">
            <option value="ro">{{ $t('opt_romanian') }}</option>
            <option value="en">{{ $t('opt_english') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_date_format') }}</label>
          <select v-model="draft.date_format">
            <option value="short">{{ $t('opt_date_short') }}</option>
            <option value="long">{{ $t('opt_date_long') }}</option>
            <option value="full">{{ $t('opt_date_full') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_time_format') }}</label>
          <select v-model="draft.time_format">
            <option value="24">24h</option>
            <option value="12">12h AM/PM</option>
          </select>
        </div>
      </div>

      <div v-if="tab === 'utilizatori'" class="tab-content">
        <div class="settings-users-list">
          <p v-if="users.items.length === 0" class="empty">{{ $t('settings_no_users') }}</p>
          <div v-for="u in users.items" :key="u.id" class="settings-user-row">
            <input type="color" :value="u.color" @change="(e) => renameUser(u.id, u.name, (e.target as HTMLInputElement).value)" />
            <input type="text" :value="u.name" @change="(e) => renameUser(u.id, (e.target as HTMLInputElement).value, u.color)" />
            <button class="btn btn-danger btn-sm" @click="removeUser(u.id, u.name)">🗑</button>
          </div>
        </div>
        <div class="settings-add-user">
          <input v-model="newUserName" :placeholder="$t('new_user_placeholder')" />
          <input type="color" v-model="newUserColor" :title="$t('color_user_title')" />
          <button class="btn btn-primary btn-sm" @click="addUser">{{ $t('btn_add_user') }}</button>
        </div>
      </div>

      <div v-if="tab === 'weather'" class="tab-content">
        <div class="form-group">
          <label>{{ $t('lbl_weather_city') }}</label>
          <input type="text" v-model="draft.weather_city" />
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_weather_units') }}</label>
          <select v-model="draft.weather_units">
            <option value="metric">Metric (°C)</option>
            <option value="imperial">Imperial (°F)</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_weather_update') }}</label>
          <input type="number" v-model.number="draft.weather_update_interval" min="5" max="1440" />
        </div>
      </div>

      <div v-if="tab === 'ai'" class="tab-content">
        <div class="form-group">
          <label>{{ $t('lbl_ollama_url') }}</label>
          <div class="input-with-btn">
            <input type="text" v-model="draft.ollama_base_url" placeholder="http://localhost:11434" />
            <button class="btn btn-secondary btn-sm" @click="loadModels">{{ $t('models_btn_label') }}</button>
          </div>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_ai_model') }}</label>
          <select v-model="draft.ai_model">
            <option value="">{{ $t('opt_select_model') }}</option>
            <option v-for="m in ai.models" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_ai_temp') }} <span>{{ aiTemp.toFixed(1) }}</span></label>
          <input type="range" min="0" max="2" step="0.1" v-model.number="aiTemp" />
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_ai_tokens') }}</label>
          <input type="number" v-model.number="draft.ai_max_tokens" min="50" max="2000" />
        </div>
      </div>

      <div v-if="tab === 'voice'" class="tab-content">
        <div class="form-group">
          <label>{{ $t('lbl_voice_lang') }}</label>
          <select v-model="draft.voice_language">
            <option value="ro-RO">{{ $t('opt_voice_ro') }}</option>
            <option value="en-US">{{ $t('opt_voice_en_us') }}</option>
            <option value="en-GB">{{ $t('opt_voice_en_gb') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_sensitivity') }} <span>{{ voiceSens.toFixed(1) }}</span></label>
          <input type="range" min="0" max="1" step="0.1" v-model.number="voiceSens" />
        </div>
        <div class="form-group form-inline">
          <label>{{ $t('lbl_auto_start') }}</label>
          <input type="checkbox" v-model="draft.voice_auto_start" />
        </div>
        <p class="form-hint">{{ $t('hint_wake_word', { phrase: draft.voice_activation_word || 'Hey HomeTasks' }) }}</p>
      </div>

      <div v-if="tab === 'tuya'" class="tab-content">
        <div class="form-group">
          <label>{{ $t('tuya_lbl_access_id') }}</label>
          <input type="text" v-model="draft.tuya_access_id" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>{{ $t('tuya_lbl_access_secret') }}</label>
          <input type="password" v-model="draft.tuya_access_secret" autocomplete="off" placeholder="••••••••" />
        </div>
        <div class="form-group">
          <label>{{ $t('tuya_lbl_region') }}</label>
          <select v-model="draft.tuya_api_region">
            <option value="eu">EU</option>
            <option value="us">US</option>
            <option value="cn">CN</option>
            <option value="in">IN</option>
          </select>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="emit('close')">{{ $t('btn_cancel') }}</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ $t('btn_save') }}</button>
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
  width: min(620px, 95vw);
  max-height: 92vh;
  overflow: auto;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.modal-head h2 { margin: 0; font-size: 1.15rem; }
.icon-btn { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; }
.settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid #eee;
  margin-bottom: 0.8rem;
}
.settings-tabs button {
  background: transparent;
  border: none;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  color: #555;
  font-size: 0.9rem;
}
.settings-tabs button.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
  font-weight: 600;
}
.tab-content { padding: 0.25rem 0 0.5rem; }
.form-group { margin-bottom: 0.85rem; }
.form-group.form-inline { display: flex; gap: 0.5rem; align-items: center; }
.form-group.form-inline label { flex: 1; margin-bottom: 0; }
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group input[type='range'] { padding: 0; }
.form-hint { color: #666; font-size: 0.8rem; margin-top: -0.4rem; }
.input-with-btn { display: flex; gap: 0.4rem; }
.input-with-btn input { flex: 1; }
.settings-users-list { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.5rem; }
.settings-user-row { display: flex; gap: 0.4rem; align-items: center; }
.settings-user-row input[type='text'] { flex: 1; }
.settings-user-row input[type='color'] { width: 36px; padding: 0; }
.settings-add-user {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid #eee;
}
.settings-add-user input[type='text'] { flex: 1; padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; }
.empty { color: #888; text-align: center; padding: 0.5rem; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  border-top: 1px solid #eee;
  padding-top: 0.75rem;
}
.btn {
  padding: 0.45rem 1rem;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;
  background: #eee;
}
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
.btn-primary { background: #1976d2; color: #fff; }
.btn-primary:hover { background: #1565c0; }
.btn-primary:disabled { background: #999; cursor: not-allowed; }
.btn-secondary { background: #eee; }
.btn-danger { background: #c62828; color: #fff; border: none; }
</style>
