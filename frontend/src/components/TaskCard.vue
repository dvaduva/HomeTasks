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
const dateLabel = computed(() => (scheduled.value ? formatDate(scheduled.value, dateFormat.value) : ''));
const timeLabel = computed(() => (scheduled.value ? formatTime(scheduled.value, timeFormat.value) : ''));

const recurrenceLabel = computed(() => {
  const p = props.task.recurrence_pattern;
  if (!p || p === 'none') return null;
  return t(`recur_${p}`);
});

async function setStatus(next: 'completed' | 'refused'): Promise<void> {
  const undo = (next === 'completed' && isCompleted.value) || (next === 'refused' && isRefused.value);
  const msgKey = undo
    ? next === 'completed' ? 'confirm_task_undo_complete' : 'confirm_task_undo_refuse'
    : next === 'completed' ? 'confirm_task_complete' : 'confirm_task_refuse';
  if (!(await confirm(t(msgKey)))) return;
  try {
    await tasks.update(props.task.id, { status: undo ? 'pending' : next });
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
  <div class="task-item" :class="{ completed: isCompleted, refused: isRefused }">
    <div class="task-content">
      <div class="task-title">{{ task.description }}</div>
      <div class="task-meta">
        <span class="task-date">{{ dateLabel }}</span>
        <span v-if="timeLabel" class="task-time">{{ timeLabel }}</span>
        <span class="task-user">
          <span class="user-color" :style="{ background: userColor, display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', verticalAlign: 'middle', marginRight: '4px' }"></span>
          {{ userName }}
        </span>
        <span v-if="recurrenceLabel" class="recurrence-badge">↻ {{ recurrenceLabel }}</span>
      </div>
      <div class="task-actions">
        <button
          type="button"
          class="task-btn"
          :class="isCompleted ? 'task-btn-undo' : 'task-btn-complete'"
          :title="$t(isCompleted ? 'btn_undo_complete' : 'btn_complete')"
          @click="setStatus('completed')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button
          type="button"
          class="task-btn"
          :class="isRefused ? 'task-btn-undo' : 'task-btn-refuse'"
          :title="$t(isRefused ? 'btn_undo_refuse' : 'btn_refuse')"
          @click="setStatus('refused')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button type="button" class="task-btn task-btn-comment" :title="$t('btn_comments')" @click="emit('comments', task)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span v-if="task.comment_count" class="comment-badge">{{ task.comment_count }}</span>
        </button>
        <button type="button" class="task-btn task-btn-edit" :title="$t('btn_edit')" @click="emit('edit', task)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="task-btn task-btn-delete" :title="$t('btn_delete')" @click="remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>
