# Provideri AI cloud gratuiti — plan de implementare

> [English](AI_PROVIDERS.md) · **Română**

Acest plan adaugă suport pentru **tiere cloud AI gratuite** (OpenRouter, Groq,
Google Gemini, Mistral) **pe lângă** integrarea locală Ollama existentă.
Utilizatorul alege providerul activ în Settings; nimic nu pleacă în cloud decât
dacă este selectat explicit un provider cloud.

## Decizii

| # | Decizie |
|---|---------|
| Modele | **Tiere cloud gratuite cu API key** |
| Provideri | **OpenRouter, Groq, Gemini, Mistral** (+ Ollama existent) |
| Arhitectură | Pachet nou `src/ai/`: protocol `ChatProvider` + factory |
| Schema prefs | Coloană nouă `ai_provider` + reutilizarea `ai_model` (interpretat per provider) |
| Chei | Coloane în preferences (DB) + fallback `.env` (același pattern ca Tuya) |
| Listă modele | Fetch dinamic per provider + listă statică curată de rezervă |
| Fallback | **Niciunul** — rulează doar providerul selectat (privacy) |
| Istoric | Provideri **stateless**; un history manager la nivel de aplicație păstrează contextul |
| HTTP | Doar `requests`, fără dependențe SDK noi |
| Privacy | Notă inline în Settings ori de câte ori e selectat un provider cloud |
| Rezolvare | Factory `get_provider(prefs)` rezolvat **per cerere** |
| Streaming | Rămâne non-streaming (ca în comportamentul actual) |

## Stare curentă (ce există azi)

- Un singur singleton `OllamaClient` în `src/ollama/client.py`, care vorbește cu
  Ollama local prin HTTP (`/api/chat`, `/api/generate`, `/api/tags`) și ține el
  însuși `conversation_history`.
- Rutele `/api/ai/chat`, `/api/ai/models`, `/api/ai/status` în `src/main.py`.
- `ai_chat` face detecție de intenție pe bază de cuvinte cheie (task / Tuya /
  vreme / radio), apoi trimite rezultatul acțiunii executate către Ollama ca
  `system_context`.
- `transport_chat` este un al doilea punct de apel, cu context propriu și
  `temperature=0.3`.
- Preferences conțin `ai_enabled`, `ollama_base_url`, `ai_model`,
  `ai_temperature`, `ai_max_tokens`.
- UI-ul de setări în `frontend/src/components/SettingsPanel.vue`.

## 1. Backend — pachetul `src/ai/`

- **`src/ai/base.py`** — protocolul `ChatProvider`:
  `chat(messages, *, temperature, max_tokens) -> dict`,
  `get_models() -> list[dict]`, `is_available() -> bool`. Providerii sunt
  **stateless** (fără `conversation_history` intern). Fiecare provider
  normalizează răspunsul la forma existentă
  `{'message': {'content': ...}, 'model': ..., 'done': ...}`, astfel încât rutele
  rămân neschimbate.
- **`src/ai/ollama.py`** — `OllamaProvider`: mutăm aici logica Ollama actuală
  (`/api/chat`, `/api/tags`, `/`). Primește `messages`; fără istoric intern.
- **`src/ai/openai_compat.py`** — `OpenAICompatProvider(base_url, api_key,
  default_model)`: o singură clasă pentru **OpenRouter / Groq / Mistral** prin
  `POST /chat/completions` cu `Authorization: Bearer`. `get_models()` apelează
  `/models` (OpenRouter filtrat la `:free`). Mapează
  `choices[0].message.content` la forma normalizată.
- **`src/ai/gemini.py`** — `GeminiProvider`: REST `:generateContent`, traducând
  `system` / `user` / `assistant` în `contents` / `systemInstruction` Gemini;
  `get_models()` din `/v1beta/models`.
- **`src/ai/registry.py`** —
  - Tabelul `PROVIDERS`: id → (clasă, base_url, numele cheii din env, listă
    statică curată de modele).
  - `get_provider(prefs)` — citește `prefs.ai_provider`, rezolvă cheia
    (`prefs.<x>_api_key or os.getenv(...)`), returnează o instanță configurată.
  - `get_models_for(provider_id, prefs)` — fetch dinamic cu fallback static la
    eroare / cheie lipsă.
