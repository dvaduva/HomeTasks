"""Route tests for /api/ai/* (src/main.py).

ollama_client is the imported singleton on `main`. By stubbing is_server_running
and chat/get_models we exercise the routes without a running Ollama server.
A plain greeting message ("salut") matches none of the intent keyword groups,
so no DB action path runs and the response goes straight through Ollama.
"""
import json

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


# ── /api/ai/chat ─────────────────────────────────────────────────────────────
def test_chat_requires_message(client):
    assert _post(client, '/api/ai/chat', {}).status_code == 400
    assert _post(client, '/api/ai/chat', {'foo': 'bar'}).status_code == 400


def test_chat_ollama_down_no_action_is_503(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: False)
    resp = _post(client, '/api/ai/chat', {'message': 'salut'})
    assert resp.status_code == 503
    assert 'error' in resp.get_json()


def test_chat_ok(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: True)

    def fake_chat(message, temperature=None, max_tokens=None, system_context=None):
        return {'message': {'content': 'Bună!'}, 'model': 'llama3', 'done': True}

    monkeypatch.setattr(main.ollama_client, 'chat', fake_chat)
    resp = _post(client, '/api/ai/chat', {'message': 'salut'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['response'] == 'Bună!'
    assert data['model'] == 'llama3'
    assert data['done'] is True


def test_chat_passes_explicit_temperature_and_max_tokens(client, monkeypatch):
    captured = {}
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: True)

    def fake_chat(message, temperature=None, max_tokens=None, system_context=None):
        captured.update(temperature=temperature, max_tokens=max_tokens)
        return {'message': {'content': 'ok'}, 'model': 'm', 'done': True}

    monkeypatch.setattr(main.ollama_client, 'chat', fake_chat)
    resp = _post(client, '/api/ai/chat',
                 {'message': 'salut', 'temperature': 0.1, 'max_tokens': 42})
    assert resp.status_code == 200
    assert captured == {'temperature': 0.1, 'max_tokens': 42}


# ── /api/ai/models ───────────────────────────────────────────────────────────
def test_models_ollama_down_is_503(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: False)
    assert client.get('/api/ai/models').status_code == 503


def test_models_ok(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: True)
    monkeypatch.setattr(main.ollama_client, 'get_models',
                        lambda: [{'name': 'llama3', 'size': 123}, {'name': 'phi'}])
    resp = client.get('/api/ai/models')
    assert resp.status_code == 200
    models = resp.get_json()['models']
    assert models[0] == {'name': 'llama3', 'size': 123}
    assert models[1] == {'name': 'phi', 'size': 0}  # default size when missing


# ── /api/ai/status ───────────────────────────────────────────────────────────
def test_status_running(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: True)
    monkeypatch.setattr(main.ollama_client, 'get_models', lambda: [{'name': 'llama3'}])
    resp = client.get('/api/ai/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['server_running'] is True
    assert data['available_models'] == ['llama3']


def test_status_not_running(client, monkeypatch):
    monkeypatch.setattr(main.ollama_client, 'is_server_running', lambda: False)
    resp = client.get('/api/ai/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['server_running'] is False
    assert 'available_models' not in data
