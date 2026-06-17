"""Unit tests for OllamaClient (src/ollama/client.py).

The HTTP layer is faked by patching `ollama.client.requests`.
"""
import pytest
import requests

import ollama.client as ollama_mod
from ollama.client import OllamaClient


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f'status {self.status_code}')


def test_history_is_capped_to_max_length():
    c = OllamaClient()
    for i in range(25):
        c._add_to_history('user', f'msg {i}')
    assert len(c.conversation_history) == c.max_history_length
    # Oldest dropped; newest kept.
    assert c.conversation_history[-1]['content'] == 'msg 24'


def test_clear_history():
    c = OllamaClient()
    c._add_to_history('user', 'hi')
    c._clear_history()
    assert c.conversation_history == []


def test_chat_builds_messages_and_records_history(monkeypatch):
    c = OllamaClient()
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured['url'] = url
        captured['messages'] = json['messages']
        return FakeResponse({'message': {'content': 'salut'}, 'done': True})

    monkeypatch.setattr(ollama_mod.requests, 'post', fake_post)
    result = c.chat('buna', system_context='vremea e însorită')
    assert result['message']['content'] == 'salut'
    assert captured['url'].endswith('/api/chat')
    # First message is the system prompt and includes the action context.
    assert captured['messages'][0]['role'] == 'system'
    assert 'vremea e însorită' in captured['messages'][0]['content']
    # User + assistant turns are recorded.
    roles = [m['role'] for m in c.conversation_history]
    assert roles == ['user', 'assistant']


def test_chat_network_error_raises(monkeypatch):
    c = OllamaClient()

    def boom(url, json=None, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'post', boom)
    with pytest.raises(Exception, match='Ollama API error'):
        c.chat('hi')


def test_generate_posts_to_generate_endpoint(monkeypatch):
    c = OllamaClient()
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured['url'] = url
        captured['payload'] = json
        return FakeResponse({'response': 'text'})

    monkeypatch.setattr(ollama_mod.requests, 'post', fake_post)
    out = c.generate('prompt', temperature=0.2, max_tokens=10)
    assert out['response'] == 'text'
    assert captured['url'].endswith('/api/generate')
    assert captured['payload']['options']['temperature'] == 0.2


def test_get_models_returns_models_list(monkeypatch):
    c = OllamaClient()
    monkeypatch.setattr(ollama_mod.requests, 'get',
                        lambda url, timeout=None: FakeResponse({'models': [{'name': 'llama3'}]}))
    assert c.get_models() == [{'name': 'llama3'}]


def test_is_server_running_true(monkeypatch):
    c = OllamaClient()
    monkeypatch.setattr(ollama_mod.requests, 'get', lambda url, timeout=None: FakeResponse({}, status=200))
    assert c.is_server_running() is True


def test_is_server_running_false_on_exception(monkeypatch):
    c = OllamaClient()

    def boom(url, timeout=None):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(ollama_mod.requests, 'get', boom)
    assert c.is_server_running() is False
