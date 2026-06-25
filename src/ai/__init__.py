"""Provider-agnostic AI chat layer.

Stateless chat providers (Ollama today, cloud tiers later) behind a common
``ChatProvider`` protocol, plus an app-level conversation history and a small
registry/factory used by the routes.
"""