- **`src/ai/history.py`** — un `ConversationHistory` mic la nivel de aplicație
  (fereastra glisantă de 10 mesaje actuală: `_add_to_history` / `_clear`),
  partajat între cereri. `ai_chat` construiește `messages = [system] + history`
  și adaugă răspunsul — păstrând comportamentul actual de conversație unică
  partajată, inclusiv la schimbarea providerului.

## 2. Modificări în rutele `src/main.py`

- Înlocuim `from ollama.client import ollama_client` cu
  `from ai.registry import get_provider, get_models_for` plus history manager-ul.
- **`ai_chat`**: după construirea `system_context`,
  `provider = get_provider(prefs)`; `if not provider.is_available()` → păstrăm
  ramura actuală ("întoarce rezultatul brut al acțiunii, sau 503"); altfel
  construim mesajele din istoric + apelăm `provider.chat(...)`, apoi adăugăm
  răspunsul în istoric. Fără fallback silențios.
- **`transport_chat`**: aceeași rezolvare `get_provider(prefs)` (păstrează
  `temperature=0.3` propriu și `system_context`-ul de transport; stateless — nu
  are nevoie de istoric partajat).
- **`/api/ai/models`**: acceptă `?provider=<id>` (default = activul); returnează
  `get_models_for(...)`.
- **`/api/ai/status`**: raportează `active_provider`, disponibilitatea, modelul
  curent și care provideri au cheie configurată.
- **`update_preferences`**: **eliminăm** blocul de mutare live a
  `ollama_client.base_url/model` — factory-ul citește acum prefs la fiecare
  cerere.

## 3. Model de date + migrare

- `src/task_manager/models.py`: adăugăm `ai_provider = Column(String(20),
  default='ollama')` și `openrouter_api_key`, `groq_api_key`, `gemini_api_key`,
  `mistral_api_key` (`String(200), default=''`).
- `src/task_manager/database.py` `_migrate_preferences`: intrări `ALTER TABLE`
  corespunzătoare (`ai_provider VARCHAR(20) DEFAULT 'ollama'`, cele patru coloane
  de chei `VARCHAR(200) DEFAULT ''`).
- Expunem toate câmpurile noi în payload-urile JSON din `get_preferences` și
  `update_preferences`.

## 4. Frontend

- `frontend/src/api/types.ts`: adăugăm `ai_provider` + cele patru câmpuri de
  chei în `Preferences`.
- `frontend/src/components/SettingsPanel.vue`: un **`<select>` de provider** care
  afișează condiționat URL-ul Ollama (doar ollama) sau un câmp de API key (doar
  cloud); **dropdown-ul de modele re-fetch-uiește** `/api/ai/models?provider=` la
  schimbarea providerului; o **notă inline de privacy** apare când e selectat un
  provider cloud.
- `frontend/src/i18n/en.ts` / `ro.ts`: chei noi (`lbl_ai_provider`, numele
  providerilor, `lbl_api_key`, `hint_cloud_privacy`, etc.).
- Reutilizăm switch-ul master `aiEnabled` existent, neschimbat.

## 5. Tratarea erorilor

Mapăm erorile HTTP ale providerilor la mesaje prietenoase în interiorul
providerilor (401 → cheie invalidă / lipsă, 429 → rate-limit / cotă depășită,
timeout, model negăsit), expuse la fel ca wrapping-ul Ollama actual.

## 6. Teste

- `tests/test_ai_providers.py`: teste unitare per provider cu `requests` mock-uit
  (normalizarea chat, fetch modele + fallback static, maparea erorilor). Offline
  — fără chei reale.
- Actualizăm `tests/test_ai_api.py`: monkeypatch pe `main.get_provider` în loc de
  `main.ollama_client`; adăugăm un caz `/api/ai/models?provider=`.
- `tests/test_preferences_api.py`: verificăm că noile câmpuri fac round-trip.
- Păstrăm `tests/test_ollama_client.py` verde (logica Ollama mutată, nu ștearsă).

