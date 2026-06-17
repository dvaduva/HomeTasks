import { beforeEach, describe, expect, it, vi } from 'vitest';

const errorToast = vi.fn();
const success = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: errorToast, success }),
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import TaskModal from './TaskModal.vue';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';

function seedUsers() {
  const users = useUsersStore();
  users.items = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bob' }] as any;
  return users;
}

const editTask = {
  id: 9,
  description: 'Edit me',
  user_id: 2,
  scheduled_date: '2026-06-17T08:00:00',
  recurrence_pattern: 'none',
  recurrence_end_date: null,
} as any;

beforeEach(() => {
  errorToast.mockReset();
  success.mockReset();
});

describe('TaskModal.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: false } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('shows the add title and a user checkbox per user', async () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: true } });
    seedUsers();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.modal-head h2').text()).toContain('Adaugă task'); // modal_add_task_title (ro)
    expect(wrapper.findAll('.user-checkbox-item')).toHaveLength(2);
  });

  it('prefills the description in edit mode', async () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: true, task: editTask } });
    seedUsers();
    await wrapper.vm.$nextTick();
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('Edit me');
  });

  it('rejects an empty description with an error toast', async () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: true } });
    seedUsers();
    const tasks = useTasksStore();
    const create = vi.spyOn(tasks, 'create');
    await wrapper.vm.$nextTick();
    await wrapper.find('input[type="text"]').setValue('   ');
    await wrapper.find('.btn-primary').trigger('click');
    expect(errorToast).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates one task per selected user and emits saved + close', async () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: true } });
    const users = seedUsers();
    users.setActiveIds([1, 2]); // both pre-selected
    const tasks = useTasksStore();
    const create = vi.spyOn(tasks, 'create').mockImplementation(async (d: any) => ({ id: 1, ...d }));
    // Re-open so the watch repopulates selectedUserIds from the new activeIds.
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    await wrapper.find('input[type="text"]').setValue('Cumpără lapte');

    await wrapper.find('.btn-primary').trigger('click');
    await flush();

    expect(create).toHaveBeenCalledTimes(2); // one per selected user
    expect(wrapper.emitted('saved')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('updates in edit mode', async () => {
    const wrapper = mountWithPlugins(TaskModal, { props: { open: true, task: editTask } });
    seedUsers();
    const tasks = useTasksStore();
    const update = vi.spyOn(tasks, 'update').mockResolvedValue({ id: 9 } as any);
    await wrapper.vm.$nextTick();

    await wrapper.find('.btn-primary').trigger('click');
    await flush();

    expect(update).toHaveBeenCalledWith(9, expect.objectContaining({ description: 'Edit me' }));
    expect(success).toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeTruthy();
  });
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
