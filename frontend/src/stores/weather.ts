import { defineStore } from 'pinia';
import { ref } from 'vue';
import { weatherApi, type WeatherCurrent, type WeatherForecast } from '@/api/weather';

export const useWeatherStore = defineStore('weather', () => {
  const current = ref<WeatherCurrent | null>(null);
  const forecast = ref<WeatherForecast | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchCurrent(city?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      current.value = await weatherApi.current(city);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchForecast(city?: string, days = 7): Promise<void> {
    try {
      forecast.value = await weatherApi.forecast(city, days);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { current, forecast, loading, error, fetchCurrent, fetchForecast };
});
