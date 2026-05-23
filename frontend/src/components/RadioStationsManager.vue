<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRadioStore } from '@/stores/radio';
import { useNotification } from '@/composables/useNotification';
import type { RadioStation, RadioStationInput } from '@/api/radio';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const radio = useRadioStore();
const { success, error: errorToast, confirm } = useNotification();
const { t } = useI18n();

// Form state. mode 'none' = just the list; 'new' = add form; 'edit' = editing
// the station whose slug is in editingId.
type Mode = 'none' | 'new' | 'edit';
const mode = ref<Mode>('none');
const editingId = ref<string | null>(null);
const saving = ref(false);
const reordering = ref(false);

const blank: RadioStationInput = {
  name: '', url: '', genre: '', description: '', logo: '', content_type: '', proxy: false,
};
const draft = reactive<RadioStationInput>({ ...blank });

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

function startAdd(): void {
  Object.assign(draft, blank);
  editingId.value = null;
  mode.value = 'new';
}

function startEdit(s: RadioStation): void {
  Object.assign(draft, {
    name: s.name,
    url: s.url,
    genre: s.genre || '',
    description: s.description || '',
    logo: s.logo || '',
    content_type: s.content_type || '',
    proxy: !!s.proxy,
  });
  editingId.value = s.id;
  mode.value = 'edit';
}

function cancelForm(): void {
  mode.value = 'none';
  editingId.value = null;
}

async function saveForm(): Promise<void> {
  if (!draft.name.trim()) { errorToast(t('radio_mgr_err_name')); return; }
  if (!draft.url.trim()) { errorToast(t('radio_mgr_err_url')); return; }
  saving.value = true;
  try {
    if (mode.value === 'edit' && editingId.value) {
      await radio.updateStation(editingId.value, { ...draft });
      success(t('radio_mgr_updated'));
    } else {
      await radio.createStation({ ...draft });
      success(t('radio_mgr_added'));
    }
    cancelForm();
  } catch (e) {
    errorToast(e instanceof Error ? e.message : t('radio_mgr_save_error'));
  } finally {
    saving.value = false;
  }
}

async function remove(s: RadioStation): Promise<void> {
  const ok = await confirm(t('radio_mgr_delete_confirm', { name: s.name }));
  if (!ok) return;
  try {
    await radio.deleteStation(s.id);
    success(t('radio_mgr_deleted'));
    if (editingId.value === s.id) cancelForm();
  } catch (e) {
    errorToast(e instanceof Error ? e.message : t('radio_mgr_delete_error'));
  }
}

