import { describe, expect, it } from 'vitest';
import { formatDate, formatTime, toDateInputValue, toLocalInputValue } from './useDateTime';

describe('formatDate', () => {
  it('returns "" for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('formats a valid date without throwing', () => {
    const out = formatDate('2026-06-17T10:00:00', 'long', 'en-US');
    expect(out).toContain('2026');
    expect(out).toMatch(/June/i);
  });
});

describe('formatTime', () => {
  it('returns "" for an invalid date', () => {
    expect(formatTime('nope')).toBe('');
  });

  it('formats hours and minutes', () => {
    const out = formatTime('2026-06-17T08:05:00', '24', 'en-GB');
    expect(out).toMatch(/08[:.]05/);
  });
});

describe('toLocalInputValue', () => {
  it('returns "" for null/undefined/invalid', () => {
    expect(toLocalInputValue(null)).toBe('');
    expect(toLocalInputValue(undefined)).toBe('');
    expect(toLocalInputValue('garbage')).toBe('');
  });

  it('produces a datetime-local string padded to minutes', () => {
    const out = toLocalInputValue(new Date(2026, 2, 4, 9, 7));
    expect(out).toBe('2026-03-04T09:07');
  });
});

describe('toDateInputValue', () => {
  it('produces a yyyy-mm-dd string', () => {
    const out = toDateInputValue(new Date(2026, 0, 9));
    expect(out).toBe('2026-01-09');
  });

  it('returns "" for falsy input', () => {
    expect(toDateInputValue(null)).toBe('');
  });
});
