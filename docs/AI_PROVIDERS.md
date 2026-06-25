# Free cloud AI providers — implementation plan

> **English** · [Română](AI_PROVIDERS.ro.md)

This plan adds support for **free cloud AI model tiers** (OpenRouter, Groq, Google
Gemini, Mistral) **alongside** the existing local Ollama integration. The user
picks the active provider in Settings; nothing is sent to the cloud unless a
cloud provider is explicitly selected.

## Configuring a provider

You can configure a provider two ways — in **Settings** (stored in the DB) or via
`.env` (the fallback). A DB preference always wins over the matching env var, so
Settings is the easiest path; `.env` is handy for headless / first-boot setups.

**In the app:** open **Settings → AI**, pick a **provider**, paste its **API key**
(cloud providers) or set the **Ollama URL** (local), then choose a **model** from
the dropdown (it re-fetches per provider). A privacy note appears whenever a cloud
provider is selected, since prompts then leave the device.

**Via `.env`** (see [`.env.example`](../.env.example)): set `AI_PROVIDER` and the
key for that provider.

| Provider | `AI_PROVIDER` | API key var | Get a free key | Example model |
|----------|---------------|-------------|----------------|---------------|
| Ollama (local) | `ollama` | — (none) | — runs locally | `llama3:8b` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | <https://openrouter.ai/keys> | `meta-llama/llama-3.3-70b-instruct:free` |
| Groq | `groq` | `GROQ_API_KEY` | <https://console.groq.com/keys> | `llama-3.3-70b-versatile` |
| Mistral | `mistral` | `MISTRAL_API_KEY` | <https://console.mistral.ai/api-keys> | `mistral-small-latest` |
| Gemini | `gemini` | `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> | `gemini-2.0-flash` |

Notes:
- **Ollama needs no key** — it talks to a local server; set `OLLAMA_HOST` if it is
  not on `http://localhost:11434`. See [OLLAMA_INTEGRATION.md](OLLAMA_INTEGRATION.md).
- **OpenRouter** is filtered to its free (`:free`) models.
- The model list is fetched live per provider, with a curated static fallback if
  the fetch fails or no key is set.
- The AI assistant only runs while the master **AI enabled** switch is on.

## Decisions

| # | Decision |
|---|----------|
| Models | Free **cloud tiers with API key** |
| Providers | **OpenRouter, Groq, Gemini, Mistral** (+ existing Ollama) |
| Architecture | New `src/ai/` package: `ChatProvider` protocol + factory |
| Prefs schema | New `ai_provider` enum + reuse `ai_model` (interpreted per provider) |
| Keys | DB preferences columns + `.env` fallback (same pattern as Tuya) |
| Model list | Dynamic per-provider fetch + curated static fallback |
| Fallback | **None** — only the selected provider runs (privacy) |
| History | Providers **stateless**; an app-level history manager keeps context |
| HTTP | Plain `requests`, no new SDK dependencies |
| Privacy | Inline note in Settings whenever a cloud provider is selected |
| Resolution | `get_provider(prefs)` factory resolved **per request** |
| Streaming | Keep non-streaming (matches current behavior) |

## Current state (what exists today)

- A single `OllamaClient` singleton in `src/ollama/client.py`, talking to local
  Ollama over HTTP (`/api/chat`, `/api/generate`, `/api/tags`), holding the
  `conversation_history` itself.
- Routes `/api/ai/chat`, `/api/ai/models`, `/api/ai/status` in `src/main.py`.
- `ai_chat` does keyword-based intent detection (task / Tuya / weather / radio),
  then feeds the executed action's result to Ollama as `system_context`.
- `transport_chat` is a second call site with its own context and
  `temperature=0.3`.
- Preferences hold `ai_enabled`, `ollama_base_url`, `ai_model`,
  `ai_temperature`, `ai_max_tokens`.
- Settings UI in `frontend/src/components/SettingsPanel.vue`.

## 1. Backend — `src/ai/` package

