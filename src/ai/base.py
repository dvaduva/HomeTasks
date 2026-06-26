"""Common contract and reply normalization for chat providers.

Every provider is **stateless** — it receives the full ``messages`` list on each
call and holds no conversation history of its own (that lives in
``ai.history``). Providers normalize their backend's reply to a single shape so
the routes stay provider-agnostic:

    {'message': {'content': str}, 'model': str, 'done': bool, 'created_at': str}
"""
from typing import Dict, List, Protocol, runtime_checkable


@runtime_checkable
class ChatProvider(Protocol):
    """Stateless chat backend."""

    def chat(self, messages: List[Dict[str, str]], *,
             temperature: float = 0.7, max_tokens: int = 500) -> Dict:
        """Send ``messages`` and return a normalized reply (see module docstring)."""
        ...

    def get_models(self) -> List[Dict]:
        """Return available models as ``[{'name': str, 'size': int}, ...]``."""
        ...

    def is_available(self) -> bool:
        """Return True if the backend is reachable / usable right now."""
        ...


def http_error_message(status: int, provider: str, detail: str = '') -> str:
    """Map a provider HTTP status to a short, user-facing message.

    Cloud providers share these failure modes (bad key, quota, missing model);
    keeping the mapping here lets every provider surface the same wording.
    ``detail`` (the backend's own error text, via :func:`error_detail`) is
    appended when present so the real cause isn't lost behind a generic label.
    """
    mapping = {
        400: f"{provider}: bad request (check the selected model)",
        401: f"{provider}: invalid or missing API key",
        403: f"{provider}: access forbidden (check API key permissions)",
        404: f"{provider}: model not found",
        429: f"{provider}: rate limit or quota exceeded",
    }
    if status in mapping:
        base = mapping[status]
    elif status >= 500:
        base = f"{provider}: service unavailable (HTTP {status})"
    else:
        base = f"{provider} API error (HTTP {status})"
    return f"{base} — {detail}" if detail else base


def error_detail(response) -> str:
    """Best-effort extraction of a backend's own error text from a failed response.

    OpenAI-compatible and Gemini errors carry the real reason in the body
    (``{"error": {"message": ...}}`` or ``{"error": "..."}``); fall back to a
    trimmed raw-text snippet. Never raises — diagnostics must not mask the error.
    """
    try:
        data = response.json()
    except Exception:
        text = (getattr(response, 'text', '') or '').strip()
        return text[:300]
    if isinstance(data, dict):
        err = data.get('error', data.get('message', ''))
        if isinstance(err, dict):
            err = err.get('message') or err.get('code') or ''
        if err:
            return str(err)[:300]
    return ''


def normalize_reply(raw: Dict, default_model: str = '') -> Dict:
    """Coerce a raw backend response into the shared reply shape.

    Tolerates missing keys so a thin/odd backend response never breaks callers.
    """
    message = raw.get('message') or {}
    return {
        'message': {'content': message.get('content', '')},
        'model': raw.get('model') or default_model,
        'done': raw.get('done', True),
        'created_at': raw.get('created_at', ''),
    }
