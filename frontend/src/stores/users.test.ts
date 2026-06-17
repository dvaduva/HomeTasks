import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/users', () => ({
  usersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import { usersApi } from '@/api/users';
import { useUsersStore } from './users';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('users store', () => {
  it('byId indexes loaded users', async () => {
    (usersApi.list as any).mockResolvedValue([
      { id: 1, name: 'Ana' },
      { id: 2, name: 'Bob' },
    ]);
    const store = useUsersStore();
    await store.fetchAll();
    expect(store.byId.get(2)!.name).toBe('Bob');
  });

  it('activeUsers reflects the active id selection', () => {
    const store = useUsersStore();
    store.items = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bob' }] as any;
    store.setActiveIds([2]);
    expect(store.activeUsers.map((u) => u.id)).toEqual([2]);
  });

  it('setActiveIds persists to localStorage', () => {
    const store = useUsersStore();
    store.setActiveIds([1, 3]);
    expect(JSON.parse(localStorage.getItem('hometasks.activeUserIds')!)).toEqual([1, 3]);
  });

  it('toggleActive adds then removes an id', () => {
    const store = useUsersStore();
    store.toggleActive(5);
    expect(store.activeIds).toContain(5);
    store.toggleActive(5);
    expect(store.activeIds).not.toContain(5);
  });

  it('create appends the new user', async () => {
    (usersApi.create as any).mockResolvedValue({ id: 9, name: 'Cara' });
    const store = useUsersStore();
    store.items = [{ id: 1, name: 'Ana' }] as any;
    await store.create('Cara');
    expect(store.items.map((u) => u.id)).toEqual([1, 9]);
  });

  it('remove drops the user and clears it from active ids', async () => {
    (usersApi.remove as any).mockResolvedValue(undefined);
    const store = useUsersStore();
    store.items = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bob' }] as any;
    store.setActiveIds([1, 2]);
    await store.remove(1);
    expect(store.items.map((u) => u.id)).toEqual([2]);
    expect(store.activeIds).toEqual([2]);
  });

  it('loads active ids from localStorage on init, ignoring junk', () => {
    localStorage.setItem('hometasks.activeUserIds', JSON.stringify([1, 'x', 2]));
    const store = useUsersStore();
    expect(store.activeIds).toEqual([1, 2]); // non-numbers filtered out
  });
});
