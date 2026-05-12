<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '@/api/types';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';
import { usePreferencesStore } from '@/stores/preferences';
import { useNotification } from '@/composables/useNotification';
import { formatDate, formatTime } from '@/composables/useDateTime';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ task: Task }>();
const emit = defineEmits<{
  (e: 'edit', t: Task): void;
  (e: 'comments', t: Task): void;
}>();

const users = useUsersStore();
const tasks = useTasksStore();
const prefs = usePreferencesStore();
const { confirm, error: errorToast } = useNotification();
const { t } = useI18n();

const user = computed(() => users.byId.get(props.task.user_id) || null);
const userColor = computed(() => user.value?.color || '#888');
const userName = computed(() => props.task.user_name || user.value?.name || '?');

const status = computed(() => props.task.status || 'pending');
const isCompleted = computed(() => status.value === 'completed');
const isRefused = computed(() => status.value === 'refused');

const scheduled = computed(() => (props.task.scheduled_date ? new Date(props.task.scheduled_date) : null));
const dateFormat = computed(() => (prefs.data?.date_format as 'short' | 'long' | 'full') || 'short');
const timeFormat = computed(() => (prefs.data?.time_format as '24' | '12') || '24');

const scheduledLabel = computed(() => {
  if (!scheduled.value) return '';
  return `${formatDate(scheduled.value, dateFormat.value)} ${formatTime(scheduled.value, timeFormat.value)}`;
});

const recurrenceLabel = computed(() => {
  const p = props.task.recurrence_pattern;
  if (!p || p === 'none') return null;
  return t(`recur_${p}`);
});

async function setStatus(next: 'pending' | 'completed' | 'refused'): Promise<void> {
  const msgKey =
    next === 'completed'
      ? isCompleted.value
        ? 'confirm_task_undo_complete'
        : 'confirm_task_complete'
      : next === 'refused'
        ? isRefused.value
          ? 'confirm_task_undo_refuse'
          : 'confirm_task_refuse'
        : null;
  // For undo, set back to pending.
  const target: 'pending' | 'completed' | 'refused' =
    (next === 'completed' && isCompleted.value) || (next === 'refused' && isRefused.value)
      ? 'pending'
      : next;
  if (msgKey && !(await confirm(t(msgKey)))) return;
  try {
    await tasks.update(props.task.id, { status: target });
  } catch (e) {
    errorToast(e instanceof Error ? e.message : String(e));
  }
}

async function remove(): Promise<void> {
  if (!(await confirm(t('confirm_task_delete')))) return;
  try {
    await tasks.remove(props.task.id);
  } catch (e) {
    errorToast(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div class="task-card" :class="{ completed: isCompleted, refused: isRefused }" :style="{ '--user-color': userColor }">
    <div class="task-card-head">
      <span class="task-user-chip" :style="{ background: userColor }">{{ userName }}</span>
      <span class="task-date">{{ scheduledLabel }}</span>
      <span v-if="recurrenceLabel" class="task-recur" :title="recurrenceLabel">↻ {{ recurrenceLabel }}</span>
    </div>
    <div class="task-desc">{{ task.description }}</div>
    <div class="task-actions">
      <button
        type="button"
        class="task-btn"
        :class="{ active: isCompleted }"
        @click="setStatus('completed')"
        :title="$t(isCompleted ? 'btn_undo_complete' : 'btn_complete')"
      >✓</button>
      <button
        type="button"
        class="task-btn"
        :class="{ active: isRefused }"
        @click="setStatus('refused')"
        :title="$t(isRefused ? 'btn_undo_refuse' : 'btn_refuse')"
      >✗</button>
      <button type="button" class="task-btn" @click="emit('comments', task)" :title="$t('btn_comments')">
        💬<span v-if="task.comment_count" class="comment-count">{{ task.comment_count }}</span>
      </button>
      <button type="button" class="task-btn" @click="emit('edit', task)" :title="$t('btn_edit')">✎</button>
      <button type="button" class="task-btn" @click="remove" :title="$t('btn_delete')">🗑</button>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  border-left: 4px solid var(--user-color, #888);
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.5rem;
  transition: opacity 0.15s;
}
.task-card.completed {
  opacity: 0.55;
}
.task-card.completed .task-desc {
  text-decoration: line-through;
}
.task-card.refused {
  opacity: 0.55;
  background: #fafafa;
}
.task-card.refused .task-desc {
  text-decoration: line-through;
  color: #b71c1c;
}
.task-card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  margin-bottom: 0.3rem;
  flex-wrap: wrap;
}
.task-user-chip {
  color: #fff;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
}
.task-date {
  color: #555;
}
.task-recur {
  color: #777;
  font-size: 0.7rem;
}
.task-desc {
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
  word-break: break-word;
}
.task-actions {
  display: flex;
  gap: 0.3rem;
}
.task-btn {
  flex: 1;
  background: #f4f4f4;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.3rem;
  cursor: pointer;
  position: relative;
  font-size: 0.85rem;
}
.task-btn:hover {
  background: #ececec;
}
.task-btn.active {
  background: var(--user-color, #1976d2);
  color: #fff;
  border-color: var(--user-color, #1976d2);
}
.comment-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #c62828;
  color: #fff;
  border-radius: 999px;
  padding: 0 0.3rem;
  font-size: 0.65rem;
  font-weight: 600;
}
</style>
