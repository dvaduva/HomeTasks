/** Calendar date key YYYY-MM-DD from an API date or datetime string. */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Local calendar weekday (0=Sun … 6=Sat) from an API date/datetime string. */
export function weekdayIndexLocal(iso: string): number {
  const [y, m, d] = dateKey(iso).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getDay();
}

export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isTodayDate(iso: string): boolean {
  return dateKey(iso) === todayKey();
}
