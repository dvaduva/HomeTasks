"""Unit tests for the ``ai`` provider layer (Phase 1).

Covers the stateless ``OllamaProvider``, the app-level ``ConversationHistory``,
and the ``registry`` factory/fallback. The HTTP layer is faked by patching
``ai.ollama.requests``. Offline — no real server.
"""
import types

import pytest
import requests

import ai.ollama as ollama_mod
import ai.openai_compat as openai_mod
import ai.gemini as gemini_mod
from ai.base import ChatProvider, normalize_reply
from ai.history import ConversationHistory
from ai.ollama import OllamaProvider
from ai.openai_compat import OpenAICompatProvider
from ai.gemini import GeminiProvider
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


# --- OpenAICompatProvider (OpenRouter / Groq / Mistral) -------------------

def test_openai_compat_satisfies_protocol():
    assert isinstance(OpenAICompatProvider('http://x/v1', 'k', 'm'), ChatProvider)


def test_openai_compat_chat_normalizes_and_sends_bearer(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'secret', 'm', name='Groq')
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured['url'] = url
        captured['json'] = json
        captured['headers'] = headers
        return FakeResponse({'model': 'm', 'choices': [
            {'message': {'role': 'assistant', 'content': 'salut'}}]})

    monkeypatch.setattr(openai_mod.requests, 'post', fake_post)
    msgs = [{'role': 'user', 'content': 'buna'}]
    out = p.chat(msgs, temperature=0.2, max_tokens=42)

    assert out == {'message': {'content': 'salut'}, 'model': 'm', 'done': True,
                   'created_at': ''}
    assert captured['url'] == 'http://api/v1/chat/completions'
    assert captured['headers']['Authorization'] == 'Bearer secret'
    assert captured['json']['messages'] is msgs
    assert captured['json']['temperature'] == 0.2
    assert captured['json']['max_tokens'] == 42
    assert captured['json']['stream'] is False


def test_openai_compat_chat_maps_401_to_friendly_error(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'bad', 'm', name='Groq')
    monkeypatch.setattr(openai_mod.requests, 'post',
                        lambda *a, **k: FakeResponse({}, status=401))
    with pytest.raises(Exception, match='Groq: invalid or missing API key'):
        p.chat([{'role': 'user', 'content': 'hi'}])


def test_openai_compat_chat_maps_429_to_friendly_error(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'k', 'm', name='Mistral')
    monkeypatch.setattr(openai_mod.requests, 'post',
                        lambda *a, **k: FakeResponse({}, status=429))
    with pytest.raises(Exception, match='Mistral: rate limit or quota exceeded'):
        p.chat([{'role': 'user', 'content': 'hi'}])


def test_openai_compat_chat_timeout_raises(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'k', 'm', name='Groq')

    def boom(*a, **k):
        raise requests.exceptions.Timeout('slow')

    monkeypatch.setattr(openai_mod.requests, 'post', boom)
    with pytest.raises(Exception, match='Groq: request timed out'):
        p.chat([{'role': 'user', 'content': 'hi'}])


def test_openai_compat_get_models_lists_ids(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'k', 'm', name='Groq')
    monkeypatch.setattr(openai_mod.requests, 'get',
                        lambda *a, **k: FakeResponse({'data': [
                            {'id': 'llama-3.3-70b-versatile'}, {'id': 'gemma2-9b-it'}]}))
    assert p.get_models() == [{'name': 'llama-3.3-70b-versatile', 'size': 0},
                              {'name': 'gemma2-9b-it', 'size': 0}]


def test_openai_compat_get_models_free_only_filters(monkeypatch):
    p = OpenAICompatProvider('http://api/v1', 'k', 'm', name='OpenRouter', free_only=True)
    monkeypatch.setattr(openai_mod.requests, 'get',
                        lambda *a, **k: FakeResponse({'data': [
                            {'id': 'paid/model'}, {'id': 'free/model:free'}]}))
    assert p.get_models() == [{'name': 'free/model:free', 'size': 0}]


def test_openai_compat_is_available_tracks_key():
    assert OpenAICompatProvider('http://x/v1', 'k', 'm').is_available() is True
    assert OpenAICompatProvider('http://x/v1', '', 'm').is_available() is False


# --- GeminiProvider -------------------------------------------------------

def test_gemini_satisfies_protocol():
    assert isinstance(GeminiProvider('k', 'gemini-2.0-flash'), ChatProvider)


