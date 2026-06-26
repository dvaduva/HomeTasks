"""Stateless Google Gemini chat provider.

Gemini's REST shape differs from the OpenAI one: turns are translated to
``contents`` (roles ``user`` / ``model``), with any ``system`` turns folded into
a separate ``systemInstruction``. The API key is passed as a ``?key=`` query
param. ``get_models`` lists ``/v1beta/models`` that support ``generateContent``.

Holds no conversation history — the routes pass the full ``messages`` list in.
"""
import os
from typing import Dict, List

import requests

from ai.base import error_detail, http_error_message, normalize_reply


class GeminiProvider:
    """Google Gemini chat backend over the REST ``generateContent`` endpoint."""

    def __init__(self, api_key: str, default_model: str, *,
                 base_url: str = None, timeout: int = None):
        self.base_url = (base_url or 'https://generativelanguage.googleapis.com').rstrip('/')
        self.api_key = api_key or ''
        self.model = default_model
        self.name = 'Gemini'
        self.timeout = timeout if timeout is not None else int(os.getenv('AI_HTTP_TIMEOUT', '60'))

    @staticmethod
    def _to_gemini(messages: List[Dict[str, str]]) -> Dict:
        """Translate OpenAI-style messages into a Gemini request body."""
        contents: List[Dict] = []
        system_parts: List[str] = []
        for m in messages:
            text = m.get('content', '')
            if m.get('role') == 'system':
                system_parts.append(text)
            else:
                role = 'model' if m.get('role') == 'assistant' else 'user'
                contents.append({'role': role, 'parts': [{'text': text}]})
        body: Dict = {'contents': contents}
        if system_parts:
            body['systemInstruction'] = {'parts': [{'text': '\n'.join(system_parts)}]}
        return body

    def chat(self, messages: List[Dict[str, str]], *,
             temperature: float = 0.7, max_tokens: int = 500) -> Dict:
        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent"
        body = self._to_gemini(messages)
        body['generationConfig'] = {'temperature': temperature, 'maxOutputTokens': max_tokens}
        try:
            response = requests.post(url, json=body, params={'key': self.api_key},
                                     headers={'Content-Type': 'application/json'},
                                     timeout=self.timeout)
            if response.status_code >= 400:
                raise Exception(http_error_message(
                    response.status_code, self.name, error_detail(response)))
            data = response.json()
        except requests.exceptions.Timeout:
            raise Exception(f"{self.name}: request timed out")
        except requests.exceptions.RequestException as e:
            raise Exception(f"{self.name} API error: {str(e)}")
        candidate = (data.get('candidates') or [{}])[0]
        parts = (candidate.get('content') or {}).get('parts') or []
        content = ''.join(p.get('text', '') for p in parts)
        return normalize_reply(
            {'message': {'content': content}, 'model': self.model, 'done': True},
            default_model=self.model)

    def get_models(self) -> List[Dict]:
        url = f"{self.base_url}/v1beta/models"
        try:
            response = requests.get(url, params={'key': self.api_key}, timeout=self.timeout)
            if response.status_code >= 400:
                raise Exception(http_error_message(
                    response.status_code, self.name, error_detail(response)))
            data = response.json()
        except requests.exceptions.Timeout:
            raise Exception(f"{self.name}: request timed out")
        except requests.exceptions.RequestException as e:
            raise Exception(f"{self.name} API error: {str(e)}")
        out: List[Dict] = []
        for m in data.get('models', []):
            methods = m.get('supportedGenerationMethods')
            if methods and 'generateContent' not in methods:
                continue
            name = m.get('name', '')
            if name.startswith('models/'):
                name = name[len('models/'):]
            if name:
                out.append({'name': name, 'size': 0})
        return out

    def is_available(self) -> bool:
        """Usable when a key is configured (no live ping — that would spend quota)."""
        return bool(self.api_key)
