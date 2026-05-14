<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Task } from '@/api/types';
import { useUsersStore } from '@/stores/users';
import { usePreferencesStore } from '@/stores/preferences';
import { useTasksStore } from '@/stores/tasks';
import { useNotification } from '@/composables/useNotification';
import UserBar from '@/components/UserBar.vue';
import TaskList from '@/components/TaskList.vue';
import TaskModal from '@/components/TaskModal.vue';
import CommentsModal from '@/components/CommentsModal.vue';

const users = useUsersStore();
const prefs = usePreferencesStore();
const tasks = useTasksStore();
const { error: errorToast } = useNotification();

const editing = ref<Task | null>(null);
const taskModalOpen = ref(false);
const commentsTask = ref<Task | null>(null);

const filteredToday = computed(() =>
  users.activeIds.length === 0
    ? tasks.today
    : tasks.today.filter((t) => users.activeIds.includes(t.user_id)),
);

const filteredAll = computed(() => {
  const list = users.activeIds.length === 0
    ? tasks.all
    : tasks.all.filter((t) => users.activeIds.includes(t.user_id));
  return [...list].sort((a, b) => {
    const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
    const db = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
    return da - db;
  });
});

async function reloadTasks(): Promise<void> {
  try {
    // "Toate taskurile" lists every task (like the legacy /api/tasks call);
    // "Azi" is the separate today-only feed.
    await Promise.all([tasks.fetchToday(), tasks.fetchAll()]);
  } catch (e) {
    errorToast(e instanceof Error ? e.message : String(e));
  }
}

function openAdd(): void {
  editing.value = null;
  taskModalOpen.value = true;
}

function openEdit(t: Task): void {
  editing.value = t;
  taskModalOpen.value = true;
}

function openComments(t: Task): void {
  commentsTask.value = t;
}

onMounted(async () => {
  await Promise.allSettled([users.fetchAll(), prefs.fetch()]);
  await reloadTasks();
});
</script>

<template>
  <UserBar @add-task="openAdd" />

  <div class="tasks-wrap">
    <div class="tasks-grid">
      <div class="task-col">
        <div class="col-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>{{ $t('col_all_tasks') }}</span>
          <span v-if="filteredAll.length" class="col-count">{{ filteredAll.length }}</span>
        </div>
        <TaskList
          :tasks="filteredAll"
          :loading="tasks.loading"
          empty-key="no_tasks"
          @edit="openEdit"
          @comments="openComments"
        />
      </div>

      <div class="task-col">
        <div class="col-label today-col">
          <span class="pulse-dot"></span>
          <span>{{ $t('col_today') }}</span>
          <span v-if="filteredToday.length" class="col-count">{{ filteredToday.length }}</span>
        </div>
        <TaskList
          :tasks="filteredToday"
          :loading="tasks.loading"
          empty-key="no_tasks_today"
          @edit="openEdit"
          @comments="openComments"
        />
      </div>
    </div>
  </div>

  <TaskModal :open="taskModalOpen" :task="editing" @close="taskModalOpen = false" @saved="reloadTasks" />
  <CommentsModal :open="!!commentsTask" :task="commentsTask" @close="commentsTask = null" @added="reloadTasks" />
</template>
