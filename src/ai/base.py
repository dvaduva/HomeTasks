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
