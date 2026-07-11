import requests
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import json

class WeatherService:
    def __init__(self, api_key: str = None):
        """
        Initialize the weather service.
        
        Args:
            api_key: OpenWeatherMap API key. If not provided, will try to get from environment.
        """
        self.api_key = api_key or os.getenv('WEATHER_API_KEY')
        self.base_url = "http://api.openweathermap.org/data/2.5"
        self.cache = {}
        self.cache_duration = timedelta(minutes=30)  # Cache for 30 minutes
        
        if not self.api_key:
            raise ValueError("Weather API key is required. Set WEATHER_API_KEY environment variable.")
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid."""
        if cache_key not in self.cache:
            return False
        
        cached_time, _ = self.cache[cache_key]
        return datetime.now() - cached_time < self.cache_duration
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict]:
        """Get data from cache if valid."""
        if self._is_cache_valid(cache_key):
            _, data = self.cache[cache_key]
            return data
        return None
    
    def _save_to_cache(self, cache_key: str, data: Dict):
        """Save data to cache with timestamp."""
        self.cache[cache_key] = (datetime.now(), data)
    
    def get_current_weather(self, city: str = None, lang: str = 'ro') -> Dict:
        """
        Get current weather for a city.

        Args:
            city: City name. If not provided, uses default from preferences.
            lang: Language code for descriptions (e.g., 'ro', 'en').

        Returns:
            Dictionary with weather information.
        """
        if not city:
            # Try to get default city from preferences (we'll implement this later)
            city = "București"  # Default fallback

        cache_key = f"current_weather_{city}_{lang}"
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data

        params = {
            'q': city,
            'appid': self.api_key,
            'units': 'metric',  # Use metric for Celsius
            'lang': lang
        }
        
        try:
            response = requests.get(f"{self.base_url}/weather", params=params)
            response.raise_for_status()
            data = response.json()
            
            # Transform the data to a simpler format
            weather_data = {
                'city': data['name'],
                'country': data['sys']['country'],
                'temperature': round(data['main']['temp']),
                'feels_like': round(data['main']['feels_like']),
                'humidity': data['main']['humidity'],
                'pressure': data['main']['pressure'],
                'description': data['weather'][0]['description'],
                'icon': data['weather'][0]['icon'],
                'wind_speed': data['wind']['speed'],
                'wind_direction': data['wind'].get('deg', 0),
                'sunrise': datetime.fromtimestamp(data['sys']['sunrise']),
                'sunset': datetime.fromtimestamp(data['sys']['sunset']),
                'timestamp': datetime.now()
            }
            
            self._save_to_cache(cache_key, weather_data)
            return weather_data
            
        except requests.exceptions.RequestException as e:
            # Return cached data if available, even if expired, as fallback
            if cache_key in self.cache:
                _, cached_data = self.cache[cache_key]
                return cached_data
            raise Exception(f"Failed to fetch weather data: {str(e)}")
    
    def get_forecast(self, city: str = None, days: int = 7, lang: str = 'ro') -> Dict:
        """
        Get weather forecast for a city.

        Args:
            city: City name. If not provided, uses default from preferences.
            days: Number of days for forecast (max 7 for free API).
            lang: Language code for descriptions (e.g., 'ro', 'en').

        Returns:
            Dictionary with forecast information.
        """
        if not city:
            city = "București"  # Default fallback

        # Limit days to 7 for free API
        days = min(days, 7)

        cache_key = f"forecast_{city}_{days}_{lang}"
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data

        params = {
            'q': city,
            'appid': self.api_key,
            'units': 'metric',
            'cnt': days * 8,  # 8 forecasts per day (3-hour intervals)
            'lang': lang
        }
        
        try:
            response = requests.get(f"{self.base_url}/forecast", params=params)
            response.raise_for_status()
            data = response.json()
            
            # Process the forecast data
            forecast_list = []
            for item in data['list']:
                forecast_item = {
                    'datetime': datetime.fromtimestamp(item['dt']),
                    'temperature': round(item['main']['temp']),
                    'feels_like': round(item['main']['feels_like']),
                    'humidity': item['main']['humidity'],
                    'pressure': item['main']['pressure'],
                    'description': item['weather'][0]['description'],
                    'icon': item['weather'][0]['icon'],
                    'wind_speed': item['wind']['speed'],
                    'wind_direction': item['wind'].get('deg', 0),
                    'pop': item.get('pop', 0)  # Probability of precipitation
                }
                forecast_list.append(forecast_item)
            
            # Group by date for daily summaries
            daily_forecast = {}
            for item in forecast_list:
                date_key = item['datetime'].date()
                if date_key not in daily_forecast:
                    daily_forecast[date_key] = {
                        'date': date_key,
                        'temps': [],
                        'humidity': [],
                        'descriptions': [],
                        'icons': [],
                        'wind_speed': [],
                        'pop': []
                    }
                
                daily_forecast[date_key]['temps'].append(item['temperature'])
                daily_forecast[date_key]['humidity'].append(item['humidity'])
                daily_forecast[date_key]['descriptions'].append(item['description'])
                daily_forecast[date_key]['icons'].append(item['icon'])
                daily_forecast[date_key]['wind_speed'].append(item['wind_speed'])
                daily_forecast[date_key]['pop'].append(item['pop'])
            
            # Create daily summary
            daily_summary = []
            for date_key, day_data in sorted(daily_forecast.items()):
                # Get most common description
                desc_counts = {}
                for desc in day_data['descriptions']:
                    desc_counts[desc] = desc_counts.get(desc, 0) + 1
                most_common_desc = max(desc_counts, key=desc_counts.get) if desc_counts else ""

                # Get most common icon
                icon_counts = {}
                for icon in day_data['icons']:
                    icon_counts[icon] = icon_counts.get(icon, 0) + 1
                most_common_icon = max(icon_counts, key=icon_counts.get) if icon_counts else ""

                daily_summary.append({
                    'date': date_key,
                    'temp_min': min(day_data['temps']),
                    'temp_max': max(day_data['temps']),
                    'temp_avg': round(sum(day_data['temps']) / len(day_data['temps'])),
                    'humidity_avg': round(sum(day_data['humidity']) / len(day_data['humidity'])),
                    'description': most_common_desc,
                    'icon': most_common_icon,
                    'wind_speed_avg': round(sum(day_data['wind_speed']) / len(day_data['wind_speed'])),
                    'pop_avg': round(sum(day_data['pop']) / len(day_data['pop']))
                })
            
            forecast_data = {
                'city': data['city']['name'],
                'country': data['city']['country'],
                'daily': daily_summary,
                'hourly': forecast_list,
                'timestamp': datetime.now()
            }
            
            self._save_to_cache(cache_key, forecast_data)
            return forecast_data
            
        except requests.exceptions.RequestException as e:
            # Return cached data if available, even if expired, as fallback
            if cache_key in self.cache:
                _, cached_data = self.cache[cache_key]
                return cached_data
            raise Exception(f"Failed to fetch forecast data: {str(e)}")
    
    def get_weather_icon_url(self, icon_code: str) -> str:
        """
        Get URL for weather icon.
        
        Args:
            icon_code: Icon code from OpenWeatherMap API.
            
        Returns:
            Full URL to the weather icon.
        """
        return f"http://openweathermap.org/img/wn/{icon_code}@2x.png"