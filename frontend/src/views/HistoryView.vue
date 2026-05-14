<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { tasksApi } from '@/api/tasks';
import type { Task, TaskStatus } from '@/api/types';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import '@/assets/css/history.css';

const users = useUsersStore();
const { error: errorToast } = useNotification();

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Zilnic',
  weekly: 'Săptămânal',
  monthly: 'Lunar',
  yearly: 'Anual',
};
const STATUS_LABELS: Record<string, string> = {
  completed: 'Finalizat',
  refused: 'Refuzat',
  pending: 'În așteptare',
};

const userFilter = ref<string>('');
const statusFilter = ref<string>('');
const periodFilter = ref<string>('30');

const tasks = ref<Task[]>([]);
const loading = ref(false);
const loadError = ref(false);

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function loadTasks(): Promise<void> {
  loading.value = true;
  loadError.value = false;
  try {
    const query: Record<string, string | number> = {};
    if (userFilter.value) query.user_id = Number(userFilter.value);
    if (statusFilter.value) query.status = statusFilter.value as TaskStatus;
    const days = parseInt(periodFilter.value, 10);
    if (days > 0) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      query.start_date = toLocalISOString(startDate);
    }
    tasks.value = await tasksApi.list(query as never);
  } catch (e) {
    loadError.value = true;
    tasks.value = [];
    errorToast(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

interface MonthGroup {
  label: string;
  tasks: Task[];
}

const groups = computed<MonthGroup[]>(() => {
  const map = new Map<string, Task[]>();
  for (const task of tasks.value) {
    const d = task.scheduled_date ? new Date(task.scheduled_date) : null;
    const key = d
      ? d.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })
      : 'Fără dată';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }
  return [...map.entries()].map(([label, list]) => ({ label, tasks: list }));
});

function statusOf(task: Task): string {
  return task.status || 'pending';
}
function dateStr(task: Task): string {
  return task.scheduled_date
    ? new Date(task.scheduled_date).toLocaleDateString('ro-RO', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : '—';
}
function recurrenceLabel(task: Task): string {
  if (!task.recurrence_pattern || task.recurrence_pattern === 'none') return '';
  return RECURRENCE_LABELS[task.recurrence_pattern] || task.recurrence_pattern;
}

watch([userFilter, statusFilter, periodFilter], loadTasks);

onMounted(async () => {
  await users.fetchAll().catch(() => undefined);
  await loadTasks();
});
</script>

<template>
  <div class="history-view">
    <div class="history-content">
      <div class="history-filters">
        <select v-model="userFilter" title="Filtrează după utilizator">
          <option value="">Toți utilizatorii</option>
          <option v-for="u in users.items" :key="u.id" :value="String(u.id)">
            {{ u.name }}
          </option>
        </select>
        <select v-model="statusFilter" title="Filtrează după status">
          <option value="">Toate statusurile</option>
          <option value="completed">Finalizate</option>
          <option value="refused">Refuzate</option>
          <option value="pending">În așteptare</option>
        </select>
        <select v-model="periodFilter" title="Perioadă">
          <option value="7">Ultimele 7 zile</option>
          <option value="30">Ultima lună</option>
          <option value="90">Ultimele 3 luni</option>
          <option value="365">Ultimul an</option>
          <option value="0">Tot istoricul</option>
        </select>
      </div>

      <div class="history-list">
        <p v-if="loading" class="history-empty">Se încarcă...</p>
        <p v-else-if="loadError" class="history-empty">Eroare la încărcare.</p>
        <p v-else-if="!tasks.length" class="history-empty">
          Nu există taskuri în această perioadă.
        </p>
        <template v-else>
          <div v-for="group in groups" :key="group.label">
            <div class="history-group-header">
              {{ group.label }}
              <span style="font-weight:400;opacity:.7">({{ group.tasks.length }})</span>
            </div>
            <div
              v-for="task in group.tasks"
              :key="task.id"
              class="history-task"
              :class="statusOf(task)"
            >
              <div class="history-status-dot" :class="statusOf(task)"></div>
              <div class="history-task-body">
                <div class="history-task-desc">{{ task.description }}</div>
                <div class="history-task-meta">
                  <span>{{ dateStr(task) }}</span>
                  <span v-if="users.byId.get(task.user_id)">
                    <span
                      class="history-user-dot"
                      :style="{ background: users.byId.get(task.user_id)?.color || '#64748b' }"
                    ></span>
                    {{ users.byId.get(task.user_id)?.name }}
                  </span>
                  <span>{{ STATUS_LABELS[statusOf(task)] || statusOf(task) }}</span>
                  <span v-if="recurrenceLabel(task)">{{ recurrenceLabel(task) }}</span>
                  <span v-if="Number(task.comment_count || 0) > 0">
                    💬 {{ Number(task.comment_count) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
