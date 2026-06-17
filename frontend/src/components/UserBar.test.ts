import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import UserBar from './UserBar.vue';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function seed() {
  const users = useUsersStore();
  users.items = [
    { id: 1, name: 'Ana', color: '#f00' },
    { id: 2, name: 'Bob', color: '#0f0' },
  ] as any;
  const tasks = useTasksStore();
  tasks.all = [
    { id: 10, user_id: 1 },
    { id: 11, user_id: 1 },
    { id: 12, user_id: 2 },
  ] as any;
  return { users, tasks };
}

describe('UserBar.vue', () => {
  it('renders one button per user plus the "all" button', () => {
    const wrapper = mountWithPlugins(UserBar);
    seed();
    return wrapper.vm.$nextTick().then(() => {
      const labels = wrapper.findAll('.user-item').map((b) => b.text());
      expect(labels[0]).toContain('Toți'); // all_users (ro)
      expect(labels.some((l) => l.includes('Ana'))).toBe(true);
      expect(labels.some((l) => l.includes('Bob'))).toBe(true);
    });
  });

  it('marks "all" active when no user is selected', async () => {
    const wrapper = mountWithPlugins(UserBar);
    seed();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.user-item')[0].classes()).toContain('active');
  });

  it('shows a task count badge per user', async () => {
    const wrapper = mountWithPlugins(UserBar);
    seed();
    await wrapper.vm.$nextTick();
    const counts = wrapper.findAll('.user-task-count').map((c) => c.text());
    expect(counts).toContain('2'); // Ana has two tasks
    expect(counts).toContain('1'); // Bob has one
  });

  it('clicking a user selects it (multi-select default)', async () => {
    const wrapper = mountWithPlugins(UserBar);
    const { users } = seed();
    await wrapper.vm.$nextTick();
    // Index 1 is the first real user (0 is "all").
    await wrapper.findAll('.user-item')[1].trigger('click');
    expect(users.activeIds).toEqual([1]);
  });

  it('single-select replaces the selection instead of accumulating', async () => {
    const wrapper = mountWithPlugins(UserBar, { props: { singleSelect: true } });
    const { users } = seed();
    users.setActiveIds([1]);
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.user-item')[2].trigger('click'); // click Bob
    expect(users.activeIds).toEqual([2]);
  });

  it('emits add-task when the + button is clicked', async () => {
    const wrapper = mountWithPlugins(UserBar);
    seed();
    await wrapper.vm.$nextTick();
    await wrapper.find('.btn-add-task').trigger('click');
    expect(wrapper.emitted('add-task')).toHaveLength(1);
  });
});
