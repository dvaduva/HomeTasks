"""Unit tests for the ``ai`` provider layer (Phase 1).

Covers the stateless ``OllamaProvider``, the app-level ``ConversationHistory``,
and the ``registry`` factory/fallback. The HTTP layer is faked by patching
``ai.ollama.requests``. Offline — no real server.
"""
import types

import pytest
import requests

import ai.ollama as ollama_mod
from ai.base import ChatProvider, normalize_reply
from ai.history import ConversationHistory
from ai.ollama import OllamaProvider
from ai import registry


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f'status {self.status_code}')


def _prefs(**overrides):
    """Minimal preferences stand-in with the AI-related attributes."""
    base = {
        'ai_provider': 'ollama',
        'ollama_base_url': 'http://localhost:11434',
        'ai_model': 'llama3:8b',
    }
    base.update(overrides)
    return types.SimpleNamespace(**base)


# --- base.normalize_reply -------------------------------------------------

def test_normalize_reply_full_shape():
    out = normalize_reply({'message': {'content': 'hi'}, 'model': 'm', 'done': True,
                           'created_at': 'now'})
    assert out == {'message': {'content': 'hi'}, 'model': 'm', 'done': True,
                   'created_at': 'now'}


def test_normalize_reply_tolerates_missing_keys():
    out = normalize_reply({}, default_model='fallback')
    assert out['message']['content'] == ''
    assert out['model'] == 'fallback'
    assert out['done'] is True
    assert out['created_at'] == ''


# --- OllamaProvider -------------------------------------------------------

def test_provider_satisfies_chatprovider_protocol():
    assert isinstance(OllamaProvider(), ChatProvider)


def test_provider_is_stateless_has_no_history():
    p = OllamaProvider()
    assert not hasattr(p, 'conversation_history')


def test_chat_posts_messages_verbatim_and_normalizes(monkeypatch):
    p = OllamaProvider(base_url='http://x:1', model='m')
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured['url'] = url
        captured['payload'] = json
        return FakeResponse({'message': {'content': 'salut'}, 'model': 'm', 'done': True})

    monkeypatch.setattr(ollama_mod.requests, 'post', fake_post)
    messages = [{'role': 'system', 'content': 'sys'}, {'role': 'user', 'content': 'buna'}]
    result = p.chat(messages, temperature=0.2, max_tokens=42)

    assert result == {'message': {'content': 'salut'}, 'model': 'm', 'done': True,
                      'created_at': ''}
    assert captured['url'] == 'http://x:1/api/chat'
    # Provider sends the messages it was given, untouched (no history of its own).
    assert captured['payload']['messages'] is messages
    assert captured['payload']['options'] == {'temperature': 0.2, 'max_tokens': 42}
    assert captured['payload']['stream'] is False


def test_chat_network_error_raises(monkeypatch):
    p = OllamaProvider()

    def boom(url, json=None, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'post', boom)
    with pytest.raises(Exception, match='Ollama API error'):
        p.chat([{'role': 'user', 'content': 'hi'}])


def test_get_models_normalizes_name_and_size(monkeypatch):
    p = OllamaProvider()
    monkeypatch.setattr(ollama_mod.requests, 'get',
                        lambda url, timeout=None: FakeResponse(
                            {'models': [{'name': 'llama3', 'size': 99}, {'name': 'phi'}]}))
    assert p.get_models() == [{'name': 'llama3', 'size': 99}, {'name': 'phi', 'size': 0}]


def test_get_models_network_error_raises(monkeypatch):
    p = OllamaProvider()

    def boom(url, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'get', boom)
    with pytest.raises(Exception, match='Ollama API error'):
        p.get_models()


def test_is_available_true(monkeypatch):
    p = OllamaProvider()
    monkeypatch.setattr(ollama_mod.requests, 'get',
                        lambda url, timeout=None: FakeResponse({}, status=200))
    assert p.is_available() is True


def test_is_available_false_on_exception(monkeypatch):
    p = OllamaProvider()

    def boom(url, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'get', boom)
    assert p.is_available() is False


# --- ConversationHistory --------------------------------------------------

def test_history_is_capped_to_max_length():
    h = ConversationHistory(max_length=10)
    for i in range(25):
        h.add('user', f'msg {i}')
    msgs = h.messages()
    assert len(msgs) == 10
    assert msgs[-1]['content'] == 'msg 24'
    assert msgs[0]['content'] == 'msg 15'


def test_history_messages_returns_a_copy():
    h = ConversationHistory()
    h.add('user', 'hi')
    snapshot = h.messages()
    snapshot.append({'role': 'user', 'content': 'mutation'})
    assert len(h.messages()) == 1


def test_history_clear():
    h = ConversationHistory()
    h.add('user', 'hi')
    h.clear()
    assert h.messages() == []


# --- registry -------------------------------------------------------------

def test_get_provider_returns_ollama_configured_from_prefs():
    p = registry.get_provider(_prefs(ollama_base_url='http://host:9', ai_model='custom'))
    assert isinstance(p, OllamaProvider)
    assert p.base_url == 'http://host:9'
    assert p.model == 'custom'


def test_get_provider_unknown_provider_falls_back_to_ollama():
    p = registry.get_provider(_prefs(ai_provider='does-not-exist'))
    assert isinstance(p, OllamaProvider)


def test_get_models_for_uses_dynamic_list(monkeypatch):
    monkeypatch.setattr(ollama_mod.requests, 'get',
                        lambda url, timeout=None: FakeResponse({'models': [{'name': 'llama3'}]}))
    models = registry.get_models_for('ollama', _prefs())
    assert models == [{'name': 'llama3', 'size': 0}]


def test_get_models_for_falls_back_to_static_on_error(monkeypatch):
    def boom(url, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'get', boom)
    models = registry.get_models_for('ollama', _prefs())
    assert models == registry.PROVIDERS['ollama']['static_models']


def test_get_models_for_unknown_provider_returns_empty():
    assert registry.get_models_for('nope', _prefs()) == []
