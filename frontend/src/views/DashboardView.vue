<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
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
  // "Toate taskurile" column shows upcoming (next 7 days) for selected users.
  const list = users.activeIds.length === 0
    ? tasks.upcoming
    : tasks.upcoming.filter((t) => users.activeIds.includes(t.user_id));
  // Sort by date ascending.
  return [...list].sort((a, b) => {
    const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
    const db = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
    return da - db;
  });
});

async function reloadTasks(): Promise<void> {
  try {
    await Promise.all([tasks.fetchToday(), tasks.fetchUpcoming(undefined, 7)]);
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

function onTaskSaved(): void {
  reloadTasks();
}

watch(
  () => users.activeIds,
  () => {
    // Active user changes don't need refetch — filtering is client-side.
  },
);

onMounted(async () => {
  await Promise.allSettled([users.fetchAll(), prefs.fetch()]);
  await reloadTasks();
});

defineExpose({ openAdd });
</script>

<template>
  <div class="dashboard">
    <UserBar @add-task="openAdd" />

    <div class="tasks-grid">
      <section class="task-col">
        <header class="col-label">
          <span>{{ $t('col_all_tasks') }}</span>
          <span class="col-count" v-if="filteredAll.length">{{ filteredAll.length }}</span>
        </header>
        <TaskList
          :tasks="filteredAll"
          :loading="tasks.loading"
          empty-key="no_tasks"
          @edit="openEdit"
          @comments="openComments"
        />
      </section>

      <section class="task-col">
        <header class="col-label today-col">
          <span class="pulse-dot"></span>
          <span>{{ $t('col_today') }}</span>
          <span class="col-count" v-if="filteredToday.length">{{ filteredToday.length }}</span>
        </header>
        <TaskList
          :tasks="filteredToday"
          :loading="tasks.loading"
          empty-key="no_tasks_today"
          @edit="openEdit"
          @comments="openComments"
        />
      </section>
    </div>

    <TaskModal :open="taskModalOpen" :task="editing" @close="taskModalOpen = false" @saved="onTaskSaved" />
    <CommentsModal :open="!!commentsTask" :task="commentsTask" @close="commentsTask = null" @added="reloadTasks" />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px - 56px); /* header + footer */
  min-height: 400px;
}
.tasks-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding: 0.5rem;
  overflow: hidden;
}
.task-col {
  background: #f7f8fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.col-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #fff;
  border-bottom: 1px solid #eee;
  color: #444;
}
.col-count {
  margin-left: auto;
  background: #1976d2;
  color: #fff;
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
  font-size: 0.75rem;
}
.today-col .pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef5350;
  display: inline-block;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(239, 83, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0); }
}
@media (max-width: 720px) {
  .tasks-grid {
    grid-template-columns: 1fr;
  }
}
</style>
