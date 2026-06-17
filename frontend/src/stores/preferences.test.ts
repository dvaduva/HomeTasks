import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/preferences', () => ({
  preferencesApi: { get: vi.fn(), update: vi.fn() },
}));

// setLocale has i18n side effects we don't care about here — just observe calls.
const setLocale = vi.fn();
vi.mock('@/i18n', () => ({ setLocale: (l: string) => setLocale(l) }));

import { preferencesApi } from '@/api/preferences';
import { usePreferencesStore } from './preferences';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('preferences store', () => {
  it('fetch loads data and applies the language locale', async () => {
    (preferencesApi.get as any).mockResolvedValue({ language: 'en' });
    const store = usePreferencesStore();
    await store.fetch();
    expect(store.data).toEqual({ language: 'en' });
    expect(setLocale).toHaveBeenCalledWith('en');
    expect(store.loading).toBe(false);
  });

  it('fetch does not call setLocale for an unsupported language', async () => {
    (preferencesApi.get as any).mockResolvedValue({ language: 'fr' });
    const store = usePreferencesStore();
    await store.fetch();
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('fetch records the error and rethrows', async () => {
    (preferencesApi.get as any).mockRejectedValue(new Error('offline'));
    const store = usePreferencesStore();
    await expect(store.fetch()).rejects.toThrow('offline');
    expect(store.error).toBe('offline');
  });

  it('update stores the result and switches locale when language changes', async () => {
    (preferencesApi.update as any).mockResolvedValue({ language: 'ro' });
    const store = usePreferencesStore();
    const out = await store.update({ language: 'ro' });
    expect(out).toEqual({ language: 'ro' });
    expect(store.data).toEqual({ language: 'ro' });
    expect(setLocale).toHaveBeenCalledWith('ro');
  });

  it('update without a language patch leaves the locale untouched', async () => {
    (preferencesApi.update as any).mockResolvedValue({ weather_city: 'Cluj' });
    const store = usePreferencesStore();
    await store.update({ weather_city: 'Cluj' });
    expect(setLocale).not.toHaveBeenCalled();
  });
});
