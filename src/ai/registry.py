"""Provider registry + factory.

``get_provider(prefs)`` resolves the active provider from preferences on every
request (no long-lived mutable client). ``get_models_for`` does a dynamic model
fetch with a curated static fallback. Ollama is the only provider for now; cloud
providers register additional ``PROVIDERS`` entries in a later phase.
"""
import os
from typing import Dict, List

from ai.gemini import GeminiProvider
from ai.ollama import OllamaProvider
from ai.openai_compat import OpenAICompatProvider

DEFAULT_PROVIDER = 'ollama'


def _resolve_key(prefs, spec) -> str:
    """Resolve a provider's API key from the prefs column, then the env fallback."""
    env_key = spec.get('env_key')
    if not env_key:
        return ''
    return getattr(prefs, env_key.lower(), '') or os.getenv(env_key, '')


def _model_for(prefs, spec) -> str:
    """The shared ``ai_model`` pref, interpreted per provider; spec default if unset."""
    return getattr(prefs, 'ai_model', None) or spec.get('default_model', '')


def _build_ollama(prefs, spec) -> OllamaProvider:
    base_url = getattr(prefs, 'ollama_base_url', None) or spec['base_url']
    model = getattr(prefs, 'ai_model', None) or None
    return OllamaProvider(base_url=base_url, model=model)


def _build_openai_compat(prefs, spec) -> OpenAICompatProvider:
    return OpenAICompatProvider(
        base_url=spec['base_url'],
        api_key=_resolve_key(prefs, spec),
        default_model=_model_for(prefs, spec),
        name=spec['name'],
        free_only=spec.get('free_only', False),
    )


def _build_gemini(prefs, spec) -> GeminiProvider:
    return GeminiProvider(
        api_key=_resolve_key(prefs, spec),
        default_model=_model_for(prefs, spec),
        base_url=spec['base_url'],
    )


# id -> spec. ``build`` constructs a configured, stateless instance from prefs.
# ``static_models`` is the curated fallback when a dynamic fetch fails.
PROVIDERS: Dict[str, Dict] = {
    'ollama': {
        'class': OllamaProvider,
        'base_url': 'http://localhost:11434',
        'env_key': None,  # local — no API key
        'static_models': [{'name': 'llama3:8b', 'size': 0}],
        'build': _build_ollama,
    },
    'openrouter': {
        'class': OpenAICompatProvider,
        'base_url': 'https://openrouter.ai/api/v1',
        'env_key': 'OPENROUTER_API_KEY',
        'name': 'OpenRouter',
        'free_only': True,  # only surface the free tier
        'default_model': 'meta-llama/llama-3.3-70b-instruct:free',
        'static_models': [
            {'name': 'meta-llama/llama-3.3-70b-instruct:free', 'size': 0},
            {'name': 'deepseek/deepseek-r1:free', 'size': 0},
            {'name': 'google/gemini-2.0-flash-exp:free', 'size': 0},
            {'name': 'mistralai/mistral-small-3.2-24b-instruct:free', 'size': 0},
            {'name': 'qwen/qwen-2.5-72b-instruct:free', 'size': 0},
        ],
        'build': _build_openai_compat,
    },
    'groq': {
        'class': OpenAICompatProvider,
        'base_url': 'https://api.groq.com/openai/v1',
        'env_key': 'GROQ_API_KEY',
        'name': 'Groq',
        'default_model': 'llama-3.3-70b-versatile',
        'static_models': [
            {'name': 'llama-3.3-70b-versatile', 'size': 0},
            {'name': 'llama-3.1-8b-instant', 'size': 0},
            {'name': 'gemma2-9b-it', 'size': 0},
            {'name': 'llama3-70b-8192', 'size': 0},
        ],
        'build': _build_openai_compat,
    },
    'mistral': {
        'class': OpenAICompatProvider,
        'base_url': 'https://api.mistral.ai/v1',
        'env_key': 'MISTRAL_API_KEY',
        'name': 'Mistral',
        'default_model': 'mistral-small-latest',
        'static_models': [
            {'name': 'mistral-small-latest', 'size': 0},
            {'name': 'open-mistral-7b', 'size': 0},
            {'name': 'open-mixtral-8x7b', 'size': 0},
            {'name': 'mistral-large-latest', 'size': 0},
        ],
        'build': _build_openai_compat,
    },
    'gemini': {
        'class': GeminiProvider,
        'base_url': 'https://generativelanguage.googleapis.com',
        'env_key': 'GEMINI_API_KEY',
        'name': 'Gemini',
        'default_model': 'gemini-2.0-flash',
        'static_models': [
            {'name': 'gemini-2.0-flash', 'size': 0},
            {'name': 'gemini-2.5-flash', 'size': 0},
            {'name': 'gemini-1.5-flash', 'size': 0},
            {'name': 'gemini-1.5-pro', 'size': 0},
        ],
        'build': _build_gemini,
    },
}


def active_provider_id(prefs) -> str:
    """Resolve the active provider id from prefs / env, clamped to a known one."""
    pid = getattr(prefs, 'ai_provider', None) or os.getenv('AI_PROVIDER', DEFAULT_PROVIDER)
    return pid if pid in PROVIDERS else DEFAULT_PROVIDER


def _has_key(prefs, spec) -> bool:
    """Whether a provider's API key is configured (prefs column or env fallback).

    Local providers (no ``env_key``) need no key and are always configured.
    """
    env_key = spec.get('env_key')
    if not env_key:
        return True
    pref_attr = env_key.lower()  # e.g. GROQ_API_KEY -> groq_api_key
    return bool(getattr(prefs, pref_attr, '') or os.getenv(env_key, ''))


def configured_providers(prefs) -> List[str]:
    """Provider ids that have a usable key (or need none), for status reporting."""
    return [pid for pid, spec in PROVIDERS.items() if _has_key(prefs, spec)]


def _instantiate(provider_id: str, prefs):
    spec = PROVIDERS.get(provider_id, PROVIDERS[DEFAULT_PROVIDER])
    return spec['build'](prefs, spec)


def get_provider(prefs):
    """Return a configured provider instance for the active provider in prefs."""
    return _instantiate(active_provider_id(prefs), prefs)


def get_models_for(provider_id: str, prefs) -> List[Dict]:
    """Dynamic model list for ``provider_id`` with curated static fallback.

    Returns ``[]`` for an unknown provider; falls back to the spec's
    ``static_models`` on any fetch error or empty result.
    """
    spec = PROVIDERS.get(provider_id)
    if spec is None:
        return []
    try:
        models = _instantiate(provider_id, prefs).get_models()
        if models:
            return models
    except Exception:
        pass
    return list(spec.get('static_models', []))
