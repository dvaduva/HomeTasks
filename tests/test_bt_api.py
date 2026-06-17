"""Route tests for the /api/output/bt/* endpoints (src/main.py).

These exercise validation and JSON wiring with the BluetoothService methods
stubbed out, so no BlueZ/mpv is needed. Stubbing instance attributes on the
singleton overrides the bound methods for the duration of each test.
"""
import json

import main

MAC = 'AA:BB:CC:DD:EE:FF'


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


# ── /devices ─────────────────────────────────────────────────────────────────────
def test_bt_devices_shape(client, monkeypatch):
    monkeypatch.setattr(
        main.bluetooth_service, 'get_devices',
        lambda: {'devices': [{'id': MAC, 'name': 'JBL', 'connected': True, 'paired': True}],
                 'available': True, 'error': None},
    )
    resp = client.get('/api/output/bt/devices')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['available'] is True
    assert data['devices'][0]['id'] == MAC


def test_bt_devices_real_call_on_host_without_bluez(client):
    # No mocking: on a dev/CI host without bluetoothctl this returns available
    # False and an empty list rather than erroring (the frontend gate).
    resp = client.get('/api/output/bt/devices')
    assert resp.status_code == 200
    assert 'devices' in resp.get_json()


# ── /play ────────────────────────────────────────────────────────────────────────
def test_bt_play_requires_fields(client):
    assert _post(client, '/api/output/bt/play', {}).status_code == 400
    assert _post(client, '/api/output/bt/play', {'device_id': MAC}).status_code == 400


def test_bt_play_station_not_found(client, monkeypatch):
    monkeypatch.setattr(main, '_load_radio_stations', lambda: [])
    resp = _post(client, '/api/output/bt/play', {'device_id': MAC, 'station_id': 'nope'})
    assert resp.status_code == 404


def test_bt_play_uses_direct_url(client, monkeypatch):
    monkeypatch.setattr(
        main, '_load_radio_stations',
        lambda: [{'id': 's1', 'url': 'http://stream/s1', 'name': 'S1', 'proxy': True}],
    )
    captured = {}

    def fake_play(device_id, url, title=None, station_id=None):
        captured.update(device_id=device_id, url=url, title=title, station_id=station_id)
        return True

    monkeypatch.setattr(main.bluetooth_service, 'play', fake_play)
    resp = _post(client, '/api/output/bt/play', {'device_id': MAC, 'station_id': 's1'})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['ok'] is True
    assert body['url'] == 'http://stream/s1'
    # Even a proxy-flagged station is fed to mpv by its direct URL (no proxy).
    assert captured['url'] == 'http://stream/s1'
    assert captured['device_id'] == MAC
    assert captured['station_id'] == 's1'


def test_bt_play_service_error_is_502(client, monkeypatch):
    monkeypatch.setattr(
        main, '_load_radio_stations',
        lambda: [{'id': 's1', 'url': 'http://x', 'name': 'S1'}],
    )

    def boom(*a, **k):
        raise RuntimeError('no sink')

    monkeypatch.setattr(main.bluetooth_service, 'play', boom)
    resp = _post(client, '/api/output/bt/play', {'device_id': MAC, 'station_id': 's1'})
    assert resp.status_code == 502
    assert 'error' in resp.get_json()


# ── /stop /volume ────────────────────────────────────────────────────────────────
def test_bt_stop_requires_device(client):
    assert _post(client, '/api/output/bt/stop', {}).status_code == 400


def test_bt_stop_ok(client, monkeypatch):
    monkeypatch.setattr(main.bluetooth_service, 'stop', lambda device_id=None: True)
    resp = _post(client, '/api/output/bt/stop', {'device_id': MAC})
    assert resp.status_code == 200
    assert resp.get_json()['ok'] is True


def test_bt_volume_validation(client):
    assert _post(client, '/api/output/bt/volume', {'device_id': MAC}).status_code == 400
    bad = _post(client, '/api/output/bt/volume', {'device_id': MAC, 'volume': 'loud'})
    assert bad.status_code == 400


def test_bt_volume_ok(client, monkeypatch):
    monkeypatch.setattr(main.bluetooth_service, 'set_volume', lambda device_id, volume: volume)
    resp = _post(client, '/api/output/bt/volume', {'device_id': MAC, 'volume': 0.4})
    assert resp.status_code == 200
    assert resp.get_json()['volume'] == 0.4


# ── /status ──────────────────────────────────────────────────────────────────────
def test_bt_status_idle_has_no_title(client, monkeypatch):
    monkeypatch.setattr(
        main.bluetooth_service, 'status',
        lambda device_id=None: {'device_id': device_id, 'state': 'idle', 'station_id': None},
    )
    resp = client.get('/api/output/bt/status', query_string={'device_id': MAC})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['state'] == 'idle'
    assert data['title'] is None


# ── /scan /pair /remove ──────────────────────────────────────────────────────────
def test_bt_scan_ok(client, monkeypatch):
    monkeypatch.setattr(
        main.bluetooth_service, 'scan',
        lambda timeout: {'devices': [{'id': MAC, 'name': 'JBL', 'connected': False, 'paired': False}]},
    )
    resp = _post(client, '/api/output/bt/scan', {'timeout': 5})
    assert resp.status_code == 200
    assert resp.get_json()['devices'][0]['id'] == MAC


def test_bt_pair_requires_device(client):
    assert _post(client, '/api/output/bt/pair', {}).status_code == 400


def test_bt_pair_ok(client, monkeypatch):
    monkeypatch.setattr(
        main.bluetooth_service, 'pair',
        lambda device_id: {'id': device_id, 'paired': True, 'connected': True},
    )
    resp = _post(client, '/api/output/bt/pair', {'device_id': MAC})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['ok'] is True and body['paired'] is True


def test_bt_pair_failure_is_502(client, monkeypatch):
    def boom(device_id):
        raise RuntimeError('pairing failed')

    monkeypatch.setattr(main.bluetooth_service, 'pair', boom)
    resp = _post(client, '/api/output/bt/pair', {'device_id': MAC})
    assert resp.status_code == 502


def test_bt_remove_requires_device(client):
    assert _post(client, '/api/output/bt/remove', {}).status_code == 400


def test_bt_remove_ok(client, monkeypatch):
    monkeypatch.setattr(
        main.bluetooth_service, 'remove',
        lambda device_id: {'id': device_id, 'removed': True},
    )
    resp = _post(client, '/api/output/bt/remove', {'device_id': MAC})
    assert resp.status_code == 200
    assert resp.get_json()['removed'] is True
