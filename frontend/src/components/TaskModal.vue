<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Task, RecurrencePattern } from '@/api/types';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';
import { useNotification } from '@/composables/useNotification';
import { toLocalInputValue, toDateInputValue } from '@/composables/useDateTime';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ open: boolean; task?: Task | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', task: Task): void }>();

const users = useUsersStore();
const tasks = useTasksStore();
const { error: errorToast, success } = useNotification();
const { t } = useI18n();

const description = ref('');
const scheduledDate = ref('');
const selectedUserIds = ref<number[]>([]);
const recurrence = ref<RecurrencePattern>('none');
const recurrenceEnd = ref('');
const saving = ref(false);

const isEdit = computed(() => !!props.task);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (props.task) {
      description.value = props.task.description;
      scheduledDate.value = toLocalInputValue(props.task.scheduled_date);
      selectedUserIds.value = [props.task.user_id];
      recurrence.value = (props.task.recurrence_pattern as RecurrencePattern) || 'none';
      recurrenceEnd.value = toDateInputValue(props.task.recurrence_end_date);
    } else {
      description.value = '';
      const d = new Date();
      d.setMinutes(0);
      d.setSeconds(0);
      scheduledDate.value = toLocalInputValue(d);
      selectedUserIds.value = users.activeIds.length > 0 ? [...users.activeIds] : users.items[0] ? [users.items[0].id] : [];
      recurrence.value = 'none';
      recurrenceEnd.value = '';
    }
  },
  { immediate: true },
);

function toggleUser(id: number): void {
  const idx = selectedUserIds.value.indexOf(id);
  if (idx >= 0) selectedUserIds.value.splice(idx, 1);
  else selectedUserIds.value.push(id);
}

async function submit(): Promise<void> {
  if (!description.value.trim()) {
    errorToast(t('validation_task_desc'));
    return;
  }
  if (selectedUserIds.value.length === 0) {
    errorToast(t('validation_task_users'));
    return;
  }
  if (!scheduledDate.value) {
    errorToast(t('validation_task_desc'));
    return;
  }

  saving.value = true;
  try {
    const scheduledIso = new Date(scheduledDate.value).toISOString();
    const recEndIso = recurrenceEnd.value ? new Date(recurrenceEnd.value).toISOString() : null;

    if (isEdit.value && props.task) {
      const updated = await tasks.update(props.task.id, {
        description: description.value.trim(),
        user_id: selectedUserIds.value[0],
        scheduled_date: scheduledIso,
        recurrence_pattern: recurrence.value,
        recurrence_end_date: recEndIso,
      });
      success(t('settings_saved'));
      emit('saved', updated);
    } else {
      // One backend task per user when multiple selected.
      let last: Task | null = null;
      for (const uid of selectedUserIds.value) {
        last = await tasks.create({
          description: description.value.trim(),
          user_id: uid,
          scheduled_date: scheduledIso,
          recurrence_pattern: recurrence.value,
          recurrence_end_date: recEndIso,
        });
      }
      if (last) emit('saved', last);
    }
    emit('close');
  } catch (e) {
    errorToast(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ $t(isEdit ? 'modal_edit_task_title' : 'modal_add_task_title') }}</h2>
        <button class="icon-btn" @click="emit('close')">✕</button>
      </div>
      <form @submit.prevent="submit">
        <div class="form-group">
          <label>{{ $t('lbl_task_desc') }}</label>
          <textarea v-model="description" rows="2" required></textarea>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_task_date') }}</label>
          <input type="datetime-local" v-model="scheduledDate" required />
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_task_users') }}</label>
          <div class="user-pick">
            <button
              v-for="u in users.items"
              :key="u.id"
              type="button"
              class="user-pill"
              :class="{ active: selectedUserIds.includes(u.id) }"
              :style="{ '--user-color': u.color || '#888' }"
              @click="toggleUser(u.id)"
            >
              <span class="dot" :style="{ background: u.color || '#888' }"></span>
              {{ u.name }}
            </button>
          </div>
          <small v-if="!isEdit && selectedUserIds.length > 1" class="form-hint">
            Vor fi create {{ selectedUserIds.length }} taskuri (câte unul per utilizator).
          </small>
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_task_recurrence') }}</label>
          <select v-model="recurrence">
            <option value="none">{{ $t('recur_none') }}</option>
            <option value="daily">{{ $t('recur_daily') }}</option>
            <option value="weekly">{{ $t('recur_weekly') }}</option>
            <option value="monthly">{{ $t('recur_monthly') }}</option>
            <option value="yearly">{{ $t('recur_yearly') }}</option>
          </select>
        </div>
        <div class="form-group" v-if="recurrence !== 'none'">
          <label>{{ $t('lbl_task_recurrence_end') }}</label>
          <input type="date" v-model="recurrenceEnd" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('btn_cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? $t('loading') : $t(isEdit ? 'btn_save_changes' : 'btn_add_task') }}
          </button>
        </div>
      </form>
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
  padding: 1.25rem 1.5rem;
  width: min(520px, 92vw);
  max-height: 90vh;
  overflow: auto;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.modal-head h2 {
  margin: 0;
  font-size: 1.15rem;
}
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
}
.form-group {
  margin-bottom: 0.85rem;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
  box-sizing: border-box;
}
.form-hint {
  display: block;
  margin-top: 0.3rem;
  color: #666;
  font-size: 0.8rem;
}
.user-pick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.user-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  cursor: pointer;
  font-size: 0.85rem;
}
.user-pill.active {
  background: var(--user-color, #1976d2);
  color: #fff;
  border-color: var(--user-color, #1976d2);
}
.user-pill .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.user-pill.active .dot { background: #fff !important; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
.btn {
  padding: 0.45rem 1rem;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;
}
.btn-primary { background: #1976d2; color: #fff; }
.btn-primary:hover { background: #1565c0; }
.btn-primary:disabled { background: #999; cursor: not-allowed; }
.btn-secondary { background: #eee; }
.btn-secondary:hover { background: #ddd; }
</style>
