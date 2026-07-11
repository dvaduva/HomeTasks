import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StandbyOverlay from './StandbyOverlay.vue';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import { flushPromises } from '@vue/test-utils';
import { useWeatherStore } from '@/stores/weather';

vi.mock('@/api/preferences', () => ({
  preferencesApi: { get: vi.fn(), update: vi.fn() },
}));

vi.mock('@/api/weather', () => ({
  weatherApi: {
    current: vi.fn(),
    forecast: vi.fn(),
  },
}));

import { preferencesApi } from '@/api/preferences';
import { weatherApi } from '@/api/weather';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  (preferencesApi.get as any).mockResolvedValue({ weather_city: 'București' });
  (weatherApi.current as any).mockResolvedValue({
    city: 'București',
    country: 'RO',
    temperature: 12.4,
    feels_like: 10,
    humidity: 60,
    description: 'cloudy',
    icon: '04d',
    wind_speed: 3,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StandbyOverlay', () => {
  it('renders the clock and emits wake on click', async () => {
    const wrapper = mountWithPlugins(StandbyOverlay);
    expect(wrapper.find('.standby-overlay').exists()).toBe(true);
    expect(wrapper.find('.standby-time').exists()).toBe(true);
    expect(wrapper.find('.standby-date').exists()).toBe(true);

    await wrapper.find('.standby-overlay').trigger('click');
    expect(wrapper.emitted('wake')).toHaveLength(1);
  });

  it('shows the current temperature when weather data is available', async () => {
    const wrapper = mountWithPlugins(StandbyOverlay);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(useWeatherStore().current?.temperature).toBe(12.4);
    expect(wrapper.find('.standby-weather-temp').text()).toBe('12°');
    expect(wrapper.find('.standby-weather-icon').exists()).toBe(true);
  });

  it('moves the clock to a new position over time', async () => {
    const wrapper = mountWithPlugins(StandbyOverlay);
    const clock = wrapper.find('.standby-clock');
    const initial = clock.attributes('style');
    await vi.advanceTimersByTimeAsync(45_000);
    await wrapper.vm.$nextTick();
    expect(clock.attributes('style')).not.toBe(initial);
  });
});
