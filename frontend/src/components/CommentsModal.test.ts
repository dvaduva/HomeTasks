import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/tasks', () => ({
  tasksApi: { listComments: vi.fn(), addComment: vi.fn() },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import CommentsModal from './CommentsModal.vue';
import { tasksApi } from '@/api/tasks';
import { useUsersStore } from '@/stores/users';

const task = { id: 5, user_id: 1, description: 'x' } as any;

function seedUsers() {
  const users = useUsersStore();
  users.items = [{ id: 1, name: 'Ana', color: '#f00' }] as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  (tasksApi.listComments as any).mockResolvedValue([]);
});

describe('CommentsModal.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: false, task } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('loads and renders existing comments when opened', async () => {
    (tasksApi.listComments as any).mockResolvedValue([
      { id: 11, user_id: 1, text: 'primul', created_at: null },
    ]);
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: true, task } });
    seedUsers();
    await flush();
    expect(tasksApi.listComments).toHaveBeenCalledWith(5);
    expect(wrapper.find('.comment-text').text()).toBe('primul');
    expect(wrapper.find('.comment-author').text()).toBe('Ana');
  });

  it('shows the empty state when there are no comments', async () => {
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: true, task } });
    await flush();
    expect(wrapper.find('.comments-empty').exists()).toBe(true);
  });

  it('disables send while the textarea is empty', async () => {
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: true, task } });
    seedUsers();
    await flush();
    const btn = wrapper.find('button[type="submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('sends a comment, appends it and emits added', async () => {
    (tasksApi.addComment as any).mockResolvedValue({ id: 99, user_id: 1, text: 'nou' });
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: true, task } });
    seedUsers();
    await flush();

    await wrapper.find('textarea').setValue('nou');
    await wrapper.find('form').trigger('submit');
    await flush();

    expect(tasksApi.addComment).toHaveBeenCalledWith(5, { text: 'nou', user_id: 1 });
    expect(wrapper.find('.comment-text').text()).toBe('nou');
    expect(wrapper.emitted('added')![0]).toEqual([5]);
  });

  it('emits close from the header button', async () => {
    const wrapper = mountWithPlugins(CommentsModal, { props: { open: true, task } });
    await flush();
    await wrapper.find('.modal-head .icon-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

// The watch is immediate + async; flush a couple microtasks for it to settle.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
