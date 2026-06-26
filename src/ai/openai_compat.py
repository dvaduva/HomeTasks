"""Stateless provider for OpenAI-compatible chat APIs.

A single class for **OpenRouter, Groq and Mistral**: they all speak
``POST /chat/completions`` with ``Authorization: Bearer`` and return the reply at
``choices[0].message.content``. ``get_models`` reads ``GET /models``; for
OpenRouter it is filtered to the ``:free`` tier so only free models are offered.

Holds no conversation history — the routes pass the full ``messages`` list in.
"""
import os
from typing import Dict, List

import requests

from ai.base import error_detail, http_error_message, normalize_reply


class OpenAICompatProvider:
    """OpenAI-compatible chat backend (OpenRouter / Groq / Mistral)."""

    def __init__(self, base_url: str, api_key: str, default_model: str, *,
                 name: str = 'cloud', free_only: bool = False, timeout: int = None):
        self.base_url = (base_url or '').rstrip('/')
        self.api_key = api_key or ''
        self.model = default_model
        self.name = name
        self.free_only = free_only
        self.timeout = timeout if timeout is not None else int(os.getenv('AI_HTTP_TIMEOUT', '60'))

    def _headers(self) -> Dict[str, str]:
        return {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}

    def chat(self, messages: List[Dict[str, str]], *,
             temperature: float = 0.7, max_tokens: int = 500) -> Dict:
        url = f"{self.base_url}/chat/completions"
        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'stream': False,
        }
        try:
            response = requests.post(url, json=payload, headers=self._headers(),
                                     timeout=self.timeout)
            if response.status_code >= 400:
                raise Exception(http_error_message(
                    response.status_code, self.name, error_detail(response)))
            data = response.json()
        except requests.exceptions.Timeout:
            raise Exception(f"{self.name}: request timed out")
        except requests.exceptions.RequestException as e:
            raise Exception(f"{self.name} API error: {str(e)}")
        choice = (data.get('choices') or [{}])[0]
        content = (choice.get('message') or {}).get('content', '')
        return normalize_reply(
            {'message': {'content': content}, 'model': data.get('model'), 'done': True},
            default_model=self.model)

    def get_models(self) -> List[Dict]:
        url = f"{self.base_url}/models"
        try:
            response = requests.get(url, headers=self._headers(), timeout=self.timeout)
            if response.status_code >= 400:
                raise Exception(http_error_message(
                    response.status_code, self.name, error_detail(response)))
            data = response.json()
        except requests.exceptions.Timeout:
            raise Exception(f"{self.name}: request timed out")
        except requests.exceptions.RequestException as e:
            raise Exception(f"{self.name} API error: {str(e)}")
        ids = [m.get('id', '') for m in data.get('data', []) if m.get('id')]
        if self.free_only:
            ids = [i for i in ids if i.endswith(':free')]
        return [{'name': i, 'size': 0} for i in ids]

    def is_available(self) -> bool:
        """Usable when a key is configured (no live ping — that would spend quota)."""
        return bool(self.api_key)
