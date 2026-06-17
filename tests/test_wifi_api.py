"""Route tests for the /api/wifi/* endpoints (src/main.py).

WiFiService methods are stubbed out, so no NetworkManager is needed. Stubbing
instance attributes on the singleton overrides the bound methods per test.
"""
import json

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


# ── /status ──────────────────────────────────────────────────────────────────────
def test_wifi_status_shape(client, monkeypatch):
    monkeypatch.setattr(
        main.wifi_service, 'status',
        lambda: {'available': True, 'connected': True, 'ssid': 'HomeNet', 'ip': '192.168.0.5'},
    )
    resp = client.get('/api/wifi/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['available'] is True and data['ssid'] == 'HomeNet'


def test_wifi_status_real_call_on_host_without_nmcli(client):
    # No mocking: on a dev/CI host without nmcli this returns available False
    # rather than erroring (the frontend gate).
    resp = client.get('/api/wifi/status')
    assert resp.status_code == 200
    assert resp.get_json()['available'] is False


# ── /scan ────────────────────────────────────────────────────────────────────────
def test_wifi_scan_ok(client, monkeypatch):
    monkeypatch.setattr(
        main.wifi_service, 'scan',
        lambda: {'networks': [{'ssid': 'HomeNet', 'signal': 72, 'security': 'WPA2', 'in_use': True}],
                 'available': True, 'error': None},
    )
    resp = _post(client, '/api/wifi/scan', {})
    assert resp.status_code == 200
    assert resp.get_json()['networks'][0]['ssid'] == 'HomeNet'


# ── /connect ─────────────────────────────────────────────────────────────────────
def test_wifi_connect_requires_ssid(client):
    assert _post(client, '/api/wifi/connect', {}).status_code == 400


def test_wifi_connect_ok(client, monkeypatch):
    captured = {}

    def fake_connect(ssid, password=None, hidden=False):
        captured.update(ssid=ssid, password=password, hidden=hidden)
        return {'ssid': ssid, 'connected': True}

    monkeypatch.setattr(main.wifi_service, 'connect', fake_connect)
    resp = _post(client, '/api/wifi/connect', {'ssid': 'HomeNet', 'password': 'secret'})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['ok'] is True and body['connected'] is True
    assert captured == {'ssid': 'HomeNet', 'password': 'secret', 'hidden': False}


def test_wifi_connect_failure_is_502(client, monkeypatch):
    def boom(ssid, password=None, hidden=False):
        raise RuntimeError('connection failed')

    monkeypatch.setattr(main.wifi_service, 'connect', boom)
    resp = _post(client, '/api/wifi/connect', {'ssid': 'HomeNet', 'password': 'bad'})
    assert resp.status_code == 502
    assert 'error' in resp.get_json()


# ── /disconnect ──────────────────────────────────────────────────────────────────
def test_wifi_disconnect_ok(client, monkeypatch):
    monkeypatch.setattr(main.wifi_service, 'disconnect', lambda: {'connected': False})
    resp = _post(client, '/api/wifi/disconnect', {})
    assert resp.status_code == 200
    assert resp.get_json()['ok'] is True
