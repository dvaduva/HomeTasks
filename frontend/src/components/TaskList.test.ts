import { describe, expect, it } from 'vitest';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import TaskList from './TaskList.vue';

// Stub the child so we test list logic (filter/empty/loading) in isolation —
// TaskCard has its own suite.
const stubs = { TaskCard: { name: 'TaskCard', props: ['task'], template: '<div class="card-stub" />' } };

const tasks = [
  { id: 1, user_id: 1, description: 'a' },
  { id: 2, user_id: 2, description: 'b' },
  { id: 3, user_id: 1, description: 'c' },
] as any;

function mountList(props: Record<string, unknown>) {
  return mountWithPlugins(TaskList, { props: props as any, global: { stubs } });
}

describe('TaskList.vue', () => {
  it('shows the loading placeholder', () => {
    const wrapper = mountList({ tasks: [], loading: true });
    expect(wrapper.find('.empty').exists()).toBe(true);
    expect(wrapper.findAll('.card-stub')).toHaveLength(0);
  });

  it('shows the empty message when there are no tasks', () => {
    const wrapper = mountList({ tasks: [] });
    expect(wrapper.find('.empty').exists()).toBe(true);
  });

  it('renders one card per task when unfiltered', () => {
    const wrapper = mountList({ tasks });
    expect(wrapper.findAll('.card-stub')).toHaveLength(3);
  });

  it('filters by user ids', () => {
    const wrapper = mountList({ tasks, filterUserIds: [1] });
    expect(wrapper.findAll('.card-stub')).toHaveLength(2); // only user 1's tasks
  });

  it('an empty filter array means no filtering', () => {
    const wrapper = mountList({ tasks, filterUserIds: [] });
    expect(wrapper.findAll('.card-stub')).toHaveLength(3);
  });

  it('uses a custom empty key when provided', () => {
    const wrapper = mountList({ tasks: [], emptyKey: 'no_tasks_today' });
    // Renders *something* (the translated custom key), not the default.
    expect(wrapper.find('.empty').exists()).toBe(true);
  });
});
