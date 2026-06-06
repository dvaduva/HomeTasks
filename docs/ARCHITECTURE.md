# HomeTasks application architecture (Web)

> **English** · [Română](ARCHITECTURE.ro.md)

## Architecture diagram

```
+----------------------+     +------------------+     +----------------------+
|                      |     |                  |     |                      |
|   SPA Frontend       |<--->|   Flask Backend  |<--->|   Data Model         |
|   (Vue 3 + Vite      |     |   (REST + static |     |   (SQLite)           |
|    + Pinia + Router) |     |    SPA bundle)   |     |                      |
+----------------------+     +------------------+     +----------------------+
          ^                         ^                         ^
          |                         |                         |
          |                         |                         |
+----------------------+     +------------------+     +----------------------+
|                      |     |                  |     |                      |
|  Weather Module      |     |  Ollama Module   |     |  Voice Module        |
|  (weather API)       |     |  (local AI)      |     |  (Speech-to-Text)    |
|                      |     |                  |     |                      |
+----------------------+     +------------------+     +----------------------+
```

## Component description

### 1. SPA Frontend (Vue 3)
- **Purpose**: The user interface delivered as a Single Page Application;
  navigating between views no longer triggers a reload, so radio playback, the
  voice controller and the AI chat keep their state across "page" changes.
- **Technologies**: Vue 3 (`<script setup>` + SFC), Vite, TypeScript, Pinia
  (global state), Vue Router (client-side routing with per-route code-splitting),
  Vue I18n (ro/en). Source code: [`frontend/src/`](../frontend/src/).
- **Views**: `DashboardView`, `CalendarView`, `RadioView`, `TransportView`,
  `HistoryView` — each is loaded dynamically (`import()`), so it reaches the
  client as a separate chunk.
- **Persistent components** (mounted in `App.vue`, outside the `<RouterView>`):
  `RadioMiniPlayer.vue` (driven by the `radio` store, singleton audio element)
  and `VoiceController.vue` (wake word + Web Speech API + fallback to server-side
  STT/TTS).
- **Build**: `npm run build` produces `frontend/dist/`, with hashed chunks and
  precompressed `.br`/`.gz` variants (vite-plugin-compression).
- **Responsibilities**:
  - Displaying the tasks for the current day and the next 7 days
  - Displaying current weather information and the forecast
  - Client-side voice recognition through the Web Speech API
  - Communicating with the REST API through a central client (`api/client.ts`)
  - Responsiveness for access from mobile devices and tablets

### 2. Backend Server (Flask)
- **Purpose**: Exposes the REST API and serves the SPA bundle. It no longer uses
  Jinja templates — all the presentation logic is in the client.
- **Technologies**: Python 3.9+ with Flask. Entry point: [`src/main.py`](../src/main.py).
- **Responsibilities**:
  - Serving `frontend/dist/index.html` as the SPA shell (with `Cache-Control:
    no-cache` to avoid stale chunk hashes)
  - Serving the hashed assets from `frontend/dist/assets/`, automatically choosing
    the `.br`/`.gz` variant based on `Accept-Encoding`
  - 404 fallback → `index.html` for any non-`/api/` path, so that refreshing on
    client-side routes (`/calendar`, `/radio`, …) works
  - Receiving HTTP requests from the frontend and routing them to the
    corresponding modules (weather, Ollama, voice, Tuya, radio, transport, calendar)
  - Handling errors and returning appropriate JSON responses
  - Exposing the `/api/*` REST APIs for communication with the SPA

### 3. Data Model (SQLite)
- **Purpose**: Persistent storage of the application's data
- **Technology**: SQLite with the SQLAlchemy ORM (or sqlite3 directly for simplicity)
- **Main tables**:
  - `users`: Information about family members (name, preferences, etc.)
  - `tasks`: Tasks with details (description, date, assigned user, status, etc.)
  - `comments`: Comments attached to tasks
  - `preferences`: The application settings per user (language, notifications, etc.)

### 4. Weather Module
- **Purpose**: Fetching and processing weather information
- **Technology**: The requests library for HTTP calls to weather APIs
- **Functionality**:
  - Fetching the current weather for the configured location
  - Fetching the 7-day forecast
  - Transforming the received data into a format usable by the application
  - Temporary caching to reduce the number of API requests
  - Handling connection errors and rate limits