async function move(index: number, dir: -1 | 1): Promise<void> {
  const list = radio.stations;
  const target = index + dir;
  if (target < 0 || target >= list.length || reordering.value) return;
  const order = list.map((s) => s.id);
  [order[index], order[target]] = [order[target], order[index]];
  reordering.value = true;
  try {
    await radio.reorderStations(order);
  } catch (e) {
    errorToast(e instanceof Error ? e.message : t('radio_mgr_reorder_error'));
  } finally {
    reordering.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal rd-mgr">
      <div class="modal-head">
        <h2>{{ $t('radio_mgr_title') }}</h2>
        <button type="button" class="icon-btn" :title="$t('radio_mgr_close')" @click="emit('close')">✕</button>
      </div>

      <!-- Add / Edit form -->
      <div v-if="mode !== 'none'" class="rd-mgr-form">
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('radio_mgr_lbl_name') }}</label>
            <input type="text" v-model="draft.name" :placeholder="$t('radio_mgr_ph_name')" />
          </div>
          <div class="form-group">
            <label>{{ $t('radio_mgr_lbl_genre') }}</label>
            <input type="text" v-model="draft.genre" :placeholder="$t('radio_mgr_ph_genre')" />
          </div>
        </div>
        <div class="form-group">
          <label>{{ $t('radio_mgr_lbl_url') }}</label>
          <input type="text" v-model="draft.url" :placeholder="$t('radio_mgr_ph_url')" />
        </div>
        <div class="form-group">
          <label>{{ $t('radio_mgr_lbl_description') }}</label>
          <input type="text" v-model="draft.description" :placeholder="$t('radio_mgr_ph_description')" />
        </div>
        <div class="form-group">
          <label>{{ $t('radio_mgr_lbl_logo') }}</label>
          <input type="text" v-model="draft.logo" :placeholder="$t('radio_mgr_ph_logo')" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('radio_mgr_lbl_content_type') }}</label>
            <select v-model="draft.content_type">
              <option value="">{{ $t('radio_mgr_ct_auto') }}</option>
              <option value="audio/mpeg">audio/mpeg (MP3)</option>
              <option value="audio/aac">audio/aac (AAC)</option>
              <option value="audio/ogg">audio/ogg</option>
              <option value="application/vnd.apple.mpegurl">{{ $t('radio_mgr_ct_hls') }}</option>
            </select>
          </div>
          <div class="form-group form-inline rd-mgr-proxy">
            <label>{{ $t('radio_mgr_lbl_proxy') }}</label>
            <input type="checkbox" v-model="draft.proxy" />
          </div>
        </div>
        <p class="form-hint">{{ $t('radio_mgr_proxy_hint') }}</p>
        <div class="rd-mgr-form-actions">
          <button type="button" class="btn btn-secondary" @click="cancelForm">{{ $t('radio_mgr_cancel') }}</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="saveForm">
            {{ mode === 'edit' ? $t('radio_mgr_save') : $t('radio_mgr_create') }}
          </button>
        </div>
      </div>

      <!-- Stations list -->
      <div v-show="mode === 'none'" class="rd-mgr-body">
        <div class="rd-mgr-toolbar">
          <span class="rd-mgr-count">{{ $t('radio_mgr_count', { count: radio.stations.length }) }}</span>
          <button type="button" class="btn btn-primary btn-sm" @click="startAdd">{{ $t('radio_mgr_add') }}</button>
        </div>

        <p v-if="!radio.stations.length" class="settings-empty">{{ $t('radio_mgr_empty') }}</p>

        <ul class="rd-mgr-list">
          <li v-for="(s, i) in radio.stations" :key="s.id" class="rd-mgr-row">
            <div class="rd-mgr-reorder">
              <button type="button" class="rd-mgr-arrow" :title="$t('radio_mgr_move_up')" :disabled="i === 0 || reordering" @click="move(i, -1)">▲</button>
              <button type="button" class="rd-mgr-arrow" :title="$t('radio_mgr_move_down')" :disabled="i === radio.stations.length - 1 || reordering" @click="move(i, 1)">▼</button>
            </div>
            <div class="rd-mgr-logo">
              <img v-if="s.logo" :src="s.logo" alt="" />
              <span v-else>{{ initials(s.name) }}</span>
            </div>
            <div class="rd-mgr-info">
              <div class="rd-mgr-name">
                {{ s.name }}
                <span v-if="s.proxy" class="rd-mgr-badge">{{ $t('radio_mgr_proxy_badge') }}</span>
              </div>
              <div class="rd-mgr-sub">{{ s.genre || s.description || s.url }}</div>
            </div>
            <div class="rd-mgr-actions">
              <button type="button" class="btn btn-secondary btn-sm" @click="startEdit(s)">{{ $t('radio_mgr_edit') }}</button>
              <button type="button" class="btn btn-danger btn-sm" @click="remove(s)">{{ $t('radio_mgr_delete') }}</button>
            </div>
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('radio_mgr_close') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rd-mgr-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.rd-mgr-count {
  font-size: 13px;
  color: var(--rd-gray-500, #64748b);
  font-weight: 600;
}
.rd-mgr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 52vh;
  overflow-y: auto;
}
.rd-mgr-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--rd-gray-200, #e2e8f0);
  border-radius: 10px;
  background: var(--rd-gray-50, #f8fafc);
}
.rd-mgr-reorder {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 0 0 auto;
}
.rd-mgr-arrow {
  width: 24px;
  height: 18px;
  line-height: 1;
  font-size: 10px;
  border: 1px solid var(--rd-gray-300, #cbd5e1);
  background: #fff;
  color: var(--rd-gray-500, #64748b);
  border-radius: 5px;
  cursor: pointer;
}
.rd-mgr-arrow:disabled { opacity: 0.35; cursor: default; }
.rd-mgr-arrow:not(:disabled):hover {
  background: var(--rd-accent-lt, #ede9fe);
  color: var(--rd-accent-dk, #6d28d9);
}
.rd-mgr-logo {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rd-accent-lt, #ede9fe);
  color: var(--rd-accent-dk, #6d28d9);
  font-weight: 700;
  font-size: 13px;
}
.rd-mgr-logo img { width: 100%; height: 100%; object-fit: contain; }
.rd-mgr-info { flex: 1; min-width: 0; }
.rd-mgr-name {
  font-weight: 600;
  color: var(--rd-gray-900, #0f172a);
  display: flex;
  align-items: center;
  gap: 6px;
}
.rd-mgr-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--rd-accent-lt, #ede9fe);
  color: var(--rd-accent-dk, #6d28d9);
}
.rd-mgr-sub {
  font-size: 12px;
  color: var(--rd-gray-500, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rd-mgr-actions { flex: 0 0 auto; display: flex; gap: 6px; }
.rd-mgr-body { padding: 16px; }
.rd-mgr-form { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.rd-mgr-proxy { justify-content: flex-start; gap: 10px; align-items: center; }
.rd-mgr-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
