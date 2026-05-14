import { api } from './client';

export interface CalendarTask {
  task_id: number;
  description: string;
  user_id: number;
  user_name: string | null;
  user_color: string | null;
  status: string | null;
  scheduled_date: string;
  recurrence_pattern: string | null;
  is_recurring_instance: boolean;
}

export interface CalendarUser {
  id: number;
  name: string;
  color: string;
}

export interface CalendarMonth {
  year: number;
  month: number;
  users: CalendarUser[];
  days: Record<string, CalendarTask[]>;
}

export interface CalendarYearDayUser {
  user_id: number;
  user_color: string;
  user_name: string;
  count: number;
}

export interface CalendarYearDay {
  total: number;
  users: CalendarYearDayUser[];
}

export interface CalendarYear {
  year: number;
  users: CalendarUser[];
  days: Record<string, CalendarYearDay>;
}

function userIdsParam(userIds?: number[]): string | undefined {
  return userIds && userIds.length ? userIds.join(',') : undefined;
}

export const calendarApi = {
  month: (year: number, month: number, userIds?: number[]) =>
    api.get<CalendarMonth>('/api/calendar/month', {
      query: { year, month, user_ids: userIdsParam(userIds) },
    }),
  year: (year: number, userIds?: number[]) =>
    api.get<CalendarYear>('/api/calendar/year', {
      query: { year, user_ids: userIdsParam(userIds) },
    }),
};
