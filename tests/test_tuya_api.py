"""Route tests for /api/tuya/* (src/main.py).

tuya_service is the imported singleton on `main`; stubbing keeps the Tuya Cloud
SDK out of the tests.
"""
import json

import main


def test_temperatures_ok(client, monkeypatch):
    monkeypatch.setattr(main.tuya_service, 'get_temperatures',
                        lambda: {'devices': [{'id': 'd1', 'name': 'Living', 'temperature': 22.5}]})
    resp = client.get('/api/tuya/temperatures')
    assert resp.status_code == 200
    assert resp.get_json()['devices'][0]['temperature'] == 22.5


def test_temperatures_error_is_500(client, monkeypatch):
    def boom():
        raise Exception('cannot read cache')

    monkeypatch.setattr(main.tuya_service, 'get_temperatures', boom)
    resp = client.get('/api/tuya/temperatures')
    assert resp.status_code == 500
    assert 'error' in resp.get_json()


def test_refresh_ok(client, monkeypatch):
    monkeypatch.setattr(main.tuya_service, 'refresh_from_cloud',
                        lambda: {'updated': 3, 'devices': []})
    resp = client.post('/api/tuya/refresh', data=json.dumps({}), content_type='application/json')
    assert resp.status_code == 200
    assert resp.get_json()['updated'] == 3


def test_refresh_service_error_payload_is_502(client, monkeypatch):
    # The service signals a soft failure by returning {'error': ...}.
    monkeypatch.setattr(main.tuya_service, 'refresh_from_cloud',
                        lambda: {'error': 'invalid credentials'})
    resp = client.post('/api/tuya/refresh', data=json.dumps({}), content_type='application/json')
    assert resp.status_code == 502
    assert resp.get_json()['error'] == 'invalid credentials'


def test_refresh_exception_is_500(client, monkeypatch):
    def boom():
        raise RuntimeError('network down')

    monkeypatch.setattr(main.tuya_service, 'refresh_from_cloud', boom)
    resp = client.post('/api/tuya/refresh', data=json.dumps({}), content_type='application/json')
    assert resp.status_code == 500
