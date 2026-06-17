import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: vi.fn() }),
}));
vi.mock('@/api/tasks', () => ({ tasksApi: { list: vi.fn() } }));
vi.mock('@/api/users', () => ({ usersApi: { list: vi.fn().mockResolvedValue([]) } }));

import { flushPromises } from '@vue/test-utils';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import HistoryView from './HistoryView.vue';
import { tasksApi } from '@/api/tasks';
import { usersApi } from '@/api/users';

const TASKS = [
  { id: 1, description: 'Task A', user_id: 1, status: 'completed', scheduled_date: '2026-03-10T09:00:00' },
  { id: 2, description: 'Task B', user_id: 1, status: 'refused', scheduled_date: '2026-03-20T09:00:00' },
  { id: 3, description: 'Task C', user_id: 2, status: 'pending', scheduled_date: '2026-04-01T09:00:00' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (tasksApi.list as any).mockResolvedValue(TASKS);
});

async function flush() {
  await flushPromises();
  await flushPromises();
}

describe('HistoryView.vue', () => {
  it('loads tasks on mount and groups them by month', async () => {
    const wrapper = mountWithPlugins(HistoryView);
    await flush();
    expect(tasksApi.list).toHaveBeenCalled();
    // March (2 tasks) + April (1 task) = 2 month groups.
    expect(wrapper.findAll('.history-group-header')).toHaveLength(2);
    expect(wrapper.findAll('.history-task')).toHaveLength(3);
  });

  it('applies the status class to each task row', async () => {
    const wrapper = mountWithPlugins(HistoryView);
    await flush();
    expect(wrapper.find('.history-task.completed').exists()).toBe(true);
    expect(wrapper.find('.history-task.refused').exists()).toBe(true);
  });

  it('reloads with a user_id query when the user filter changes', async () => {
    (usersApi.list as any).mockResolvedValue([{ id: 1, name: 'Ana' }]);
    const wrapper = mountWithPlugins(HistoryView);
    await flush();
    (tasksApi.list as any).mockClear();

    await wrapper.findAll('select')[0].setValue('1');
    await flush();
    expect(tasksApi.list).toHaveBeenCalled();
    const query = (tasksApi.list as any).mock.calls[0][0];
    expect(query.user_id).toBe(1);
  });

  it('shows the empty state when no tasks match', async () => {
    (tasksApi.list as any).mockResolvedValue([]);
    const wrapper = mountWithPlugins(HistoryView);
    await flush();
    expect(wrapper.find('.history-empty').text()).toContain('Nu există');
  });

  it('shows an error state when loading fails', async () => {
    (tasksApi.list as any).mockRejectedValue(new Error('500'));
    const wrapper = mountWithPlugins(HistoryView);
    await flush();
    expect(wrapper.find('.history-empty').text()).toContain('Eroare');
  });
});
