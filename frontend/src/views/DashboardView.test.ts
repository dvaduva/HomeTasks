import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: vi.fn() }),
}));
// Stores fetch on mount — keep their API calls harmless.
vi.mock('@/api/users', () => ({ usersApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/api/preferences', () => ({ preferencesApi: { get: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/api/tasks', () => ({
  tasksApi: { list: vi.fn().mockResolvedValue([]), today: vi.fn().mockResolvedValue([]) },
}));

import { flushPromises } from '@vue/test-utils';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import DashboardView from './DashboardView.vue';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';

// Stub child components — each has its own suite; here we test the view's
// filtering/wiring, reading the counts it derives.
const stubs = {
  UserBar: { template: '<div />' },
  TaskList: { props: ['tasks'], template: '<div class="tl" :data-count="tasks.length" />' },
  TaskModal: { props: ['open'], template: '<div />' },
  CommentsModal: { props: ['open'], template: '<div />' },
};

function mountDash() {
  return mountWithPlugins(DashboardView, { global: { stubs } });
}

async function flush() {
  await flushPromises();
  await flushPromises();
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('DashboardView.vue', () => {
  it('passes all and today tasks to the two TaskList columns', async () => {
    const wrapper = mountDash();
    await flush(); // let onMounted's reloadTasks settle (it resets the lists)
    const tasks = useTasksStore();
    tasks.all = [
      { id: 1, user_id: 1, scheduled_date: '2026-06-10T08:00:00' },
      { id: 2, user_id: 2, scheduled_date: '2026-06-11T08:00:00' },
    ] as any;
    tasks.today = [{ id: 1, user_id: 1 }] as any;
    await flush();
    const counts = wrapper.findAll('.tl').map((c) => c.attributes('data-count'));
    expect(counts).toEqual(['2', '1']); // all column = 2, today column = 1
  });

  it('filters both columns by the active user selection', async () => {
    const wrapper = mountDash();
    await flush();
    const users = useUsersStore();
    const tasks = useTasksStore();
    tasks.all = [
      { id: 1, user_id: 1, scheduled_date: '2026-06-10T08:00:00' },
      { id: 2, user_id: 2, scheduled_date: '2026-06-11T08:00:00' },
    ] as any;
    tasks.today = [{ id: 1, user_id: 1 }, { id: 3, user_id: 2 }] as any;
    users.setActiveIds([1]);
    await flush();
    const counts = wrapper.findAll('.tl').map((c) => c.attributes('data-count'));
    expect(counts).toEqual(['1', '1']); // only user 1's tasks in each column
  });

  it('sorts the "all" column by scheduled date', async () => {
    const wrapper = mountDash();
    await flush();
    const tasks = useTasksStore();
    tasks.all = [
      { id: 1, user_id: 1, scheduled_date: '2026-06-20T08:00:00' },
      { id: 2, user_id: 1, scheduled_date: '2026-06-05T08:00:00' },
    ] as any;
    await flush();
    // The view sorts ascending; assert via the TaskList stub's first task id.
    const allCol = wrapper.findAllComponents(stubs.TaskList as any)[0];
    expect((allCol.props('tasks') as any[])[0].id).toBe(2); // earlier date first
  });
});
