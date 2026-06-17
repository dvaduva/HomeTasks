"""Route tests for /api/transport/* (src/main.py).

/routes reads the bundled data/autobus/*.json files. /chat builds a context
from those files and forwards to Ollama, so we stub ollama_client.
"""
import json

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


def test_routes_returns_list(client):
    resp = client.get('/api/transport/routes')
    assert resp.status_code == 200
    routes = resp.get_json()
    assert isinstance(routes, list)
    # Bundled GTFS-like files each carry a route/direction.
    if routes:
        assert 'route' in routes[0]


def test_chat_ollama_down_degrades_gracefully(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: False)
    resp = _post(client, '/api/transport/chat',
                 {'message': 'cand vine autobuzul?', 'dayType': 'Lucru'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['done'] is True
    assert 'AI' in data['response'] or 'indisponibil' in data['response'].lower() \
        or 'disponibil' in data['response'].lower()


def test_chat_ok(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: True)

    captured = {}

    def fake_chat(message, temperature=None, max_tokens=None, system_context=None):
        captured['system_context'] = system_context
        return {'message': {'content': 'Urmatorul la 08:15.'}, 'done': True}

    monkeypatch.setattr(main.ollama_client, 'chat', fake_chat)
    resp = _post(client, '/api/transport/chat',
                 {'message': 'cand vine?', 'route': '101', 'station': 'Centru',
                  'dayType': 'Lucru', 'currentTime': '08:00'})
    assert resp.status_code == 200
    assert resp.get_json()['response'] == 'Urmatorul la 08:15.'
    # The transport context should be passed to the model.
    assert 'transportul public' in captured['system_context']
