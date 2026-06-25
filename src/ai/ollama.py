"""Stateless Ollama chat provider.

The chat logic that used to live in ``ollama.client.OllamaClient`` (system
prompt building + history) is now split: message assembly moves to the routes
via ``ai.history``, and this provider only talks to the Ollama HTTP API
(``/api/chat``, ``/api/tags``, ``/``).
"""
import os
from typing import Dict, List

import requests

from ai.base import normalize_reply


class OllamaProvider:
    """Talks to a local/remote Ollama server. Holds no conversation history."""

    def __init__(self, base_url: str = None, model: str = None, timeout: int = None):
        self.base_url = base_url or os.getenv('OLLAMA_HOST', 'http://localhost:11434')
        self.model = model or os.getenv('OLLAMA_MODEL', 'llama3:8b')
        self.timeout = timeout if timeout is not None else int(os.getenv('OLLAMA_TIMEOUT', '120'))

    def chat(self, messages: List[Dict[str, str]], *,
             temperature: float = 0.7, max_tokens: int = 500) -> Dict:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "max_tokens": max_tokens},
        }
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            result = response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
        return normalize_reply(result, default_model=self.model)

    def get_models(self) -> List[Dict]:
        url = f"{self.base_url}/api/tags"
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            models = response.json().get("models", [])
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
        return [{"name": m["name"], "size": m.get("size", 0)} for m in models]

    def is_available(self) -> bool:
        try:
            response = requests.get(f"{self.base_url}/", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
