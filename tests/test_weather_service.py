"""Unit tests for WeatherService (src/weather/service.py).

The OpenWeather HTTP layer is faked by patching `weather.service.requests`, so
these tests exercise the transform/cache/fallback logic without a network.
"""
from datetime import datetime, timedelta

import pytest
import requests

import weather.service as weather_mod
from weather.service import WeatherService


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f'status {self.status_code}')


def _service():
    return WeatherService(api_key='test-key')


CURRENT_PAYLOAD = {
    'name': 'București', 'sys': {'country': 'RO', 'sunrise': 1_700_000_000, 'sunset': 1_700_040_000},
    'main': {'temp': 20.6, 'feels_like': 19.4, 'humidity': 55, 'pressure': 1012},
    'weather': [{'description': 'cer senin', 'icon': '01d'}],
    'wind': {'speed': 3.1, 'deg': 200},
}


def test_requires_api_key(monkeypatch):
    # With no explicit key and no env fallback, construction must fail loudly.
    monkeypatch.delenv('WEATHER_API_KEY', raising=False)
    with pytest.raises(ValueError):
        WeatherService(api_key=None)


def test_get_current_weather_transforms_and_rounds(monkeypatch):
    svc = _service()
    monkeypatch.setattr(weather_mod.requests, 'get', lambda url, params=None: FakeResponse(CURRENT_PAYLOAD))
    data = svc.get_current_weather('București')
    assert data['city'] == 'București'
    assert data['country'] == 'RO'
    assert data['temperature'] == 21  # round(20.6)
    assert data['feels_like'] == 19   # round(19.4)
    assert data['humidity'] == 55
    assert data['wind_direction'] == 200


def test_get_current_weather_uses_cache_on_second_call(monkeypatch):
    svc = _service()
    calls = {'n': 0}

    def fake_get(url, params=None):
        calls['n'] += 1
        return FakeResponse(CURRENT_PAYLOAD)

    monkeypatch.setattr(weather_mod.requests, 'get', fake_get)
    svc.get_current_weather('București')
    svc.get_current_weather('București')  # served from cache
    assert calls['n'] == 1


def test_get_current_weather_network_error_without_cache_raises(monkeypatch):
    svc = _service()

    def boom(url, params=None):
        raise requests.exceptions.ConnectionError('down')

    monkeypatch.setattr(weather_mod.requests, 'get', boom)
    with pytest.raises(Exception, match='Failed to fetch weather'):
        svc.get_current_weather('Nowhere')


def test_get_current_weather_falls_back_to_stale_cache(monkeypatch):
    svc = _service()
    # Seed an expired cache entry.
    stale = {'city': 'Cached', 'temperature': 5}
    svc.cache['current_weather_București_ro'] = (datetime.now() - timedelta(hours=2), stale)

    def boom(url, params=None):
        raise requests.exceptions.ConnectionError('down')

    monkeypatch.setattr(weather_mod.requests, 'get', boom)
    assert svc.get_current_weather('București') == stale


def test_get_forecast_groups_into_daily_and_hourly(monkeypatch):
    svc = _service()
    base = int(datetime(2026, 6, 17, 0, 0, 0).timestamp())
    # Two 3-hour slots on the same day → one daily summary.
    items = []
    for i, temp in enumerate((10, 20)):
        items.append({
            'dt': base + i * 3 * 3600,
            'main': {'temp': temp, 'feels_like': temp - 1, 'humidity': 50, 'pressure': 1000},
            'weather': [{'description': 'soare', 'icon': '01d'}],
            'wind': {'speed': 2.0, 'deg': 180}, 'pop': 0.2,
        })
    payload = {'city': {'name': 'București', 'country': 'RO'}, 'list': items}
    monkeypatch.setattr(weather_mod.requests, 'get', lambda url, params=None: FakeResponse(payload))

    data = svc.get_forecast('București', days=1)
    assert data['city'] == 'București'
    assert len(data['daily']) == 1
    day = data['daily'][0]
    assert day['temp_min'] == 10 and day['temp_max'] == 20
    assert day['temp_avg'] == 15
    assert len(data['hourly']) == 2


def test_get_forecast_returns_all_hourly_slots(monkeypatch):
    svc = _service()
    base = int(datetime(2026, 6, 17, 0, 0, 0).timestamp())
    items = []
    for i in range(10):
        items.append({
            'dt': base + i * 3 * 3600,
            'main': {'temp': 10 + i, 'feels_like': 9 + i, 'humidity': 50, 'pressure': 1000},
            'weather': [{'description': 'soare', 'icon': '01d'}],
            'wind': {'speed': 2.0, 'deg': 180}, 'pop': 0.2,
        })
    payload = {'city': {'name': 'București', 'country': 'RO'}, 'list': items}
    monkeypatch.setattr(weather_mod.requests, 'get', lambda url, params=None: FakeResponse(payload))

    data = svc.get_forecast('București', days=2)
    assert len(data['hourly']) == 10


def test_get_forecast_caps_days_at_seven(monkeypatch):
    svc = _service()
    captured = {}

    def fake_get(url, params=None):
        captured['cnt'] = params['cnt']
        return FakeResponse({'city': {'name': 'X', 'country': 'RO'}, 'list': []})

    monkeypatch.setattr(weather_mod.requests, 'get', fake_get)
    svc.get_forecast('X', days=30)
    assert captured['cnt'] == 7 * 8  # days clamped to 7, 8 slots/day


def test_icon_url():
    assert _service().get_weather_icon_url('04n') == 'http://openweathermap.org/img/wn/04n@2x.png'
