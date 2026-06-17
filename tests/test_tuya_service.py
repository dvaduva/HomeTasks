"""Unit tests for TuyaService (src/tuya/service.py).

get_temperatures reads a JSON cache file — we point json_path at a temp file.
refresh_from_cloud talks to the tinytuya SDK, which we replace with a fake.
"""
import json
import sys
import types

from tuya.service import TuyaService


def _service(tmp_path):
    svc = TuyaService()
    svc.json_path = str(tmp_path / 'tuya_devices.json')
    return svc


def test_get_temperatures_missing_file(tmp_path):
    svc = _service(tmp_path)
    out = svc.get_temperatures()
    assert out['devices'] == []
    assert 'error' in out


def test_get_temperatures_parses_and_scales(tmp_path):
    svc = _service(tmp_path)
    payload = {
        'generated_at': '2026-06-17T10:00:00Z',
        'devices': [{
            'id': 'dev1', 'name': 'Living', 'online': True,
            'status': {'result': [
                {'code': 'temp_current', 'value': 225},  # tenths of a degree
                {'code': 'temp_set', 'value': 210},
            ]},
        }],
    }
    with open(svc.json_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f)

    out = svc.get_temperatures()
    dev = out['devices'][0]
    assert dev['temp_current'] == 22.5  # 225 / 10
    assert dev['temp_set'] == 21.0
    assert out['generated_at'] == '2026-06-17T10:00:00Z'


def test_get_temperatures_missing_codes_yield_none(tmp_path):
    svc = _service(tmp_path)
    with open(svc.json_path, 'w', encoding='utf-8') as f:
        json.dump({'devices': [{'id': 'd', 'name': 'N', 'status': {'result': []}}]}, f)
    dev = svc.get_temperatures()['devices'][0]
    assert dev['temp_current'] is None and dev['temp_set'] is None


def test_get_temperatures_invalid_json(tmp_path):
    svc = _service(tmp_path)
    with open(svc.json_path, 'w', encoding='utf-8') as f:
        f.write('{ not valid json')
    out = svc.get_temperatures()
    assert out['devices'] == [] and 'error' in out


def test_refresh_requires_credentials(tmp_path, monkeypatch):
    svc = _service(tmp_path)
    svc.access_id = None
    svc.access_secret = None
    # Provide a stub tinytuya so the ImportError branch isn't hit first.
    monkeypatch.setitem(sys.modules, 'tinytuya', types.SimpleNamespace(Cloud=object))
    out = svc.refresh_from_cloud()
    assert 'error' in out and 'TUYA_ACCESS_ID' in out['error']


def test_refresh_cloud_connection_error(tmp_path, monkeypatch):
    svc = _service(tmp_path)
    svc.access_id, svc.access_secret = 'id', 'secret'

    class FakeCloud:
        def __init__(self, **kwargs):
            self.error = 'bad credentials'

    monkeypatch.setitem(sys.modules, 'tinytuya', types.SimpleNamespace(Cloud=FakeCloud))
    out = svc.refresh_from_cloud()
    assert 'error' in out and 'bad credentials' in out['error']


def test_refresh_success_writes_file(tmp_path, monkeypatch):
    svc = _service(tmp_path)
    svc.access_id, svc.access_secret = 'id', 'secret'

    class FakeCloud:
        error = None

        def __init__(self, **kwargs):
            pass

        def getdevices(self, verbose=True):
            return {'result': [{'id': 'd1', 'name': 'Living'}]}

        def getstatus(self, device_id):
            return {'result': [{'code': 'temp_current', 'value': 230}]}

    monkeypatch.setitem(sys.modules, 'tinytuya', types.SimpleNamespace(Cloud=FakeCloud))
    monkeypatch.setattr('tuya.service.time.sleep', lambda s: None)  # don't actually wait

    out = svc.refresh_from_cloud()
    assert out == {'success': True, 'device_count': 1}
    # File was written and is parseable.
    with open(svc.json_path, encoding='utf-8') as f:
        saved = json.load(f)
    assert saved['devices'][0]['id'] == 'd1'


def test_refresh_empty_device_list(tmp_path, monkeypatch):
    svc = _service(tmp_path)
    svc.access_id, svc.access_secret = 'id', 'secret'

    class FakeCloud:
        error = None

        def __init__(self, **kwargs):
            pass

        def getdevices(self, verbose=True):
            return {'result': [], 'msg': 'no devices bound'}

    monkeypatch.setitem(sys.modules, 'tinytuya', types.SimpleNamespace(Cloud=FakeCloud))
    out = svc.refresh_from_cloud()
    assert out['error'] == 'no devices bound'