### 5. Ollama Module
- **Purpose**: Communicating with the local AI model running on the Ollama server
- **Technology**: The requests library for HTTP calls to the Ollama API (localhost:11434)
- **Functionality**:
  - Sending text queries to the AI model
  - Receiving and processing the model's responses
  - Managing conversations (maintaining context)
  - Timeouts and retry mechanisms for failed requests
  - Compressing the context to avoid exceeding token limits

### 6. Voice Module (optional - server-side)
- **Purpose**: Converting speech to text (only if implemented on the server)
- **Technologies** (only for the optional server-side implementation):
  - SpeechRecognition for speech-to-text
  - PyAudio for accessing the audio hardware (only on the server)
- **Functionality** (only for server-side):
  - Listening continuously for the activation command (wakeword) or push-to-talk mode
  - Recognizing speech in Romanian and English
  - Filtering background noise
  - Converting the text into an actionable command for the controller
  - Optionally: speech synthesis for AI responses

> **Note**: For most deployments, voice recognition is performed client-side through the browser's Web Speech API, removing the need for this module on the server.

## Key data flows

### Adding a new task through the frontend
1. The user fills in the form in the browser and presses "Add task"
2. The frontend sends a POST request to `/api/tasks` via JavaScript (fetch/AJAX)
3. The backend receives the request and routes it to the task_manager
4. The task_manager validates the data and sends it to the data model for saving
5. The data model saves the task in the SQLite database
6. The backend returns a JSON response with the created task or an error
7. The frontend updates the task list via JavaScript without reloading the page

### Adding a new task through a client-side voice command
1. The user activates voice recognition through a button or wakeword in the browser
2. The browser captures the audio and converts it to text using the Web Speech API
3. The text is sent to the backend through a POST request to `/api/voice-command`
4. The backend receives the request and routes it to the main controller
5. The controller determines whether it is a system command or an AI query
6. If it is an AI query, the controller sends the text to the Ollama module
7. The Ollama module makes a request to the local Ollama server and receives the response
8. The response is returned to the frontend for display
9. Optionally: the frontend uses the Web Speech API for text-to-speech of the response

### Updating weather information
1. At regular intervals (for example, every 30 minutes) or at application startup
2. The backend asks the weather module to fetch the updated data
3. The weather module makes a request to the weather service's API
4. The received data is processed and transformed into the internal format
5. The backend updates the data model with the new weather information
6. The frontend receives the update through polling or WebSocket and re-renders the weather section

### Real-time updates (optional, with WebSockets)
1. If WebSockets are implemented, the frontend opens a connection to `/ws`
2. When the data changes in the backend (task added, weather updated, etc.)
3. The backend sends a WebSocket message to all connected clients
4. The frontend receives the message and updates the interface accordingly

## Design patterns used

### Client-server architecture (REST)
- A clear separation of concerns between the frontend (presentation) and the backend (logic and data)
- Communication through standardized REST APIs
- Facilitates independent development of the frontend and backend

### Client/server separation (SPA + REST)
- **Model**: The SQLite database and the entity classes (user, task, etc.)
  exposed through SQLAlchemy
- **View**: Vue components (SFC `.vue`) + client-side Pinia stores; there are no
  longer any server-rendered templates
- **Controller**: The Flask `/api/*` routes that handle HTTP requests and
  orchestrate the backend services

### Dependency Injection
- Modules receive their dependencies through the constructor or setter methods
- Facilitates mocking in tests and swapping implementations (e.g. different weather providers)

### Observer Pattern (through WebSockets or polling)
- The frontend subscribes to data changes through WebSocket or polling
- Allows automatic updates when the underlying data changes

### Singleton (limited)
- Some services such as the database connection manager may use the singleton pattern
- Ensures a single instance per application for resources that are expensive to create

## Security and isolation

### Data privacy
- All personal data (tasks, comments) remains stored locally on the server device
- No personal data is sent to external services without explicit consent
- Only the geographic coordinates that are necessary are transmitted to the weather service

### Module isolation
- Each module has a well-defined interface and communicates through the backend
- Errors in one module do not propagate uncontrolled into other modules
- The ability to replace or disable individual modules without affecting the rest of the application

