import requests
import json
import os
from typing import Dict, List, Optional
from datetime import datetime, timedelta

class OllamaClient:
    def __init__(self, base_url: str = None, model: str = None):
        """
        Initialize the Ollama client.
        
        Args:
            base_url: Base URL for Ollama API (default: http://localhost:11434)
            model: Model name to use (default: llama3:8b)
        """
        self.base_url = base_url or os.getenv('OLLAMA_HOST', 'http://localhost:11434')
        self.model = model or os.getenv('OLLAMA_MODEL', 'llama3:8b')
        self.timeout = int(os.getenv('OLLAMA_TIMEOUT', '120'))
        self.max_history_length = 10
        
        # Conversation history for context maintenance
        self.conversation_history: List[Dict[str, str]] = []
    
    def _add_to_history(self, role: str, content: str):
        """Add a message to conversation history, maintaining length limit."""
        self.conversation_history.append({"role": role, "content": content})
        if len(self.conversation_history) > self.max_history_length:
            # Keep only the most recent messages
            self.conversation_history = self.conversation_history[-self.max_history_length:]
    
    def _clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []
    
    def generate(self, prompt: str, temperature: float = 0.7, max_tokens: int = 500) -> Dict:
        """
        Generate text from a prompt (without conversation context).
        
        Args:
            prompt: The input prompt
            temperature: Creativity parameter (0.0 to 1.0)
            max_tokens: Maximum number of tokens to generate
            
        Returns:
            Dictionary with the response
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "max_tokens": max_tokens
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
    
    def chat(self, message: str, temperature: float = 0.7, max_tokens: int = 500, system_context: str = None) -> Dict:
        """
        Send a message and get a response, maintaining conversation context.

        Args:
            message: The user's message
            temperature: Creativity parameter (0.0 to 1.0)
            max_tokens: Maximum number of tokens to generate
            system_context: Optional extra context (e.g. result of an executed action)

        Returns:
            Dictionary with the response
        """
        # Add user message to history
        self._add_to_history("user", message)

        # Prepare messages for API call
        messages = []

        # Build system message
        system_content = (
            "You are a helpful assistant for HomeTasks, a family task management application. "
            "You help users manage tasks, get weather information, and answer questions. "
            "Keep your responses concise, helpful, and in the same language as the user's message."
        )
        if system_context:
            system_content += f"\n\nContext from executed action: {system_context}. Use this information to formulate your response."

        messages.append({"role": "system", "content": system_content})

        # Add conversation history (skip any existing system messages)
        messages.extend(msg for msg in self.conversation_history if msg["role"] != "system")
        
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "max_tokens": max_tokens
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            result = response.json()
            
            # Add assistant response to history
            assistant_content = result.get("message", {}).get("content", "")
            self._add_to_history("assistant", assistant_content)
            
            return result
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
    
    def get_models(self) -> List[Dict]:
        """
        Get list of available models from Ollama.
        
        Returns:
            List of model information dictionaries
        """
        url = f"{self.base_url}/api/tags"
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json().get("models", [])
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
    
    def is_server_running(self) -> bool:
        """
        Check if Ollama server is running and accessible.
        
        Returns:
            True if server is running, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/", timeout=5)
            return response.status_code == 200
        except:
            return False

# Global instance for easy access
ollama_client = OllamaClient()