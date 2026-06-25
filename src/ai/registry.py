"""Provider registry + factory.

``get_provider(prefs)`` resolves the active provider from preferences on every
request (no long-lived mutable client). ``get_models_for`` does a dynamic model
fetch with a curated static fallback. Ollama is the only provider for now; cloud
providers register additional ``PROVIDERS`` entries in a later phase.
"""
import os
from typing import Dict, List

from ai.ollama import OllamaProvider

DEFAULT_PROVIDER = 'ollama'


def _build_ollama(prefs, spec) -> OllamaProvider:
    base_url = getattr(prefs, 'ollama_base_url', None) or spec['base_url']
    model = getattr(prefs, 'ai_model', None) or None
    return OllamaProvider(base_url=base_url, model=model)


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
