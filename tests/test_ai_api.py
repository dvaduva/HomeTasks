"""Route tests for /api/ai/* (src/main.py).

Routes resolve their backend through the provider factory, so these tests
monkeypatch `main.get_provider` (and `main.get_models_for`) with a fake stateless
provider rather than a live Ollama server. A plain greeting ("salut") matches
none of the intent keyword groups, so no DB action path runs and the response
goes straight through the provider.
"""
import json

import pytest

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


class FakeProvider:
    """Stateless provider double mirroring the ChatProvider contract."""

    def __init__(self, *, available=True, reply='Bună!', model='llama3',
                 models=None, capture=None):
        self._available = available
        self._reply = reply
        self._model = model
        self.model = model
        self.base_url = 'http://localhost:11434'
        self._models = models if models is not None else [{'name': model, 'size': 0}]
        self._capture = capture

    def is_available(self):
        return self._available

    def chat(self, messages, *, temperature=0.7, max_tokens=500):
        if self._capture is not None:
            self._capture.update(messages=messages, temperature=temperature,
                                 max_tokens=max_tokens)
        return {'message': {'content': self._reply}, 'model': self._model, 'done': True}

    def get_models(self):
        return self._models


@pytest.fixture(autouse=True)
def _clear_history():
    # The shared conversation history is a module-level singleton; reset it so
    # tests don't leak turns into one another.
    main.conversation_history.clear()
    yield
    main.conversation_history.clear()


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(main, 'get_provider', lambda prefs: provider)
    return provider


# ── /api/ai/chat ─────────────────────────────────────────────────────────────
def test_chat_requires_message(client):
    assert _post(client, '/api/ai/chat', {}).status_code == 400
    assert _post(client, '/api/ai/chat', {'foo': 'bar'}).status_code == 400


def test_chat_provider_down_no_action_is_503(client, monkeypatch):
    _use_provider(monkeypatch, FakeProvider(available=False))
    resp = _post(client, '/api/ai/chat', {'message': 'salut'})
    assert resp.status_code == 503
    assert 'error' in resp.get_json()


def test_chat_ok(client, monkeypatch):
    _use_provider(monkeypatch, FakeProvider(reply='Bună!', model='llama3'))
    resp = _post(client, '/api/ai/chat', {'message': 'salut'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['response'] == 'Bună!'
    assert data['model'] == 'llama3'
    assert data['done'] is True


def test_chat_builds_messages_with_system_and_history(client, monkeypatch):
    captured = {}
    _use_provider(monkeypatch, FakeProvider(capture=captured))
    resp = _post(client, '/api/ai/chat', {'message': 'salut'})
    assert resp.status_code == 200
    messages = captured['messages']
    assert messages[0]['role'] == 'system'
    assert messages[-1] == {'role': 'user', 'content': 'salut'}


def test_chat_uses_client_history_for_context(client, monkeypatch):
    captured = {}
    _use_provider(monkeypatch, FakeProvider(capture=captured))
    body = {
        'message': 'și mâine?',
        'history': [
            {'role': 'user', 'text': 'ce vreme e azi?'},
            {'role': 'ai', 'text': 'E însorit.'},  # UI role gets mapped to assistant
        ],
    }
    resp = _post(client, '/api/ai/chat', body)
    assert resp.status_code == 200
    messages = captured['messages']
    assert messages[0]['role'] == 'system'
    assert messages[1] == {'role': 'user', 'content': 'ce vreme e azi?'}
    assert messages[2] == {'role': 'assistant', 'content': 'E însorit.'}
    assert messages[-1] == {'role': 'user', 'content': 'și mâine?'}
    # Client-driven turns must not also accumulate in the shared singleton.
    assert main.conversation_history.messages() == []


def test_chat_history_is_capped_at_five_turns(client, monkeypatch):
    captured = {}
    _use_provider(monkeypatch, FakeProvider(capture=captured))
    history = [{'role': 'user', 'text': f'm{i}'} for i in range(8)]
    resp = _post(client, '/api/ai/chat', {'message': 'acum', 'history': history})
    assert resp.status_code == 200
    # system + 5 history turns + current message
    contents = [m['content'] for m in captured['messages']]
    assert contents[1:] == ['m3', 'm4', 'm5', 'm6', 'm7', 'acum']


def test_chat_passes_explicit_temperature_and_max_tokens(client, monkeypatch):
    captured = {}
    _use_provider(monkeypatch, FakeProvider(capture=captured))
    resp = _post(client, '/api/ai/chat',
                 {'message': 'salut', 'temperature': 0.1, 'max_tokens': 42})
    assert resp.status_code == 200
    assert captured['temperature'] == 0.1
    assert captured['max_tokens'] == 42


# ── /api/ai/models ───────────────────────────────────────────────────────────
def test_models_ok(client, monkeypatch):
    monkeypatch.setattr(main, 'get_models_for',
                        lambda pid, prefs: [{'name': 'llama3', 'size': 123}, {'name': 'phi'}])
    resp = client.get('/api/ai/models')
    assert resp.status_code == 200
    models = resp.get_json()['models']
    assert models[0] == {'name': 'llama3', 'size': 123}
    assert models[1] == {'name': 'phi', 'size': 0}  # default size when missing


def test_models_accepts_provider_query(client, monkeypatch):
    captured = {}

    def fake_models_for(provider_id, prefs):
        captured['provider_id'] = provider_id
        return [{'name': 'mixtral', 'size': 0}]

    monkeypatch.setattr(main, 'get_models_for', fake_models_for)
    resp = client.get('/api/ai/models?provider=groq')
    assert resp.status_code == 200
    body = resp.get_json()
    assert captured['provider_id'] == 'groq'
    assert body['provider'] == 'groq'
    assert body['models'] == [{'name': 'mixtral', 'size': 0}]


# ── /api/ai/status ───────────────────────────────────────────────────────────
def test_status_running(client, monkeypatch):
    _use_provider(monkeypatch, FakeProvider(available=True, models=[{'name': 'llama3'}]))
    resp = client.get('/api/ai/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['server_running'] is True
    assert data['active_provider'] == 'ollama'
    assert data['available_models'] == ['llama3']


def test_status_not_running(client, monkeypatch):
    _use_provider(monkeypatch, FakeProvider(available=False))
    resp = client.get('/api/ai/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['server_running'] is False
    assert 'available_models' not in data
