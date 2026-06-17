import { beforeEach, describe, expect, it, vi } from 'vitest';

// Control the confirm() dialog so status changes proceed (or not) deterministically.
const confirmMock = vi.fn();
const errorToastMock = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ confirm: confirmMock, error: errorToastMock }),
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import TaskCard from './TaskCard.vue';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';

const baseTask = {
  id: 7,
  description: 'Scoate gunoiul',
  user_id: 1,
  status: 'pending',
  scheduled_date: '2026-06-17T08:30:00',
  recurrence_pattern: 'none',
  comment_count: 2,
} as any;

function seedUser() {
  const users = useUsersStore();
  users.items = [{ id: 1, name: 'Ana', color: '#abc' }] as any;
}

beforeEach(() => {
  confirmMock.mockReset();
  errorToastMock.mockReset();
});

describe('TaskCard.vue', () => {
  it('renders description, user name and a date label', async () => {
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    seedUser();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.task-title').text()).toBe('Scoate gunoiul');
    expect(wrapper.find('.task-user').text()).toContain('Ana');
    expect(wrapper.find('.task-date').text()).not.toBe('');
  });

  it('shows a comment-count badge', async () => {
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.comment-badge').text()).toBe('2');
  });

  it('emits edit and comments with the task', async () => {
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    await wrapper.find('.task-btn-edit').trigger('click');
    await wrapper.find('.task-btn-comment').trigger('click');
    expect(wrapper.emitted('edit')![0][0]).toMatchObject({ id: 7 });
    expect(wrapper.emitted('comments')![0][0]).toMatchObject({ id: 7 });
  });

  it('completing a task confirms then calls tasks.update', async () => {
    confirmMock.mockResolvedValue(true);
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    const tasks = useTasksStore();
    const update = vi.spyOn(tasks, 'update').mockResolvedValue({} as any);

    await wrapper.find('.task-btn-complete').trigger('click');
    await Promise.resolve(); // let the awaited confirm/update settle
    expect(confirmMock).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(7, { status: 'completed' });
  });

  it('does nothing when the confirm is declined', async () => {
    confirmMock.mockResolvedValue(false);
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    const tasks = useTasksStore();
    const update = vi.spyOn(tasks, 'update').mockResolvedValue({} as any);

    await wrapper.find('.task-btn-refuse').trigger('click');
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces a store error via the error toast', async () => {
    confirmMock.mockResolvedValue(true);
    const wrapper = mountWithPlugins(TaskCard, { props: { task: baseTask } });
    const tasks = useTasksStore();
    vi.spyOn(tasks, 'remove').mockRejectedValue(new Error('500 boom'));

    await wrapper.find('.task-btn-delete').trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(errorToastMock).toHaveBeenCalledWith('500 boom');
  });

  it('applies the completed class when status is completed', async () => {
    const wrapper = mountWithPlugins(TaskCard, {
      props: { task: { ...baseTask, status: 'completed' } },
    });
    expect(wrapper.find('.task-item').classes()).toContain('completed');
  });
});