- **`src/ai/base.py`** — `ChatProvider` protocol:
  `chat(messages, *, temperature, max_tokens) -> dict`,
  `get_models() -> list[dict]`, `is_available() -> bool`. Providers are
  **stateless** (no internal `conversation_history`). Every provider normalizes
  its reply to the existing shape
  `{'message': {'content': ...}, 'model': ..., 'done': ...}` so the routes stay
  unchanged.
- **`src/ai/ollama.py`** — `OllamaProvider`: move the current Ollama logic here
  (`/api/chat`, `/api/tags`, `/`). Takes `messages` in; no internal history.
- **`src/ai/openai_compat.py`** — `OpenAICompatProvider(base_url, api_key,
  default_model)`: one class for **OpenRouter / Groq / Mistral** via
  `POST /chat/completions` with `Authorization: Bearer`. `get_models()` hits
  `/models` (OpenRouter filtered to `:free`). Maps
  `choices[0].message.content` → normalized shape.
- **`src/ai/gemini.py`** — `GeminiProvider`: REST `:generateContent`, translating
  `system` / `user` / `assistant` → Gemini `contents` / `systemInstruction`;
  `get_models()` from `/v1beta/models`.
- **`src/ai/registry.py`** —
  - `PROVIDERS` table: id → (class, base_url, env key name, curated static model
    list).
  - `get_provider(prefs)` — reads `prefs.ai_provider`, resolves the key
    (`prefs.<x>_api_key or os.getenv(...)`), returns a configured instance.
  - `get_models_for(provider_id, prefs)` — dynamic fetch with static fallback on
    error / missing key.
- **`src/ai/history.py`** — a small app-level `ConversationHistory` (the current
  10-message rolling window: `_add_to_history` / `_clear`), shared across
  requests. `ai_chat` builds `messages = [system] + history` and appends the
  reply — preserving today's single-shared-conversation behavior across provider
  switches.

## 2. `src/main.py` route changes

- Replace `from ollama.client import ollama_client` with
  `from ai.registry import get_provider, get_models_for` plus the history
  manager.
- **`ai_chat`**: after building `system_context`,
  `provider = get_provider(prefs)`; `if not provider.is_available()` → keep the
  current "return the raw action result, or 503" branch; otherwise build messages
  from history + call `provider.chat(...)`, then append the reply to history. No
  silent fallback.
- **`transport_chat`**: same `get_provider(prefs)` resolution (keeps its own
  `temperature=0.3` and transport `system_context`; stateless — no shared history
  needed there).
- **`/api/ai/models`**: accept `?provider=<id>` (default = active); return
  `get_models_for(...)`.
- **`/api/ai/status`**: report `active_provider`, availability, current model,
  and which providers have a key configured.
- **`update_preferences`**: **remove** the live `ollama_client.base_url/model`
  mutation block — the factory now reads prefs on every request.

## 3. Data model + migration

- `src/task_manager/models.py`: add `ai_provider = Column(String(20),
  default='ollama')` and `openrouter_api_key`, `groq_api_key`, `gemini_api_key`,
  `mistral_api_key` (`String(200), default=''`).
- `src/task_manager/database.py` `_migrate_preferences`: matching `ALTER TABLE`
  entries (`ai_provider VARCHAR(20) DEFAULT 'ollama'`, four key columns
  `VARCHAR(200) DEFAULT ''`).
- Expose all new fields in both the `get_preferences` and `update_preferences`
  JSON payloads.

## 4. Frontend

- `frontend/src/api/types.ts`: add `ai_provider` + the four key fields to
  `Preferences`.
- `frontend/src/components/SettingsPanel.vue`: a **provider `<select>`** that
  conditionally shows the Ollama URL (ollama only) or an API-key field (cloud
  only); the **model dropdown re-fetches** `/api/ai/models?provider=` on provider
  change; an **inline privacy note** appears when a cloud provider is selected.
- `frontend/src/i18n/en.ts` / `ro.ts`: new keys (`lbl_ai_provider`, provider
  names, `lbl_api_key`, `hint_cloud_privacy`, etc.).
- Reuse the existing `aiEnabled` master switch unchanged.

## 5. Error handling

