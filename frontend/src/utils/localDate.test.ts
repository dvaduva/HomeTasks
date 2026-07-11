import { describe, expect, it } from 'vitest';
import { dateKey, isTodayDate, todayKey, weekdayIndexLocal } from './localDate';

describe('localDate', () => {
  it('derives weekday from YYYY-MM-DD without UTC shift', () => {
    // 2026-07-11 = Saturday, 2026-07-12 = Sunday
    expect(weekdayIndexLocal('2026-07-11')).toBe(6);
    expect(weekdayIndexLocal('2026-07-12')).toBe(0);
    expect(weekdayIndexLocal('2026-07-13')).toBe(1);
  });

  it('accepts ISO datetimes via dateKey prefix', () => {
    expect(dateKey('2026-07-12T15:00:00')).toBe('2026-07-12');
    expect(weekdayIndexLocal('2026-07-12T15:00:00')).toBe(0);
  });

  it('detects today from calendar date', () => {
    const key = todayKey();
    expect(isTodayDate(key)).toBe(true);
    expect(isTodayDate(`${key}T18:00:00`)).toBe(true);
  });
});
