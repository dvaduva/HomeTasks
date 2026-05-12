import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tasksApi } from '@/api/tasks';
import type { Task, TaskCreate, TaskQuery, TaskUpdate } from '@/api/types';

export const useTasksStore = defineStore('tasks', () => {
  const all = ref<Task[]>([]);
  const today = ref<Task[]>([]);
  const upcoming = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function captureError(e: unknown): never {
    error.value = e instanceof Error ? e.message : String(e);
    throw e;
  }

  async function fetchAll(query?: TaskQuery): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      all.value = await tasksApi.list(query);
    } catch (e) {
      captureError(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchToday(userId?: number): Promise<void> {
    try {
      today.value = await tasksApi.today(userId ? { user_id: userId } : undefined);
    } catch (e) {
      captureError(e);
    }
  }

  async function fetchUpcoming(userId?: number, days = 7): Promise<void> {
    try {
      upcoming.value = await tasksApi.upcoming({ user_id: userId, days });
    } catch (e) {
      captureError(e);
    }
  }

  async function create(data: TaskCreate): Promise<Task> {
    const created = await tasksApi.create(data);
    all.value = [...all.value, created];
    return created;
  }

  async function update(id: number, data: TaskUpdate): Promise<Task> {
    const updated = await tasksApi.update(id, data);
    const apply = (list: Task[]) => list.map((t) => (t.id === id ? updated : t));
    all.value = apply(all.value);
    today.value = apply(today.value);
    upcoming.value = apply(upcoming.value);
    return updated;
  }

  async function remove(id: number): Promise<void> {
    await tasksApi.remove(id);
    const drop = (list: Task[]) => list.filter((t) => t.id !== id);
    all.value = drop(all.value);
    today.value = drop(today.value);
    upcoming.value = drop(upcoming.value);
  }

  return {
    all,
    today,
    upcoming,
    loading,
    error,
    fetchAll,
    fetchToday,
    fetchUpcoming,
    create,
    update,
    remove,
  };
});