Map provider HTTP errors to friendly messages inside the providers (401 →
invalid / missing key, 429 → rate-limited / quota exceeded, timeout, model not
found), surfaced the same way the current Ollama wrapping works.

## 6. Tests

- `tests/test_ai_providers.py`: per-provider unit tests with mocked `requests`
  (chat normalization, model fetch + static fallback, error mapping). Offline —
  no real keys.
- Update `tests/test_ai_api.py`: monkeypatch `main.get_provider` instead of
  `main.ollama_client`; add a `/api/ai/models?provider=` case.
- `tests/test_preferences_api.py`: assert the new fields round-trip.
- Keep `tests/test_ollama_client.py` green (Ollama logic moved, not deleted).

## 7. Docs + config

- `.env.example`: add `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`,
  `MISTRAL_API_KEY`, `AI_PROVIDER`.
- This document plus its Romanian counterpart replace the Ollama-only framing of
  `OLLAMA_INTEGRATION.md`.

## Work phases

Each phase is independently shippable and leaves the app green. Ship in order —
later phases depend on earlier ones.

### Phase 0 — Persistence groundwork ✅ Done
**Goal:** the DB and API can carry provider + key data (no behavior change yet).
- Add `ai_provider` + the four `*_api_key` columns to `models.py`.
- Add matching `ALTER TABLE` entries in `database.py` `_migrate_preferences`.
- Expose the new fields in `get_preferences` / `update_preferences` payloads.
- Tests: `test_preferences_api.py` round-trips the new fields.
- **Done when:** preferences read/write the new fields; migration runs on an
  existing DB; nothing else changes.

### Phase 1 — Provider abstraction (`src/ai/`) ✅ Done
**Goal:** a stateless provider layer with Ollama working through it.
- `base.py` (`ChatProvider` protocol + normalized reply shape).
- `ollama.py` (move current Ollama logic, stateless).
- `history.py` (app-level conversation history).
- `registry.py` with `get_provider` / `get_models_for` (Ollama only for now).
- Tests: `test_ai_providers.py` for `OllamaProvider`; keep
  `test_ollama_client.py` green.
- **Done when:** the package exists and Ollama works through it in isolation;
  routes not yet switched.

### Phase 2 — Route migration to the factory ✅ Done
**Goal:** routes use the abstraction; behavior identical to today (Ollama only).
- `ai_chat` and `transport_chat` resolve via `get_provider(prefs)` + history.
- `/api/ai/models` accepts `?provider=`; `/api/ai/status` reports active provider.
- Remove the live `ollama_client.*` mutation in `update_preferences`.
- Tests: update `test_ai_api.py` to monkeypatch `main.get_provider`.
- **Done when:** full suite green with Ollama as the only provider, routed
  through the factory.

### Phase 3 — Cloud providers ✅ Done
**Goal:** OpenRouter, Groq, Mistral, Gemini selectable from the backend.
- `openai_compat.py` (OpenRouter / Groq / Mistral) + `gemini.py`.
- Register them in `PROVIDERS` (base URLs, env keys, curated static model lists).
- Dynamic `get_models` + static fallback; friendly error mapping (401/429/...).
- Tests: per-provider unit tests with mocked `requests`, including fallback.
- **Done when:** a cloud provider selected in prefs answers `/api/ai/chat` and
  lists models, all under test with mocks.

### Phase 4 — Frontend ✅ Done
**Goal:** users can pick a provider, enter a key, and choose a model.
- Provider `<select>` + conditional URL/API-key fields in `SettingsPanel.vue`.
- Model dropdown re-fetches on provider change; inline cloud-privacy note.
- `types.ts` + `en.ts` / `ro.ts` additions.
- **Done when:** switching provider + model in Settings works end-to-end.

### Phase 5 — Docs & config polish ✅ Done
**Goal:** discoverable configuration.
- `.env.example` keys (`*_API_KEY`, `AI_PROVIDER`).
- Finalize this doc pair (added the **Configuring a provider** section above);
  linked from `OLLAMA_INTEGRATION.md` and the README docs index.
- **Done when:** a new user can configure any provider from docs alone.