def test_gemini_chat_translates_roles_and_parses(monkeypatch):
    p = GeminiProvider('secret', 'gemini-2.0-flash')
    captured = {}

    def fake_post(url, json=None, params=None, headers=None, timeout=None):
        captured['url'] = url
        captured['json'] = json
        captured['params'] = params
        return FakeResponse({'candidates': [
            {'content': {'parts': [{'text': 'sa'}, {'text': 'lut'}]}}]})

    monkeypatch.setattr(gemini_mod.requests, 'post', fake_post)
    msgs = [{'role': 'system', 'content': 'sys'},
            {'role': 'user', 'content': 'buna'},
            {'role': 'assistant', 'content': 'ack'}]
    out = p.chat(msgs, temperature=0.2, max_tokens=42)

    assert out['message']['content'] == 'salut'
    assert out['model'] == 'gemini-2.0-flash'
    assert captured['url'].endswith('/v1beta/models/gemini-2.0-flash:generateContent')
    assert captured['params'] == {'key': 'secret'}
    body = captured['json']
    assert body['systemInstruction'] == {'parts': [{'text': 'sys'}]}
    assert body['contents'] == [
        {'role': 'user', 'parts': [{'text': 'buna'}]},
        {'role': 'model', 'parts': [{'text': 'ack'}]},
    ]
    assert body['generationConfig'] == {'temperature': 0.2, 'maxOutputTokens': 42}


def test_gemini_chat_maps_429(monkeypatch):
    p = GeminiProvider('k', 'gemini-2.0-flash')
    monkeypatch.setattr(gemini_mod.requests, 'post',
                        lambda *a, **k: FakeResponse({}, status=429))
    with pytest.raises(Exception, match='Gemini: rate limit or quota exceeded'):
        p.chat([{'role': 'user', 'content': 'hi'}])


def test_gemini_get_models_strips_prefix_and_filters(monkeypatch):
    p = GeminiProvider('k', 'gemini-2.0-flash')
    monkeypatch.setattr(gemini_mod.requests, 'get',
                        lambda *a, **k: FakeResponse({'models': [
                            {'name': 'models/gemini-2.0-flash',
                             'supportedGenerationMethods': ['generateContent']},
                            {'name': 'models/embedding-001',
                             'supportedGenerationMethods': ['embedContent']}]}))
    assert p.get_models() == [{'name': 'gemini-2.0-flash', 'size': 0}]


def test_gemini_is_available_tracks_key():
    assert GeminiProvider('k', 'm').is_available() is True
    assert GeminiProvider('', 'm').is_available() is False


# --- registry: cloud providers --------------------------------------------

def test_get_provider_resolves_openrouter_with_prefs_key():
    prefs = _prefs(ai_provider='openrouter', openrouter_api_key='pk', ai_model='custom:free')
    p = registry.get_provider(prefs)
    assert isinstance(p, OpenAICompatProvider)
    assert p.api_key == 'pk'
    assert p.model == 'custom:free'
    assert p.free_only is True
    assert p.base_url == 'https://openrouter.ai/api/v1'


def test_get_provider_resolves_gemini():
    prefs = _prefs(ai_provider='gemini', gemini_api_key='gk', ai_model='')
    p = registry.get_provider(prefs)
    assert isinstance(p, GeminiProvider)
    assert p.api_key == 'gk'
    # Empty ai_model falls back to the spec default.
    assert p.model == 'gemini-2.0-flash'


def test_get_provider_key_falls_back_to_env(monkeypatch):
    monkeypatch.setenv('GROQ_API_KEY', 'env-key')
    prefs = _prefs(ai_provider='groq', groq_api_key='', ai_model='')
    p = registry.get_provider(prefs)
    assert isinstance(p, OpenAICompatProvider)
    assert p.api_key == 'env-key'


def test_configured_providers_reflects_keys(monkeypatch):
    monkeypatch.delenv('OPENROUTER_API_KEY', raising=False)
    monkeypatch.delenv('GROQ_API_KEY', raising=False)
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.delenv('MISTRAL_API_KEY', raising=False)
    prefs = _prefs(openrouter_api_key='', groq_api_key='gk', gemini_api_key='',
                   mistral_api_key='')
    configured = registry.configured_providers(prefs)
    assert 'ollama' in configured  # local, always configured
    assert 'groq' in configured
    assert 'openrouter' not in configured
    assert 'gemini' not in configured


def test_get_models_for_cloud_uses_dynamic_then_static(monkeypatch):
    prefs = _prefs(ai_provider='groq', groq_api_key='k')
    monkeypatch.setattr(openai_mod.requests, 'get',
                        lambda *a, **k: FakeResponse({'data': [{'id': 'dyn-model'}]}))
    assert registry.get_models_for('groq', prefs) == [{'name': 'dyn-model', 'size': 0}]


def test_get_models_for_cloud_falls_back_to_static_on_error(monkeypatch):
    prefs = _prefs(ai_provider='mistral', mistral_api_key='k')

    def boom(*a, **k):
        raise requests.exceptions.ConnectionError('refused')

    monkeypatch.setattr(openai_mod.requests, 'get', boom)
    assert registry.get_models_for('mistral', prefs) == \
        registry.PROVIDERS['mistral']['static_models']
