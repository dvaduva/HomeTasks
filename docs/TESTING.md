# Testing guide - HomeTasks

> **English** · [Română](TESTING.ro.md)

This document explains how the automated tests are organized and how to run them
for both the **backend** (Python / Flask) and the **frontend** (Vue 3 / Vite).

## Overview

| Layer | Framework | Location | Run from |
|-------|-----------|----------|----------|
| Backend | [pytest](https://pytest.org) + `pytest-cov` | `tests/` | repo root |
| Frontend | [Vitest](https://vitest.dev) + `@vue/test-utils` | `frontend/src/**/*.test.ts` | `frontend/` |

Both suites are fast (a few seconds each) and fully **offline**: every external
dependency — HTTP APIs, the Ollama server, Tuya Cloud, Chromecast/`pychromecast`,
BlueZ Bluetooth, NetworkManager, the browser `fetch`/`Audio`/Web Speech APIs — is
mocked or stubbed. No network, no hardware, and no real database are required.

---

## Backend (pytest)

The backend tests cover the Flask REST API routes (`src/main.py`) and the service
modules (`weather`, `ollama`, `tuya`, `cast`, `voice`, `wifi`, `bt`,
`task_manager`).

### Prerequisites

Install the dependencies (ideally inside the project virtualenv). `pytest` and
`pytest-cov` are already listed in `requirements.txt`:

```bash
# from the repo root
python -m venv venv            # first time only
source venv/Scripts/activate   # Windows (Git Bash);  use venv/bin/activate on Linux/macOS
pip install -r requirements.txt
```

### Running the tests

```bash
# all tests, verbose (config lives in pytest.ini)
python -m pytest

# a single file
python -m pytest tests/test_tasks_api.py

# a single test by name
python -m pytest tests/test_tasks_api.py -k test_create_task

# quiet, stop at first failure
python -m pytest -q -x
```

`pytest.ini` already sets `testpaths = tests`, the `test_*.py` / `Test*` /
`test_*` discovery rules and `-v --tb=short`, so a bare `python -m pytest` is
usually all you need.

### Coverage

```bash
# terminal report with the uncovered line numbers
python -m pytest --cov=src --cov-report=term-missing

# HTML report (writes to ./htmlcov/index.html)
python -m pytest --cov=src --cov-report=html
```

### How the backend tests are structured

```
tests/
├── conftest.py              # shared fixtures: app, client, initial_user
├── test_tasks_api.py        # route tests  /api/tasks/*
├── test_users_api.py        #              /api/users/*
├── test_comments_api.py     #              /api/tasks/<id>/comments
├── test_preferences_api.py  #              /api/preferences
├── test_calendar_api.py     #              /api/calendar/*
├── test_weather_api.py      #              /api/weather/*
├── test_ai_api.py           #              /api/ai/*
├── test_radio_api.py        #              /api/radio/*
├── test_cast_api.py         #              /api/cast/*
├── test_tuya_api.py         #              /api/tuya/*
├── test_transport_api.py    #              /api/transport/*
├── test_bt_api.py           #              /api/output/bt/*
├── test_wifi_api.py         #              /api/wifi/*
├── test_voice_command_api.py
├── test_weather_service.py  # unit tests for WeatherService
├── test_ollama_client.py    #               OllamaClient
├── test_tuya_service.py     #               TuyaService
├── test_cast_service.py     #               CastService
├── test_voice_service.py    #               VoiceService
├── test_wifi_service.py     #               WiFiService
└── test_bt_service.py       #               BluetoothService
```

### Conventions

- **Fixtures** (`tests/conftest.py`) set test env vars *before* importing the app,
  build the Flask `app`/`client`, and use an in-memory SQLite database
  (`DATABASE_URL=sqlite:///:memory:`). Use the `client` fixture for route tests.
- **Route tests** stub the service singletons that the route imports, e.g.
  `monkeypatch.setattr(main.weather_service, 'get_current_weather', ...)`. This
  keeps real HTTP/SDK calls out of the test while still exercising the route's
  validation, status codes and JSON shaping.
- **Service unit tests** patch the underlying library directly, e.g.
  `monkeypatch.setattr(weather.service.requests, 'get', fake_get)` or replace the
  `tinytuya` module via `monkeypatch.setitem(sys.modules, 'tinytuya', fake)`.
- Stations/calendar tests run against the real in-memory DB and create their own
  rows, so they don't depend on seed data or test ordering.

---

## Frontend (Vitest)

The frontend tests cover the API client and modules (`src/api`), the Pinia stores
(`src/stores`), the composables (`src/composables`), the components
(`src/components`) and some views (`src/views`).

### Prerequisites

```bash
cd frontend
npm install      # installs Vitest, @vue/test-utils, jsdom, @pinia/testing, @vitest/coverage-v8
```

### Running the tests

```bash
cd frontend

npm test                 # run once (vitest run)
npm run test:watch       # watch mode — re-runs on file change
npm run test:coverage    # run once with a coverage report

# a single file
npx vitest run src/stores/tasks.test.ts

# tests whose name matches a pattern
npx vitest run -t "filters stations"
```

Test config lives in `frontend/vitest.config.ts` (separate from `vite.config.ts`
so the gzip/brotli build plugins don't run under tests). It sets the `jsdom`
environment, enables `globals`, mirrors the `@` → `src` alias, and includes
`src/**/*.{test,spec}.ts`.

### How the frontend tests are structured

Tests live **next to the code** they cover, with a `.test.ts` suffix:

```
frontend/src/
├── test/mountWithPlugins.ts     # shared helper: mounts a component with Pinia + vue-i18n
├── api/
│   ├── client.test.ts           # the fetch wrapper (error handling, query, 204)
│   └── modules.test.ts          # every api module's URL/method/body/query
├── stores/
│   ├── tasks.test.ts  users.test.ts  preferences.test.ts
│   ├── weather.test.ts  tuya.test.ts  ai.test.ts  radio.test.ts
├── composables/
│   ├── useDateTime.test.ts  useNotification.test.ts  usePolling.test.ts
├── components/
│   ├── TaskCard / TaskList / TaskModal / CommentsModal / ToastHost / UserBar
│   ├── WeatherWidget / TuyaPanel / WiFiManager / BluetoothManager
│   ├── RadioMiniPlayer / RadioStationsManager / VoiceController / SettingsPanel
└── views/
    ├── DashboardView.test.ts  HistoryView.test.ts  RadioView.test.ts
```

### Conventions

- **Mounting** — use the `mountWithPlugins()` helper from
  [`src/test/mountWithPlugins.ts`](../frontend/src/test/mountWithPlugins.ts). It
  creates a fresh Pinia and a real `vue-i18n` instance (with the app's messages),
  so `$t` / `useI18n()` resolve to real strings.
- **Mock the API layer** — stores and components mock their `@/api/*` module with
  `vi.mock(...)` and resolve fakes; no real `fetch` runs. The `api/modules.test.ts`
  file is the exception: it runs the *real* modules with only `fetch` stubbed to
  pin down the request contract.
- **Browser APIs** — `Audio` is stubbed (jsdom has no media playback); `fetch` is
  stubbed via `vi.stubGlobal('fetch', …)`; the Web Speech API is simply absent in
  jsdom, which drives `VoiceController` down its server-mic path.
- **Async flushing** — for `onMounted`/`watch` chains use `flushPromises()` from
  `@vue/test-utils`; for timers use `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(...)`.
- **Non-immediate watches** — components whose `open` watch isn't `immediate`
  (e.g. `BluetoothManager`, `SettingsPanel`) must be mounted closed and then
  toggled open via `wrapper.setProps({ open: true })` to trigger the side effects.
- **`vi.mock` is hoisted** — its factory runs above top-level `const`s, so inline
  any data the factory needs (don't reference an outer variable).

### A note on coverage

`npm run test:coverage` writes an HTML report to `frontend/coverage/`. That folder
is git-ignored. The remaining low-coverage areas are the two largest views,
`CalendarView.vue` and `TransportView.vue`, which are mostly presentational.

---

## Quick reference

```bash
# Backend — from repo root
python -m pytest                                   # run all
python -m pytest --cov=src --cov-report=term-missing

# Frontend — from frontend/
npm test                                           # run all
npm run test:coverage
```
