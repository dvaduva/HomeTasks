# HomeTasks

> [English](README.md) · **Română**

> Panou de familie self-hosted pentru Raspberry Pi — taskuri, vreme, radio, transport și un asistent AI vocal, toate într-un singur ecran de tip kiosk.

HomeTasks este o aplicație web (Flask + SPA Vue 3) gândită să ruleze pe un
Raspberry Pi cu ecran tactil, dar funcționează pe orice calculator cu Python
3.9+. Ajută familia să organizeze taskurile zilnice, afișează vremea și
informații de transport, redă posturi de radio și permite conversația cu un
model AI local (Ollama) prin comenzi vocale în **română și engleză**.

## Caracteristici

- **Taskuri** — pe membru de familie, pentru ziua curentă și următoarele 7 zile; comentarii, închidere/refuz, taskuri repetitive (zile fixe din săptămână sau lună)
- **Calendar** — vedere de ansamblu a taskurilor
- **Vreme** — date în timp real (OpenWeatherMap) și temperaturi de la senzori IoT **Tuya**
- **Radio** — gestionare posturi, căutare cu filtrare, redare locală sau **cast către Chromecast / Google Home / boxe Mi**, control prin voce/AI
- **Transport** — informații despre mijloacele de transport
- **Istoric** — activitatea trecută
- **Asistent AI vocal** — conversație cu un model Ollama local prin recunoaștere vocală (RO/EN), cu TTS pentru răspunsuri
- **Audio** — suport Bluetooth A2DP pentru streaming audio local
- **Mod kiosk** — pornire automată în Chromium fullscreen pe Raspberry Pi

## Stack tehnologic

| Strat | Tehnologii |
|-------|-----------|
| Backend | Python, Flask, SQLAlchemy, Gunicorn |
| Frontend | Vue 3 + Vite + Pinia + Vue Router + vue-i18n (SPA) |
| Bază de date | SQLite (implicit) sau PostgreSQL |
| AI | Ollama (ex. `llama3:8b`) |
| Voce | Web Speech API (browser) sau SpeechRecognition + gTTS (server) |
| Integrări | OpenWeatherMap, Tuya Cloud IoT, Google Cast (pychromecast) |

Flask servește bundle-ul SPA construit din `frontend/dist/` și expune API-ul REST
`/api/*`. Vezi [docs/SPA_MIGRATION.ro.md](docs/SPA_MIGRATION.ro.md) pentru detalii
arhitecturale.

## Start rapid

**Prerechizite:** Python 3.9+, Node.js 18+ și npm. (Opțional: Ollama pentru AI.)

```bash
# 1. Clonează și intră în proiect
git clone https://github.com/dvaduva/HomeTasks.git
cd HomeTasks

# 2. Mediu virtual + dependențe Python
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configurare
cp .env.example .env            # editează SECRET_KEY, WEATHER_API_KEY, OLLAMA_HOST etc.

# 4. Build frontend SPA (o singură dată / după fiecare git pull)
cd frontend && npm install && npm run build && cd ..

# 5. Rulează
python src/main.py              # → http://localhost:5000
```

Pentru dezvoltarea frontend-ului (Vite dev server cu hot-reload pe `:5173`):

```bash
cd frontend && npm run dev      # pornește Flask separat: python src/main.py
```

## Documentație

| Document | Conținut |
|----------|----------|
| [docs/INSTALLATION.ro.md](docs/INSTALLATION.ro.md) | Instalare completă pe Raspberry Pi (kiosk, systemd, Node 18, depanare) |
| [docs/USAGE.ro.md](docs/USAGE.ro.md) | Ghid de utilizare |
| [docs/ARCHITECTURE.ro.md](docs/ARCHITECTURE.ro.md) | Arhitectura aplicației |
| [docs/SPA_MIGRATION.ro.md](docs/SPA_MIGRATION.ro.md) | Detalii despre SPA-ul Vue 3 |
| [docs/OLLAMA_INTEGRATION.ro.md](docs/OLLAMA_INTEGRATION.ro.md) | Integrarea cu Ollama |
| [docs/TECHNICAL_SPECS.ro.md](docs/TECHNICAL_SPECS.ro.md) | Specificații tehnice |
| [docs/audio-streaming.ro.md](docs/audio-streaming.ro.md) | Streaming audio (Cast / Bluetooth) |
| [docs/TESTING.ro.md](docs/TESTING.ro.md) | Rularea testelor de backend (pytest) și frontend (Vitest) |

> Fiecare document are și o versiune în engleză alături (`*.md`).

## Licență

MIT — vezi [LICENSE](LICENSE).
