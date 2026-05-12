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
  if (!description.value.trim()) { errorToast(t('validation_task_desc')); return; }
  if (selectedUserIds.value.length === 0) { errorToast(t('validation_task_users')); return; }
  if (!scheduledDate.value) { errorToast(t('validation_task_desc')); return; }

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
  <div v-if="open" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ $t(isEdit ? 'modal_edit_task_title' : 'modal_add_task_title') }}</h2>
        <button type="button" class="icon-btn" :title="$t('btn_close')" @click="emit('close')">✕</button>
      </div>
      <form class="tab-content active" @submit.prevent="submit" style="display:flex;">
        <div class="form-group">
          <label>{{ $t('lbl_task_desc') }}</label>
          <input type="text" v-model="description" required />
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_task_date') }}</label>
          <input type="datetime-local" v-model="scheduledDate" required />
        </div>
        <div class="form-group">
          <label>{{ $t('lbl_task_users') }}</label>
          <div class="users-checkbox-list">
            <label
              v-for="u in users.items"
              :key="u.id"
              class="user-checkbox-item"
              :style="{ '--user-color': u.color || '#3498db' }"
            >
              <input type="checkbox" :checked="selectedUserIds.includes(u.id)" @change="toggleUser(u.id)" />
              <span class="user-checkbox-dot"></span>
              <span>{{ u.name }}</span>
            </label>
          </div>
        </div>
        <div class="form-row">
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
        </div>
      </form>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('btn_cancel') }}</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="submit">
          {{ saving ? $t('loading') : $t(isEdit ? 'btn_save_changes' : 'btn_add_task') }}
        </button>
      </div>
    </div>
  </div>
</template>
