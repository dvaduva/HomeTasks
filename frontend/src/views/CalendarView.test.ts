import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: vi.fn() }),
}));
vi.mock('@/api/users', () => ({ usersApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/api/calendar', () => ({ calendarApi: { month: vi.fn(), year: vi.fn() } }));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import CalendarView from './CalendarView.vue';
import { calendarApi } from '@/api/calendar';
import { usersApi } from '@/api/users';

// The month grid is built from the RETURNED data.year/month (not the cursor), so
// a fixed June-2026 payload makes the grid deterministic regardless of the clock.
const MONTH_PAYLOAD = {
  year: 2026,
  month: 6,
  users: [{ id: 1, name: 'Ana', color: '#f00' }],
  days: {
    '2026-06-10': [
      { task_id: 1, description: 'Task A', user_id: 1, user_name: 'Ana', user_color: '#f00', status: 'pending', scheduled_date: '2026-06-10T09:00:00', recurrence_pattern: null, is_recurring_instance: false },
      { task_id: 2, description: 'Task B', user_id: 1, user_name: 'Ana', user_color: '#f00', status: 'completed', scheduled_date: '2026-06-10T11:00:00', recurrence_pattern: null, is_recurring_instance: false },
    ],
  },
};

const YEAR_PAYLOAD = {
  year: 2026,
  users: [{ id: 1, name: 'Ana', color: '#f00' }],
  days: { '2026-06-10': { total: 2, users: [{ user_id: 1, user_color: '#f00', user_name: 'Ana', count: 2 }] } },
};

beforeEach(() => {
  vi.clearAllMocks();
  (calendarApi.month as any).mockResolvedValue(MONTH_PAYLOAD);
  (calendarApi.year as any).mockResolvedValue(YEAR_PAYLOAD);
});

async function flush() {
  await flushPromises();
  await flushPromises();
}

describe('CalendarView.vue', () => {
  it('loads the month and renders the day grid', async () => {
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    expect(calendarApi.month).toHaveBeenCalled();
    // A month grid is 35 or 42 cells.
    expect(wrapper.findAll('.cal-day').length).toBeGreaterThanOrEqual(28);
  });

  it('renders task pills and a day count for a populated day', async () => {
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    const pills = wrapper.findAll('.cal-task-pill');
    expect(pills.length).toBe(2);
    expect(pills[0].text()).toContain('Task A');
    expect(wrapper.find('.cal-day-count').text()).toBe('2');
  });

  it('switches to the year view and renders 12 mini-months', async () => {
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    // Second view-switch button is "An" (year).
    await wrapper.findAll('.cal-view-btn')[1].trigger('click');
    await flush();
    expect(calendarApi.year).toHaveBeenCalled();
    expect(wrapper.findAll('.cal-mini-month')).toHaveLength(12);
  });

  it('reloads when navigating to the next period', async () => {
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    (calendarApi.month as any).mockClear();
    await wrapper.findAll('.cal-nav-btn')[1].trigger('click'); // next
    await flush();
    expect(calendarApi.month).toHaveBeenCalled();
  });

  it('renders a user filter chip per user plus "Toți"', async () => {
    (usersApi.list as any).mockResolvedValue([
      { id: 1, name: 'Ana', color: '#f00' },
      { id: 2, name: 'Bob', color: '#0f0' },
    ]);
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    const chips = wrapper.findAll('.cal-filter-chip');
    expect(chips).toHaveLength(3); // Toți + Ana + Bob
  });

  it('opens the day modal with tasks grouped by user', async () => {
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    // Click the day cell that holds the seeded tasks.
    const dayWithTasks = wrapper.findAll('.cal-day').find((d) => d.find('.cal-task-pill').exists());
    await dayWithTasks!.trigger('click');
    await flush();
    expect(wrapper.find('.cal-modal').exists()).toBe(true);
    expect(wrapper.findAll('.cal-modal-task')).toHaveLength(2);
    expect(wrapper.find('.cal-modal-user-head').text()).toContain('Ana');
  });

  it('shows an error state when loading fails', async () => {
    (calendarApi.month as any).mockRejectedValue(new Error('500'));
    const wrapper = mountWithPlugins(CalendarView);
    await flush();
    expect(wrapper.find('.cal-empty').text()).toContain('Eroare');
  });
});
