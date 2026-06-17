# Ghid de testare - HomeTasks

> [English](TESTING.md) · **Română**

Acest document explică cum sunt organizate testele automate și cum se rulează,
atât pentru **backend** (Python / Flask), cât și pentru **frontend** (Vue 3 / Vite).

## Privire de ansamblu

| Strat | Framework | Locație | Se rulează din |
|-------|-----------|---------|----------------|
| Backend | [pytest](https://pytest.org) + `pytest-cov` | `tests/` | rădăcina repo-ului |
| Frontend | [Vitest](https://vitest.dev) + `@vue/test-utils` | `frontend/src/**/*.test.ts` | `frontend/` |

Ambele seturi de teste sunt rapide (câteva secunde fiecare) și complet
**offline**: orice dependență externă — API-uri HTTP, serverul Ollama, Tuya Cloud,
Chromecast/`pychromecast`, Bluetooth BlueZ, NetworkManager, API-urile de browser
`fetch`/`Audio`/Web Speech — este mock-uită sau stubuită. Nu e nevoie de rețea,
de hardware sau de o bază de date reală.

---

## Backend (pytest)

Testele de backend acoperă rutele REST din Flask (`src/main.py`) și modulele de
serviciu (`weather`, `ollama`, `tuya`, `cast`, `voice`, `wifi`, `bt`,
`task_manager`).

### Cerințe preliminare

Instalează dependențele (ideal în virtualenv-ul proiectului). `pytest` și
`pytest-cov` sunt deja în `requirements.txt`:

```bash
# din rădăcina repo-ului
python -m venv venv            # doar prima dată
source venv/Scripts/activate   # Windows (Git Bash);  pe Linux/macOS: venv/bin/activate
pip install -r requirements.txt
```

### Rularea testelor

```bash
# toate testele, verbose (configurarea e în pytest.ini)
python -m pytest

# un singur fișier
python -m pytest tests/test_tasks_api.py

# un singur test, după nume
python -m pytest tests/test_tasks_api.py -k test_create_task

# silențios, oprire la prima eroare
python -m pytest -q -x
```

`pytest.ini` setează deja `testpaths = tests`, regulile de descoperire
`test_*.py` / `Test*` / `test_*` și `-v --tb=short`, deci de obicei un simplu
`python -m pytest` este suficient.

### Coverage

```bash
# raport în terminal cu liniile neacoperite
python -m pytest --cov=src --cov-report=term-missing

# raport HTML (scrie în ./htmlcov/index.html)
python -m pytest --cov=src --cov-report=html
```

### Cum sunt structurate testele de backend

```
tests/
├── conftest.py              # fixture-uri comune: app, client, initial_user
├── test_tasks_api.py        # teste de rute  /api/tasks/*
├── test_users_api.py        #                /api/users/*
├── test_comments_api.py     #                /api/tasks/<id>/comments
├── test_preferences_api.py  #                /api/preferences
├── test_calendar_api.py     #                /api/calendar/*
├── test_weather_api.py      #                /api/weather/*
├── test_ai_api.py           #                /api/ai/*
├── test_radio_api.py        #                /api/radio/*
├── test_cast_api.py         #                /api/cast/*
├── test_tuya_api.py         #                /api/tuya/*
├── test_transport_api.py    #                /api/transport/*
├── test_bt_api.py           #                /api/output/bt/*
├── test_wifi_api.py         #                /api/wifi/*
├── test_voice_command_api.py
├── test_weather_service.py  # teste unitare pentru WeatherService
├── test_ollama_client.py    #                    OllamaClient
├── test_tuya_service.py     #                    TuyaService
├── test_cast_service.py     #                    CastService
├── test_voice_service.py    #                    VoiceService
├── test_wifi_service.py     #                    WiFiService
└── test_bt_service.py       #                    BluetoothService
```

### Convenții

- **Fixture-urile** (`tests/conftest.py`) setează variabilele de mediu pentru teste
  *înainte* de importul aplicației, construiesc `app`/`client` din Flask și
  folosesc o bază de date SQLite în memorie (`DATABASE_URL=sqlite:///:memory:`).
  Folosește fixture-ul `client` pentru testele de rute.
- **Testele de rute** stubuiesc singleton-urile de serviciu importate în rută, de
  ex. `monkeypatch.setattr(main.weather_service, 'get_current_weather', ...)`.
  Astfel apelurile reale HTTP/SDK rămân în afara testului, dar se verifică
  validarea, codurile de status și forma JSON a rutei.
- **Testele unitare de serviciu** patch-uiesc direct librăria din spate, de ex.
  `monkeypatch.setattr(weather.service.requests, 'get', fake_get)` sau înlocuiesc
  modulul `tinytuya` prin `monkeypatch.setitem(sys.modules, 'tinytuya', fake)`.
- Testele de stații/calendar rulează pe baza de date reală din memorie și își
  creează propriile rânduri, deci nu depind de datele seed sau de ordinea testelor.

---

## Frontend (Vitest)

Testele de frontend acoperă clientul și modulele de API (`src/api`), store-urile
Pinia (`src/stores`), composables (`src/composables`), componentele
(`src/components`) și o parte din view-uri (`src/views`).

### Cerințe preliminare

```bash
cd frontend
npm install      # instalează Vitest, @vue/test-utils, jsdom, @pinia/testing, @vitest/coverage-v8
```

### Rularea testelor

```bash
cd frontend

npm test                 # rulare unică (vitest run)
npm run test:watch       # mod watch — re-rulează la modificarea fișierelor
npm run test:coverage    # rulare unică cu raport de coverage

# un singur fișier
npx vitest run src/stores/tasks.test.ts

# teste al căror nume corespunde unui pattern
npx vitest run -t "filters stations"
```

Configurarea testelor e în `frontend/vitest.config.ts` (separată de
`vite.config.ts`, ca să nu ruleze plugin-urile de build gzip/brotli în teste).
Setează mediul `jsdom`, activează `globals`, replică alias-ul `@` → `src` și
include `src/**/*.{test,spec}.ts`.

### Cum sunt structurate testele de frontend

Testele stau **lângă codul** pe care îl acoperă, cu sufixul `.test.ts`:

```
frontend/src/
├── test/mountWithPlugins.ts     # helper comun: montează o componentă cu Pinia + vue-i18n
├── api/
│   ├── client.test.ts           # wrapper-ul fetch (erori, query, 204)
│   └── modules.test.ts          # URL/metodă/body/query pentru fiecare modul de API
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

### Convenții

- **Montarea** — folosește helper-ul `mountWithPlugins()` din
  [`src/test/mountWithPlugins.ts`](../frontend/src/test/mountWithPlugins.ts). Creează
  o instanță Pinia proaspătă și o instanță reală `vue-i18n` (cu mesajele
  aplicației), deci `$t` / `useI18n()` rezolvă string-uri reale.
- **Mock pe stratul de API** — store-urile și componentele mock-uiesc modulul lor
  `@/api/*` cu `vi.mock(...)` și rezolvă fake-uri; niciun `fetch` real nu rulează.
  Excepția e fișierul `api/modules.test.ts`: rulează modulele *reale* cu doar
  `fetch` stubuit, ca să fixeze contractul cererii.
- **API-uri de browser** — `Audio` este stubuit (jsdom nu are redare media);
  `fetch` se stubuiește cu `vi.stubGlobal('fetch', …)`; Web Speech API pur și
  simplu lipsește în jsdom, ceea ce duce `VoiceController` pe calea cu microfon pe
  server.
- **Flush async** — pentru lanțurile `onMounted`/`watch` folosește `flushPromises()`
  din `@vue/test-utils`; pentru timere `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(...)`.
- **Watch-uri ne-`immediate`** — componentele al căror watch pe `open` nu e
  `immediate` (ex. `BluetoothManager`, `SettingsPanel`) trebuie montate închise și
  apoi deschise prin `wrapper.setProps({ open: true })` ca să declanșeze efectele.
- **`vi.mock` este hoisted** — factory-ul rulează deasupra `const`-urilor de la
  nivel superior, deci inline-uiește orice date de care are nevoie (nu referenția o
  variabilă din exterior).

### Despre coverage

`npm run test:coverage` scrie un raport HTML în `frontend/coverage/`. Acel folder
este ignorat de git. Zonele rămase cu coverage scăzut sunt cele mai mari două
view-uri, `CalendarView.vue` și `TransportView.vue`, în mare parte prezentaționale.

---

## Referință rapidă

```bash
# Backend — din rădăcina repo-ului
python -m pytest                                   # rulează tot
python -m pytest --cov=src --cov-report=term-missing

# Frontend — din frontend/
npm test                                           # rulează tot
npm run test:coverage
```
