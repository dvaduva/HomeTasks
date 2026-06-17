import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/weather', () => ({
  weatherApi: { current: vi.fn(), forecast: vi.fn() },
}));

import { weatherApi } from '@/api/weather';
import { useWeatherStore } from './weather';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('weather store', () => {
  it('fetchCurrent stores the payload and toggles loading', async () => {
    (weatherApi.current as any).mockResolvedValue({ city: 'Cluj', temperature: 18 });
    const store = useWeatherStore();
    const p = store.fetchCurrent('Cluj');
    expect(store.loading).toBe(true);
    await p;
    expect(store.loading).toBe(false);
    expect(store.current).toEqual({ city: 'Cluj', temperature: 18 });
    expect(store.error).toBeNull();
  });

  it('fetchCurrent records the error without throwing', async () => {
    (weatherApi.current as any).mockRejectedValue(new Error('no key'));
    const store = useWeatherStore();
    await store.fetchCurrent(); // must not reject
    expect(store.error).toBe('no key');
    expect(store.current).toBeNull();
  });

  it('fetchForecast forwards city and days', async () => {
    (weatherApi.forecast as any).mockResolvedValue({ city: 'X', daily: [] });
    const store = useWeatherStore();
    await store.fetchForecast('X', 3);
    expect(weatherApi.forecast).toHaveBeenCalledWith('X', 3);
    expect(store.forecast).toEqual({ city: 'X', daily: [] });
  });

  it('fetchForecast captures errors', async () => {
    (weatherApi.forecast as any).mockRejectedValue(new Error('boom'));
    const store = useWeatherStore();
    await store.fetchForecast();
    expect(store.error).toBe('boom');
  });
});
