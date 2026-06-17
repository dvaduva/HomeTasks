# HomeTasks

> **English** · [Română](README.ro.md)

> Self-hosted family dashboard for the Raspberry Pi — tasks, weather, radio, transport and a voice AI assistant, all on a single kiosk screen.

HomeTasks is a web app (Flask + Vue 3 SPA) built to run on a Raspberry Pi with a
touchscreen, but it works on any computer with Python 3.9+. It helps a family
organize daily tasks, shows weather and transit info, plays radio stations, and
lets you talk to a local AI model (Ollama) via voice commands in **Romanian and
English**.

## Features

- **Tasks** — per family member, for the current day and the next 7 days; comments, complete/refuse, recurring tasks (fixed weekdays or fixed days of the month)
- **Calendar** — month/year overview of tasks
- **Weather** — real-time data (OpenWeatherMap) and temperatures from **Tuya** IoT sensors
- **Radio** — manage stations, search with filtering, local playback or **cast to Chromecast / Google Home / Mi speakers**, voice/AI control
- **Transport** — public transit information
- **History** — past activity
- **Voice AI assistant** — converse with a local Ollama model via speech recognition (RO/EN), with TTS for responses
- **Audio** — Bluetooth A2DP support for local audio streaming
- **Kiosk mode** — auto-launch fullscreen Chromium on the Raspberry Pi

## Tech stack

| Layer | Technologies |
|-------|-----------|
| Backend | Python, Flask, SQLAlchemy, Gunicorn |
| Frontend | Vue 3 + Vite + Pinia + Vue Router + vue-i18n (SPA) |
| Database | SQLite (default) or PostgreSQL |
| AI | Ollama (e.g. `llama3:8b`) |
| Voice | Web Speech API (browser) or SpeechRecognition + gTTS (server) |
| Integrations | OpenWeatherMap, Tuya Cloud IoT, Google Cast (pychromecast) |

Flask serves the SPA bundle built from `frontend/dist/` and exposes the REST API
under `/api/*`. See [docs/SPA_MIGRATION.md](docs/SPA_MIGRATION.md) for architectural
details.

## Quick start

**Prerequisites:** Python 3.9+, Node.js 18+ and npm. (Optional: Ollama for AI.)

```bash
# 1. Clone and enter the project
git clone https://github.com/dvaduva/HomeTasks.git
cd HomeTasks

# 2. Virtual environment + Python dependencies
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configuration
cp .env.example .env            # edit SECRET_KEY, WEATHER_API_KEY, OLLAMA_HOST, etc.

# 4. Build the SPA frontend (once / after every git pull)
cd frontend && npm install && npm run build && cd ..

# 5. Run
python src/main.py              # → http://localhost:5000
```

For frontend development (Vite dev server with hot-reload on `:5173`):

```bash
cd frontend && npm run dev      # start Flask separately: python src/main.py
```

## Documentation

| Document | Contents |
|----------|----------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Full Raspberry Pi installation (kiosk, systemd, Node 18, troubleshooting) |
| [docs/USAGE.md](docs/USAGE.md) | Usage guide |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Application architecture |
| [docs/SPA_MIGRATION.md](docs/SPA_MIGRATION.md) | Vue 3 SPA migration details |
| [docs/OLLAMA_INTEGRATION.md](docs/OLLAMA_INTEGRATION.md) | Ollama integration |
| [docs/TECHNICAL_SPECS.md](docs/TECHNICAL_SPECS.md) | Technical specifications |
| [docs/audio-streaming.md](docs/audio-streaming.md) | Audio streaming (Cast / Bluetooth) |
| [docs/TESTING.md](docs/TESTING.md) | Running the backend (pytest) and frontend (Vitest) tests |

> Each document has a Romanian version alongside it (`*.ro.md`).

## License

MIT — see [LICENSE](LICENSE).
