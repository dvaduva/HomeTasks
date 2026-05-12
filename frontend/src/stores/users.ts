import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { usersApi } from '@/api/users';
import type { User } from '@/api/types';

const ACTIVE_KEY = 'hometasks.activeUserIds';

function loadActive(): number[] {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export const useUsersStore = defineStore('users', () => {
  const items = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeIds = ref<number[]>(loadActive());

  const byId = computed(() => {
    const map = new Map<number, User>();
    for (const u of items.value) map.set(u.id, u);
    return map;
  });

  const activeUsers = computed(() => items.value.filter((u) => activeIds.value.includes(u.id)));

  async function fetchAll(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await usersApi.list();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, color?: string): Promise<User> {
    const user = await usersApi.create({ name, color });
    items.value = [...items.value, user];
    return user;
  }

  async function update(id: number, data: Partial<Pick<User, 'name' | 'color'>>): Promise<User> {
    const updated = await usersApi.update(id, data);
    items.value = items.value.map((u) => (u.id === id ? updated : u));
    return updated;
  }

  async function remove(id: number): Promise<void> {
    await usersApi.remove(id);
    items.value = items.value.filter((u) => u.id !== id);
    setActiveIds(activeIds.value.filter((n) => n !== id));
  }

  function setActiveIds(ids: number[]): void {
    activeIds.value = ids;
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids));
  }

  function toggleActive(id: number): void {
    setActiveIds(
      activeIds.value.includes(id) ? activeIds.value.filter((n) => n !== id) : [...activeIds.value, id],
    );
  }

  return {
    items,
    loading,
    error,
    activeIds,
    byId,
    activeUsers,
    fetchAll,
    create,
    update,
    remove,
    setActiveIds,
    toggleActive,
  };
});
