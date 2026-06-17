import { beforeEach, describe, expect, it, vi } from 'vitest';

// Keep the polling fetch harmless — the widget calls weatherApi on mount.
vi.mock('@/api/weather', () => ({
  weatherApi: {
    current: vi.fn().mockResolvedValue({}),
    forecast: vi.fn().mockResolvedValue({ city: 'Cluj', daily: [], hourly: [] }),
  },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import WeatherWidget from './WeatherWidget.vue';
import { useWeatherStore } from '@/stores/weather';
import { weatherApi } from '@/api/weather';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WeatherWidget.vue', () => {
  it('renders a dash when no current weather is loaded', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.weather-temp').text()).toBe('—°');
    expect(wrapper.find('.weather-temp').classes()).toContain('dim');
  });

  it('renders rounded temperature, description and city', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    const store = useWeatherStore();
    store.current = { temperature: 21.6, description: 'cer senin', city: 'Cluj', icon: '01d' } as any;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.weather-temp').text()).toBe('22°'); // rounded
    expect(wrapper.find('.weather-desc').text()).toBe('cer senin');
    expect(wrapper.find('.weather-city').text()).toBe('Cluj');
    expect(wrapper.find('.wh-emoji').attributes('src')).toContain('01d');
  });

  it('opens the popup and fetches the forecast on click', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    await wrapper.find('.weather').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.weather-popup').exists()).toBe(true);
    expect(weatherApi.forecast).toHaveBeenCalled();
  });

  it('closes the popup with the close button', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    await wrapper.find('.weather').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('.weather-popup-close').trigger('click');
    expect(wrapper.find('.weather-popup').exists()).toBe(false);
  });
});
