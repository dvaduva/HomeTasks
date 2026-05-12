import { createI18n } from 'vue-i18n';
import ro from './ro';
import en from './en';

export type Locale = 'ro' | 'en';

const STORAGE_KEY = 'hometasks.locale';

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ro' || stored === 'en') return stored;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'ro';
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'ro',
  messages: { ro, en },
  missingWarn: false,
  fallbackWarn: false,
});

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale;
}
