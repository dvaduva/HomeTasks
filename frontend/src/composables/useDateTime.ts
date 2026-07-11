import { onMounted, onUnmounted, ref } from 'vue';

export function useNow(intervalMs = 1000) {
  const now = ref(new Date());
  let timer: number | null = null;

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = new Date();
    }, intervalMs);
  });
  onUnmounted(() => {
    if (timer !== null) clearInterval(timer);
  });

  return now;
}

export function formatHeaderDateTime(date: Date, locale: 'ro' | 'en'): string {
  const loc = locale === 'ro' ? 'ro-RO' : 'en-US';
  const dateStr = date.toLocaleDateString(loc, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString(loc);
  return `${dateStr}, ${timeStr}`;
}

export function formatDate(d: Date | string, format: 'short' | 'long' | 'full' = 'short', locale = 'ro-RO'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  switch (format) {
    case 'full':
      return date.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    case 'long':
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    case 'short':
    default:
      return date.toLocaleDateString(locale);
  }
}

export function formatTime(d: Date | string, format: '24' | '12' = '24', locale = 'ro-RO'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12',
  });
}

export function toLocalInputValue(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