## 7. Documentație + configurare

- `.env.example`: adăugăm `OPENROUTER_API_KEY`, `GROQ_API_KEY`,
  `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `AI_PROVIDER`.
- Acest document plus varianta în engleză înlocuiesc cadrul exclusiv-Ollama din
  `OLLAMA_INTEGRATION.md`.

## Faze de lucru

Fiecare fază poate fi livrată independent și lasă aplicația verde. Se livrează în
ordine — fazele ulterioare depind de cele anterioare.

### Faza 0 — Fundația de persistență ✅ Gata
**Scop:** DB-ul și API-ul pot transporta datele de provider + chei (fără
schimbare de comportament încă).
- Adaugă `ai_provider` + cele patru coloane `*_api_key` în `models.py`.
- Adaugă intrările `ALTER TABLE` corespunzătoare în `_migrate_preferences`
  (`database.py`).
- Expune câmpurile noi în payload-urile `get_preferences` / `update_preferences`.
- Teste: `test_preferences_api.py` face round-trip pe câmpurile noi.
- **Gata când:** preferences citesc/scriu câmpurile noi; migrarea rulează pe un
  DB existent; nimic altceva nu se schimbă.

### Faza 1 — Abstracția de provideri (`src/ai/`) ✅ Gata
**Scop:** un strat de provideri stateless, cu Ollama funcționând prin el.
- `base.py` (protocolul `ChatProvider` + forma normalizată a răspunsului).
- `ollama.py` (mutarea logicii Ollama actuale, stateless).
- `history.py` (istoricul conversației la nivel de aplicație).
- `registry.py` cu `get_provider` / `get_models_for` (deocamdată doar Ollama).
- Teste: `test_ai_providers.py` pentru `OllamaProvider`; păstrăm
  `test_ollama_client.py` verde.
- **Gata când:** pachetul există și Ollama funcționează prin el izolat; rutele
  încă neschimbate.

### Faza 2 — Migrarea rutelor la factory
**Scop:** rutele folosesc abstracția; comportament identic cu azi (doar Ollama).
- `ai_chat` și `transport_chat` rezolvă prin `get_provider(prefs)` + istoric.
- `/api/ai/models` acceptă `?provider=`; `/api/ai/status` raportează providerul
  activ.
- Eliminăm mutarea live `ollama_client.*` din `update_preferences`.
- Teste: actualizăm `test_ai_api.py` să facă monkeypatch pe `main.get_provider`.
- **Gata când:** întreaga suită verde cu Ollama ca singur provider, rutat prin
  factory.

### Faza 3 — Provideri cloud
**Scop:** OpenRouter, Groq, Mistral, Gemini selectabili din backend.
- `openai_compat.py` (OpenRouter / Groq / Mistral) + `gemini.py`.
- Înregistrarea lor în `PROVIDERS` (base URL-uri, chei env, liste statice curate
  de modele).
- `get_models` dinamic + fallback static; mapare prietenoasă a erorilor
  (401/429/...).
- Teste: teste unitare per provider cu `requests` mock-uit, inclusiv fallback.
- **Gata când:** un provider cloud selectat în prefs răspunde la `/api/ai/chat`
  și listează modele, totul sub test cu mock-uri.

### Faza 4 — Frontend
**Scop:** utilizatorii pot alege un provider, introduce o cheie și alege un model.
- `<select>` de provider + câmpuri condiționate URL/API-key în
  `SettingsPanel.vue`.
- Dropdown-ul de modele re-fetch-uiește la schimbarea providerului; notă inline
  de privacy cloud.
- Adăugiri în `types.ts` + `en.ts` / `ro.ts`.
- **Gata când:** schimbarea providerului + modelului din Settings funcționează
  cap-coadă.

### Faza 5 — Documentație și configurare
**Scop:** configurare ușor de descoperit.
- Chei în `.env.example` (`*_API_KEY`, `AI_PROVIDER`).
- Finalizarea acestei perechi de documente; link din `OLLAMA_INTEGRATION.md` și
  din indexul de documentație din README.
- **Gata când:** un utilizator nou poate configura orice provider doar din
  documentație.
