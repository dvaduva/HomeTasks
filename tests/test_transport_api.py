"""Route tests for /api/transport/* (src/main.py).

/routes reads the bundled data/autobus/*.json files. /chat builds a context
from those files and forwards to the active AI provider, so we stub the provider
factory (`main.get_provider`) with a stateless double.
"""
import json

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


class FakeProvider:
    """Stateless provider double mirroring the ChatProvider contract."""

    def __init__(self, *, available=True, reply='ok', capture=None):
        self._available = available
        self._reply = reply
        self.model = 'llama3'
        self.base_url = 'http://localhost:11434'
        self._capture = capture

    def is_available(self):
        return self._available

    def chat(self, messages, *, temperature=0.7, max_tokens=500):
        if self._capture is not None:
            self._capture.update(messages=messages, temperature=temperature,
                                 max_tokens=max_tokens)
        return {'message': {'content': self._reply}, 'model': self.model, 'done': True}

    def get_models(self):
        return [{'name': self.model, 'size': 0}]


def test_routes_returns_list(client):
    resp = client.get('/api/transport/routes')
    assert resp.status_code == 200
    routes = resp.get_json()
    assert isinstance(routes, list)
    # Bundled GTFS-like files each carry a route/direction.
    if routes:
        assert 'route' in routes[0]


def test_chat_provider_down_degrades_gracefully(client, monkeypatch):
    monkeypatch.setattr(main, 'get_provider', lambda prefs: FakeProvider(available=False))
    resp = _post(client, '/api/transport/chat',
                 {'message': 'cand vine autobuzul?', 'dayType': 'Lucru'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['done'] is True
    assert 'AI' in data['response'] or 'indisponibil' in data['response'].lower() \
        or 'disponibil' in data['response'].lower()


def test_chat_ok(client, monkeypatch):
    captured = {}
    monkeypatch.setattr(main, 'get_provider',
                        lambda prefs: FakeProvider(reply='Urmatorul la 08:15.', capture=captured))
    resp = _post(client, '/api/transport/chat',
                 {'message': 'cand vine?', 'route': '101', 'station': 'Centru',
                  'dayType': 'Lucru', 'currentTime': '08:00'})
    assert resp.status_code == 200
    assert resp.get_json()['response'] == 'Urmatorul la 08:15.'
    # Transport context is carried in the system message; temperature stays 0.3.
    system_msg = captured['messages'][0]
    assert system_msg['role'] == 'system'
    assert 'transportul public' in system_msg['content']
    assert captured['temperature'] == 0.3