## Sequence diagram for adding a task through the frontend

```
User (Browser)          Backend Server     Data Model      Ollama (optional)
        |                      |                  |               |
        |--- Click "Add task" ---|               |               |
        |                      |                  |               |
        |--- POST /api/tasks {data} ------------>|               |
        |                      |                  |               |
        |                      |--- Validate data --------------->|
        |                      |                  |               |
        |                      |<--- Data valid ------------------|               |
        |                      |                  |               |
        |                      |--- Save task in DB ------------->|
        |                      |                  |               |
        |                      |<----- Task ID -------|           |
        |                      |                  |               |
        |                      |--- Response 201 {task} --------->|
        |                      |                  |               |
        |<---------- Response 201 {task} ---------|               |
        |                      |                  |               |
        |--- Update task list (JS) -------------->|               |
```

## Sequence diagram for a client-side voice command with AI

```
User (Browser)          Backend Server      Ollama
        |                      |                  |
        |--- Click mic ---------|                  |
        |                      |                  |
        |--- Speak: "What tasks does Maria have?" --->|
        |                      |                  |
        |                      |--- Send to Ollama ------------------->
        |                      |                  |
        |                      |<----- AI response ------------------
        |                      |                  |
        |                      |--- Response {text} ------------------>
        |                      |                  |
        |<---------- Response {text} -----------|                  |
        |                      |                  |
        |--- (Optional) TTS: "Maria needs to buy milk" --------------|
```

## Alternative technologies and frameworks

### Frontend options
- **Vue 3 + Vite + Pinia + Vue Router** (current choice): small bundle (~88 KB
  gzip), easy-to-read SFCs, simple reactivity, ideal for the RPi kiosk
- **React + Vite + Zustand + React Router**: a viable alternative, larger
  ecosystem, slightly bigger bundle
- **Svelte/SvelteKit**: the smallest bundle, smaller ecosystem
- **HTMX / Alpine.js** + Jinja: progressive-enhancement options; they would have
  required going back to an MPA, abandoned when migrating to the SPA

### Backend options
- **Flask**: The simplest and most flexible, good for prototyping and small applications
- **FastAPI**: Faster, with automatic OpenAPI/Swagger documentation, supports async natively
- **Django**: A complete framework with a built-in admin, potentially overkill for this application

### Voice recognition options
- **Web Speech API (browser)**: A client-side implementation, works in Chrome, Edge, Safari (with limits), requires HTTPS or localhost
- **SpeechRecognition (Python)**: A server-side implementation, requires a microphone on the server, works offline with Vosk or online with the Google API
- **Whisper.cpp**: A state-of-the-art model for voice recognition, moderate resource usage, works offline

### Data storage options
- **SQLite**: The default choice for simplicity and zero configuration, perfect for the Raspberry Pi
- **PostgreSQL**: For applications that require more concurrency or advanced features
- **TinyDB**: A document-oriented alternative, good for small datasets

## Performance considerations

### Threading and concurrency
- Network operations (weather, Ollama) run in separate threads or use async (in FastAPI) so as not to block HTTP requests
- Frontend updates are done through asynchronous JavaScript so as not to block the user interface

### Memory management
- Limited cache for weather predictions (maximum 1-2 hours)
- AI conversation history limited to the last N interactions to prevent excessive memory usage
- Periodic processing of old tasks (for example, tasks older than 30 days are archived or deleted)

### Frontend optimization
- Vite minifies JS/CSS (esbuild) and does tree-shaking out of the box
- Per-route code-splitting through dynamic `import()` in the router (one chunk per view)
- `.br` and `.gz` precompression with `vite-plugin-compression` — Flask chooses the
  appropriate variant from `Accept-Encoding`
- Hashed assets with infinite cache (`/assets/*`); only `index.html` is served
  with `no-cache` so we don't stay on stale chunk hashes after a rebuild
- Reactive updates through Pinia + Vue (fine DOM diff, not a page reload)

### Backend optimization
- Pagination for long task lists
- Appropriate indexing in the database for fast queries
- HTTP compression for responses
- Caching of frequent responses (e.g. the weather forecast) to reduce the number of external API requests
