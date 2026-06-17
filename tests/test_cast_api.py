"""Route tests for /api/cast/* (src/main.py).

cast_service is the imported singleton on `main`; stubbing keeps pychromecast /
LAN discovery out of the tests. cast_play also reads radio stations from the DB,
so we create a throwaway station to drive it.
"""
import json
import uuid

import main
from task_manager.repository import RadioStationRepository


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


def _make_station(**overrides):
    """Insert a station directly and return its public dict (id == slug)."""
    db = main.get_db()
    try:
        data = {'name': f'Cast Test {uuid.uuid4().hex[:6]}', 'url': 'http://stream.example/aac'}
        data.update(overrides)
        return RadioStationRepository(db).create(data).to_dict()
    finally:
        db.close()


# ── /api/cast/devices ────────────────────────────────────────────────────────
def test_devices_starts_discovery_and_returns_list(client, monkeypatch):
    started = {'n': 0}
    monkeypatch.setattr(main.cast_service, 'start', lambda: started.__setitem__('n', started['n'] + 1))
    monkeypatch.setattr(main.cast_service, 'get_devices',
                        lambda: {'devices': [{'id': 'uuid-1', 'name': 'Living Speaker'}]})
    resp = client.get('/api/cast/devices')
    assert resp.status_code == 200
    assert resp.get_json()['devices'][0]['name'] == 'Living Speaker'
    assert started['n'] == 1  # discovery kicked off lazily


# ── /api/cast/play ───────────────────────────────────────────────────────────
def test_play_requires_device_and_station(client):
    assert _post(client, '/api/cast/play', {'device_id': 'd1'}).status_code == 400
    assert _post(client, '/api/cast/play', {'station_id': 's1'}).status_code == 400


def test_play_unknown_station_is_404(client, monkeypatch):
    monkeypatch.setattr(main.cast_service, 'play_url', lambda *a, **k: None)
    resp = _post(client, '/api/cast/play', {'device_id': 'd1', 'station_id': 'does-not-exist'})
    assert resp.status_code == 404


def test_play_direct_succeeds(client, monkeypatch):
    station = _make_station()
    calls = []

    def fake_play(device_id, url, content_type, title=None, tolerate_flap=False):
        calls.append((device_id, url, route_marker(url)))

    def route_marker(url):
        return 'proxy' if '/api/radio/proxy/' in url else 'direct'

    monkeypatch.setattr(main.cast_service, 'play_url', fake_play)
    resp = _post(client, '/api/cast/play', {'device_id': 'd1', 'station_id': station['id']})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['ok'] is True and body['route'] == 'direct'
    assert len(calls) == 1  # succeeded on first (direct) attempt


def test_play_falls_back_to_proxy(client, monkeypatch):
    station = _make_station()
    attempts = []

    def fake_play(device_id, url, content_type, title=None, tolerate_flap=False):
        is_proxy = '/api/radio/proxy/' in url
        attempts.append('proxy' if is_proxy else 'direct')
        if not is_proxy:
            raise Exception('receiver rejected direct stream')

    monkeypatch.setattr(main.cast_service, 'play_url', fake_play)
    resp = _post(client, '/api/cast/play', {'device_id': 'd1', 'station_id': station['id']})
    assert resp.status_code == 200
    assert resp.get_json()['route'] == 'proxy'
    assert attempts == ['direct', 'proxy']


def test_play_all_attempts_fail_is_502(client, monkeypatch):
    station = _make_station()

    def boom(*a, **k):
        raise Exception('unreachable')

    monkeypatch.setattr(main.cast_service, 'play_url', boom)
    resp = _post(client, '/api/cast/play', {'device_id': 'd1', 'station_id': station['id']})
    assert resp.status_code == 502
    assert 'error' in resp.get_json()


# ── /api/cast/stop ───────────────────────────────────────────────────────────
def test_stop_requires_device(client):
    assert _post(client, '/api/cast/stop', {}).status_code == 400


def test_stop_ok(client, monkeypatch):
    monkeypatch.setattr(main.cast_service, 'stop', lambda device_id: None)
    resp = _post(client, '/api/cast/stop', {'device_id': 'd1'})
    assert resp.status_code == 200
    assert resp.get_json()['ok'] is True


def test_stop_failure_is_502(client, monkeypatch):
    def boom(device_id):
        raise Exception('not connected')

    monkeypatch.setattr(main.cast_service, 'stop', boom)
    assert _post(client, '/api/cast/stop', {'device_id': 'd1'}).status_code == 502


# ── /api/cast/volume ─────────────────────────────────────────────────────────
def test_volume_requires_device_and_volume(client):
    assert _post(client, '/api/cast/volume', {'device_id': 'd1'}).status_code == 400
    assert _post(client, '/api/cast/volume', {'volume': 0.5}).status_code == 400


def test_volume_non_numeric_is_400(client):
    resp = _post(client, '/api/cast/volume', {'device_id': 'd1', 'volume': 'loud'})
    assert resp.status_code == 400


def test_volume_ok(client, monkeypatch):
    monkeypatch.setattr(main.cast_service, 'set_volume', lambda device_id, volume: volume)
    resp = _post(client, '/api/cast/volume', {'device_id': 'd1', 'volume': 0.3})
    assert resp.status_code == 200
    assert resp.get_json()['volume'] == 0.3


# ── /api/cast/status ─────────────────────────────────────────────────────────
def test_status_requires_device(client):
    assert client.get('/api/cast/status').status_code == 400


def test_status_ok(client, monkeypatch):
    monkeypatch.setattr(main.cast_service, 'status',
                        lambda device_id: {'playing': True, 'volume': 0.4})
    resp = client.get('/api/cast/status?device_id=d1')
    assert resp.status_code == 200
    assert resp.get_json()['playing'] is True
