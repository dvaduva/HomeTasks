import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock the API module the store depends on.
vi.mock('@/api/tasks', () => ({
  tasksApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    today: vi.fn(),
    upcoming: vi.fn(),
  },
}));

import { tasksApi } from '@/api/tasks';
import { useTasksStore } from './tasks';

const task = (id: number, over: Record<string, unknown> = {}) =>
  ({ id, description: `t${id}`, status: 'pending', ...over }) as any;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('tasks store', () => {
  it('fetchAll populates `all` and toggles loading', async () => {
    (tasksApi.list as any).mockResolvedValue([task(1), task(2)]);
    const store = useTasksStore();
    const p = store.fetchAll();
    expect(store.loading).toBe(true);
    await p;
    expect(store.loading).toBe(false);
    expect(store.all).toHaveLength(2);
    expect(store.error).toBeNull();
  });

  it('fetchAll captures the error and rethrows', async () => {
    (tasksApi.list as any).mockRejectedValue(new Error('boom'));
    const store = useTasksStore();
    await expect(store.fetchAll()).rejects.toThrow('boom');
    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('create appends the new task to `all`', async () => {
    (tasksApi.create as any).mockResolvedValue(task(5));
    const store = useTasksStore();
    store.all = [task(1)];
    const created = await store.create({} as any);
    expect(created.id).toBe(5);
    expect(store.all.map((t) => t.id)).toEqual([1, 5]);
  });

  it('update replaces the task across all/today/upcoming lists', async () => {
    const updated = task(1, { description: 'renamed' });
    (tasksApi.update as any).mockResolvedValue(updated);
    const store = useTasksStore();
    store.all = [task(1), task(2)];
    store.today = [task(1)];
    store.upcoming = [task(1)];
    await store.update(1, {} as any);
    expect(store.all.find((t) => t.id === 1)!.description).toBe('renamed');
    expect(store.today[0].description).toBe('renamed');
    expect(store.upcoming[0].description).toBe('renamed');
  });

  it('remove drops the task from every list', async () => {
    (tasksApi.remove as any).mockResolvedValue(undefined);
    const store = useTasksStore();
    store.all = [task(1), task(2)];
    store.today = [task(2)];
    store.upcoming = [task(2)];
    await store.remove(2);
    expect(store.all.map((t) => t.id)).toEqual([1]);
    expect(store.today).toEqual([]);
    expect(store.upcoming).toEqual([]);
  });

  it('fetchUpcoming forwards userId and days', async () => {
    (tasksApi.upcoming as any).mockResolvedValue([]);
    const store = useTasksStore();
    await store.fetchUpcoming(7, 3);
    expect(tasksApi.upcoming).toHaveBeenCalledWith({ user_id: 7, days: 3 });
  });
});
