import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { todayKey, weekdayIndexLocal } from '@/utils/localDate';

// Keep the polling fetch harmless — the widget calls weatherApi on mount.
vi.mock('@/api/weather', () => ({
  weatherApi: {
    current: vi.fn().mockResolvedValue({}),
    forecast: vi.fn().mockResolvedValue({ city: 'Cluj', daily: [], hourly: [] }),
  },
}));

import { mountWithPlugins, makeI18n } from '@/test/mountWithPlugins';
import WeatherWidget from './WeatherWidget.vue';
import { useWeatherStore } from '@/stores/weather';
import { weatherApi } from '@/api/weather';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WeatherWidget.vue', () => {
  it('day_names_short i18n returns all weekday names as an array', () => {
    const i18n = makeI18n();
    const names = i18n.global.tm('day_names_short') as string[];
    expect(names).toHaveLength(7);
    expect(names[0]).toBe('Dum');
  });

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

  it('restores the saved popup position from localStorage', async () => {
    localStorage.setItem('weather-popup-pos', JSON.stringify({ left: 100, top: 120, width: 400 }));
    const wrapper = mountWithPlugins(WeatherWidget);
    await wrapper.find('.weather').trigger('click');
    await wrapper.vm.$nextTick();
    const popup = wrapper.find('.weather-popup').element as HTMLElement;
    expect(popup.style.left).toBe('100px');
    expect(popup.style.top).toBe('120px');
    expect(popup.style.width).toBe('400px');
  });

  it('shows weekday names from calendar dates (not UTC-shifted)', async () => {
    const addDays = (key: string, offset: number): string => {
      const [y, m, d] = key.split('-').map(Number);
      const dt = new Date(y, m - 1, d + offset);
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    const base = todayKey();
    const day = (offset: number) => ({
      date: addDays(base, offset),
      temp_min: 17,
      temp_max: 29,
      temp_avg: 23,
      humidity_avg: 50,
      description: 'sun',
      icon: '01d',
      icon_url: '',
      wind_speed_avg: 2,
      pop_avg: 0,
    });

    const wrapper = mountWithPlugins(WeatherWidget);
    const store = useWeatherStore();
    store.forecast = {
      city: 'Cluj',
      country: 'RO',
      daily: [0, 1, 2, 3, 4].map(day),
      hourly: [],
      timestamp: `${base}T10:00:00`,
    };

    await wrapper.find('.weather').trigger('click');
    await flushPromises();
    expect(weatherApi.forecast).not.toHaveBeenCalled();

    const roShort = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
    const names = wrapper.findAll('.forecast-day-name').map((n) => n.text());
    expect(names).toHaveLength(5);
    expect(names[0]).toBe('Azi');
    expect(names[1]).toBe(roShort[weekdayIndexLocal(addDays(base, 1))]);
    expect(names[2]).toBe(roShort[weekdayIndexLocal(addDays(base, 2))]);
    expect(names[3]).toBe(roShort[weekdayIndexLocal(addDays(base, 3))]);
    expect(names[4]).toBe(roShort[weekdayIndexLocal(addDays(base, 4))]);
  });

  it('shows hourly data for the selected forecast day', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    const store = useWeatherStore();
    store.forecast = {
      city: 'Cluj',
      country: 'RO',
      daily: [
        { date: '2026-07-11', temp_min: 17, temp_max: 29, temp_avg: 23, humidity_avg: 50, description: 'sun', icon: '01d', icon_url: '', wind_speed_avg: 2, pop_avg: 0 },
        { date: '2026-07-12', temp_min: 18, temp_max: 28, temp_avg: 22, humidity_avg: 50, description: 'clouds', icon: '03d', icon_url: '', wind_speed_avg: 2, pop_avg: 0.2 },
      ],
      hourly: [
        { datetime: '2026-07-11T12:00:00', temperature: 27, feels_like: 26, humidity: 40, pressure: 1010, description: 'sun', icon: '01d', icon_url: '/a.png', wind_speed: 2, wind_direction: 0, pop: 0 },
        { datetime: '2026-07-11T15:00:00', temperature: 29, feels_like: 28, humidity: 40, pressure: 1010, description: 'sun', icon: '01d', icon_url: '/a.png', wind_speed: 2, wind_direction: 0, pop: 0 },
        { datetime: '2026-07-12T09:00:00', temperature: 22, feels_like: 21, humidity: 40, pressure: 1010, description: 'clouds', icon: '03d', icon_url: '/b.png', wind_speed: 2, wind_direction: 0, pop: 0.1 },
        { datetime: '2026-07-12T12:00:00', temperature: 25, feels_like: 24, humidity: 40, pressure: 1010, description: 'clouds', icon: '03d', icon_url: '/b.png', wind_speed: 2, wind_direction: 0, pop: 0.1 },
      ],
      timestamp: '2026-07-11T10:00:00',
    };

    await wrapper.find('.weather').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.weather-hour-item')).toHaveLength(8);
    expect(wrapper.find('.wh-temp').text()).toBe('27°');

    const dayButtons = wrapper.findAll('.forecast-day');
    await dayButtons[1].trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.weather-hour-item')).toHaveLength(8);
    // First populated slot for the second day is 09:00.
    expect(wrapper.find('.wh-temp').text()).toBe('22°');
  });

  it('persists the popup position after dragging the header', async () => {
    const wrapper = mountWithPlugins(WeatherWidget);
    await wrapper.find('.weather').trigger('click');
    await wrapper.vm.$nextTick();
    const popup = wrapper.find('.weather-popup').element as HTMLElement;
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue({
      left: 80,
      top: 90,
      width: 520,
      height: 400,
      right: 600,
      bottom: 490,
      x: 80,
      y: 90,
      toJSON: () => ({}),
    } as DOMRect);

    const head = wrapper.find('.weather-popup-head').element;
    head.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 110, bubbles: true, pointerId: 1 }));
    head.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 150, bubbles: true, pointerId: 1 }));
    head.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 150, bubbles: true, pointerId: 1 }));

    const saved = JSON.parse(localStorage.getItem('weather-popup-pos')!);
    expect(saved.left).toBe(80);
    expect(saved.top).toBe(90);
    expect(saved.width).toBe(520);
  });
});
