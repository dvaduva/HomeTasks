"""App-level conversation history.

Providers are stateless, so context lives here instead. This preserves today's
behavior: a single shared rolling window (10 messages) that survives across
provider switches. System messages are never stored — the routes prepend a
freshly built system prompt on each turn.
"""
from typing import Dict, List


class ConversationHistory:
    """A bounded rolling window of user/assistant turns."""

    def __init__(self, max_length: int = 10):
        self.max_length = max_length
        self._messages: List[Dict[str, str]] = []

    def add(self, role: str, content: str) -> None:
        """Append a turn, trimming to the most recent ``max_length`` messages."""
        self._messages.append({"role": role, "content": content})
        if len(self._messages) > self.max_length:
            self._messages = self._messages[-self.max_length:]

    def messages(self) -> List[Dict[str, str]]:
        """Return a copy of the stored turns (oldest first)."""
        return list(self._messages)

    def clear(self) -> None:
        self._messages = []


# Single shared conversation, mirroring the previous singleton's behavior.
conversation_history = ConversationHistory()
