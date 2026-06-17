"""Route tests for /api/weather/* (src/main.py).

weather_service is the imported singleton on `main`; stubbing its methods keeps
the OpenWeather HTTP calls out of the tests.
"""
from datetime import datetime

import main


def test_current_weather_ok(client, monkeypatch):
    monkeypatch.setattr(main.weather_service, 'get_current_weather', lambda city, lang='ro': {
        'city': 'Bucuresti', 'country': 'RO', 'temperature': 21, 'feels_like': 20,
        'humidity': 55, 'description': 'cer senin', 'icon': '01d', 'wind_speed': 3.2,
    })
    resp = client.get('/api/weather/current?city=Bucuresti')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['city'] == 'Bucuresti'
    assert data['temperature'] == 21
    # The route projects an explicit subset of fields.
    assert set(data) == {
        'city', 'country', 'temperature', 'feels_like',
        'humidity', 'description', 'icon', 'wind_speed',
    }


def test_current_weather_uses_preferences_city_when_absent(client, monkeypatch):
    captured = {}

    def fake(city, lang='ro'):
        captured['city'] = city
        captured['lang'] = lang
        return {'city': city, 'country': 'RO', 'temperature': 10, 'feels_like': 9,
                'humidity': 50, 'description': '', 'icon': '01d', 'wind_speed': 1}

    monkeypatch.setattr(main.weather_service, 'get_current_weather', fake)
    resp = client.get('/api/weather/current')  # no ?city
    assert resp.status_code == 200
    # Falls back to preferences (or default) — never None.
    assert captured['city']


def test_current_weather_service_error_is_500(client, monkeypatch):
    def boom(city, lang='ro'):
        raise Exception('upstream down')

    monkeypatch.setattr(main.weather_service, 'get_current_weather', boom)
    resp = client.get('/api/weather/current?city=X')
    assert resp.status_code == 500
    assert 'error' in resp.get_json()


def test_forecast_days_out_of_range_is_400(client):
    assert client.get('/api/weather/forecast?days=0').status_code == 400
    assert client.get('/api/weather/forecast?days=8').status_code == 400


def test_forecast_ok(client, monkeypatch):
    now = datetime(2026, 6, 17, 12, 0, 0)
    monkeypatch.setattr(main.weather_service, 'get_forecast', lambda city, days, lang='ro': {
        'city': 'Bucuresti', 'country': 'RO',
        'daily': [{
            'date': now, 'temp_min': 12, 'temp_max': 24, 'temp_avg': 18,
            'humidity_avg': 50, 'description': 'soare', 'icon': '01d',
            'wind_speed_avg': 2.0, 'pop_avg': 0.1,
        }],
        'hourly': [{
            'datetime': now, 'temperature': 20, 'feels_like': 19, 'humidity': 48,
            'pressure': 1012, 'description': 'soare', 'icon': '01d',
            'wind_speed': 2.0, 'wind_direction': 180, 'pop': 0.1,
        }],
        'timestamp': now,
    })
    monkeypatch.setattr(main.weather_service, 'get_weather_icon_url', lambda icon: f'http://icons/{icon}.png')

    resp = client.get('/api/weather/forecast?city=Bucuresti&days=3')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['city'] == 'Bucuresti'
    assert len(data['daily']) == 1 and len(data['hourly']) == 1
    assert data['daily'][0]['icon_url'] == 'http://icons/01d.png'
    assert data['daily'][0]['date'] == now.isoformat()


def test_forecast_service_error_is_500(client, monkeypatch):
    def boom(city, days, lang='ro'):
        raise Exception('boom')

    monkeypatch.setattr(main.weather_service, 'get_forecast', boom)
    resp = client.get('/api/weather/forecast?days=3')
    assert resp.status_code == 500
