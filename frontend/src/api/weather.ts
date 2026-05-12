import { api } from './client';

export interface WeatherCurrent {
  city: string;
  country: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
}

export interface WeatherDaily {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  humidity_avg: number;
  description: string;
  icon: string;
  icon_url: string;
  wind_speed_avg: number;
  pop_avg: number;
}

export interface WeatherHourly {
  datetime: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  description: string;
  icon: string;
  icon_url: string;
  wind_speed: number;
  wind_direction: number;
  pop: number;
}

export interface WeatherForecast {
  city: string;
  country: string;
  daily: WeatherDaily[];
  hourly: WeatherHourly[];
  timestamp: string;
}

export const weatherApi = {
  current: (city?: string) =>
    api.get<WeatherCurrent>('/api/weather/current', { query: city ? { city } : undefined }),
  forecast: (city?: string, days = 7) =>
    api.get<WeatherForecast>('/api/weather/forecast', { query: { city, days } }),
};
