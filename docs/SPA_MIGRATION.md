# HomeTasks SPA migration plan

> **English** · [Română](SPA_MIGRATION.ro.md)

A planning document for the transition of the HomeTasks application from a Flask + Jinja + vanilla JS multi-page application to a **Single Page Application** (SPA) that consumes the existing REST API.

---

## 1. Current state of the application

### 1.1 Current architecture (MPA)

The application is currently a server-rendered **multi-page** application:

| Component | Detail |
|---|---|
| Backend | Flask (Python) — [src/main.py](../src/main.py) |
| Persistence | SQLAlchemy + SQLite — [src/task_manager/](../src/task_manager/) |
| Services | weather, ollama, voice, tuya — [src/](../src/) |
| Templating | Jinja2 — templates/ |
| Frontend | HTML + CSS + vanilla JS — static/ |

### 1.2 Current server-rendered pages

| Route | Template | Specific JS | Functionality |
|---|---|---|---|
| `/` | base.html | main.js (~3300 lines) | Tasks dashboard, users, weather, AI chat, voice, Tuya |
| `/calendar` | calendar.html | calendar.js | Month/year calendar |
| `/radio` | radio.html | radio.js | Radio player |
| `/transport` | transport.html | transport.js | Bus schedules |
| `/history` | history.html | history.js | Task history |

### 1.3 Available REST API

The backend already exposes a complete REST API — an ideal starting point for the SPA:

- **Users**: `GET/POST /api/users`, `GET/PUT/DELETE /api/users/<id>`
- **Tasks**: `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/<id>`, `/api/tasks/today`, `/api/tasks/upcoming`
- **Comments**: `GET/POST /api/tasks/<id>/comments`
- **Preferences**: `GET/PUT /api/preferences`
- **Weather**: `/api/weather/current`, `/api/weather/forecast`
- **AI**: `/api/ai/chat`, `/api/ai/models`, `/api/ai/status`
- **Voice**: `/api/voice/listen`, `/api/voice/speak`, `/api/voice/server-available`, `/api/voice-command`, `/api/voice-debug-log`
- **Tuya**: `/api/tuya/temperatures`, `/api/tuya/refresh`
- **Transport**: `/api/transport/routes`, `/api/transport/chat`
- **Radio**: `/api/radio/stations`, `/api/radio/proxy/<id>`, `/api/radio/now-playing`
- **Calendar**: `/api/calendar/month`, `/api/calendar/year`

### 1.4 Limitations of the current architecture

- **Full reload navigation** between pages (calendar, radio, transport, history) — interrupts the mini radio player, resets the voice state, restarts polling.
- **Duplicated JS code**: i18n, modal handling, fetch helpers are replicated across several files.
- **No centralized state management** — each page re-reads users/preferences on every reload.
- **Monolithic JS bundle** (main.js is ~3300 lines).
- **No type safety**, no build pipeline, no hot reload in development.

---

## 2. Migration goals

1. **Reload-free navigation** — preserving the radio player, voice, and AI chat state when changing "pages".
2. **Componentization** — extracting reusable elements (task card, modal, comment list, etc.).
3. **Global state** — a single store for users, preferences, active users, tasks.
4. **Client-side routing** — URLs identical to the current ones (`/calendar`, `/radio`, …) to preserve bookmarks and kiosk mode.
5. **The backend API stays unchanged** — Flask becomes just an API + SPA bundle server.
6. **Modern build pipeline** (Vite) with hot reload, code splitting, minification.
7. **Raspberry Pi kiosk compatibility** (Chromium on ARM) — small bundle, no heavy dependencies.

---

## 3. Choosing the stack

### 3.1 Recommendation: **Vue 3 + Vite + Pinia + Vue Router**

| Argument | Detail |
|---|---|
| Small learning curve | The template syntax is similar to Jinja, easy to adopt coming from vanilla JS. |
| Small bundle | ~35 KB gzip — important for the RPi kiosk. |
| Simple reactivity | Less "mental overhead" than React/Redux. |
| Mature ecosystem | Pinia (store), Vue Router, Vue I18n cover everything needed. |
| `.vue` SFC | HTML + JS + CSS in a single file per component — close to how the code is structured now. |

### 3.2 Alternatives considered

- **React + Vite + Zustand + React Router** — viable if the team prefers React. Slightly larger bundle.
- **Svelte/SvelteKit** — the smallest bundle, but a smaller ecosystem.
- **Vanilla + history API + custom components** — minimal, but reinvents many things.

### 3.3 Proposed dependencies

```
vue@^3.4
vue-router@^4
pinia@^2
vue-i18n@^9
@vitejs/plugin-vue
vite
```

Optional for DX:
- TypeScript (recommended for ~6000 lines of code)
- ESLint + Prettier
- Vitest (component testing)

---

## 4. Proposed project structure

```
frontend/                          # NEW — SPA root
├── index.html                     # entry point (replaces base.html)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.ts                    # bootstrap Vue + Pinia + Router + i18n
    ├── App.vue                    # main layout (header, user-bar, main, footer)
    ├── router/
    │   └── index.ts               # routes: /, /calendar, /radio, /transport, /history
    ├── stores/                    # Pinia
    │   ├── users.ts
    │   ├── tasks.ts
    │   ├── preferences.ts
    │   ├── weather.ts
    │   ├── radio.ts               # persists across navigation!
    │   ├── voice.ts
    │   └── ai.ts
    ├── api/                       # centralized HTTP client
    │   ├── client.ts              # fetch wrapper + error handler
    │   ├── tasks.ts
    │   ├── users.ts
    │   ├── weather.ts
    │   └── ...
    ├── i18n/
    │   ├── index.ts
    │   ├── ro.ts                  # migrated from TRANSLATIONS in main.js
    │   └── en.ts
    ├── components/                # reusable components
    │   ├── TaskCard.vue
    │   ├── TaskModal.vue
    │   ├── CommentsModal.vue
    │   ├── UserChip.vue
    │   ├── WeatherWidget.vue
    │   ├── ConfirmDialog.vue
    │   ├── SettingsPanel.vue
    │   ├── AiChat.vue
    │   ├── VoiceController.vue    # recognition/TTS logic
    │   ├── RadioMiniPlayer.vue    # persistent mini player
    │   └── TuyaPanel.vue
    ├── views/                     # "pages"
    │   ├── DashboardView.vue      # ex-base.html
    │   ├── CalendarView.vue
    │   ├── RadioView.vue
    │   ├── TransportView.vue
    │   └── HistoryView.vue
    ├── composables/               # reusable hooks
    │   ├── useDateTime.ts
    │   ├── useNotification.ts
    │   └── usePolling.ts
    └── assets/
        ├── css/                   # migrated from static/css/
        └── icons/
```

The backend stays structurally unchanged — the only change is:
- Serving the built SPA bundle (`frontend/dist/`) as static files + a fallback to `index.html` for client-side routes.

---

## 5. Implementation phases

### Phase 0 — Preparation (½ day)

- [x] Create the `frontend/` directory and initialize a Vite + Vue project.
- [x] Configure the Vite proxy to Flask (`/api` → `http://localhost:5000`) for dev.
- [x] Add `frontend/dist/` to `.gitignore`.
- [x] Add `npm run dev` and `npm run build` scripts to README/INSTALLATION.

### Phase 1 — Infrastructure (1-2 days)

- [x] Bootstrap `main.ts` with Vue + Pinia + Router + i18n.
- [x] Migrate `TRANSLATIONS` from main.js (lines 7-200+) into `i18n/ro.ts` and `i18n/en.ts`.
- [x] Create `api/client.ts` — a fetch wrapper with uniform error handling (equivalent to the current helpers).
- [x] Create the `users`, `tasks`, `preferences` stores.
- [x] Set up the main `App.vue` layout with header, user-bar and `<router-view>`.

### Phase 2 — Dashboard / main view (3-4 days)

The hardest part: porting main.js (~3300 lines) into Vue components.

- [x] `WeatherWidget.vue` — weather widget with a forecast modal.
- [x] `UserBar.vue` — user list + active selection.
- [x] `TaskCard.vue` — task card with actions (complete/refuse/edit/delete/comments).
- [x] `TaskList.vue` — task list for "today" and "the next 7 days".
- [x] `TaskModal.vue` — add/edit task modal with recurrence.
- [x] `CommentsModal.vue` — comments modal.
- [x] `AiChat.vue` — chat panel with history.
- [x] `VoiceController.vue` — wake word, Web Speech API, fallback to server STT/TTS.
- [x] `TuyaPanel.vue` — device temperatures.
- [x] `SettingsPanel.vue` — preferences (language, weather city, AI model, Tuya, voice).
- [x] `ConfirmDialog.vue` + `useNotification.ts` (toasts) — implemented as `ToastHost.vue` + a composable.

### Phase 3 — Secondary views (2-3 days)

- [x] `CalendarView.vue` — month and year view (from calendar.js).
- [x] `TransportView.vue` — bus schedules + AI transport chat (from transport.js).
- [x] `HistoryView.vue` — history (from history.js).
- [x] `RadioView.vue` — station list + main player (from radio.js).

> **Phase 3 notes:** the `/calendar`, `/radio`, `/transport`, `/history` routes are
> now served by the SPA; footer navigation uses `<RouterLink>` (no reload).
> Direct access via URL / refresh on these routes still hit the Jinja templates
> in Flask — the catch-all fallback to `index.html` is done in **Phase 5**.

### Phase 4 — Persistent components (1 day)

The biggest advantage of the SPA — `RadioMiniPlayer.vue` keeps playing across navigation:

- [x] `RadioMiniPlayer.vue` mounted in `App.vue`, driven by the `radio` store.
- [x] Two-way synchronization with `RadioView.vue` (play/pause/current station).
- [x] Persistent voice controller (does not re-initialize when changing the view).

> **Phase 4 notes:** the `<audio>` element and all playback state have been moved
> into `stores/radio.ts` (a Pinia singleton), so playback survives navigation.
> `RadioView.vue` and `RadioMiniPlayer.vue` are now just UI over the store.
> `VoiceController.vue` was already mounted in the footer in `App.vue` (outside
> the `<RouterView>`), so it does not re-initialize when changing the view.

### Phase 5 — Backend integration (1 day)

Flask must serve the SPA and fall back to `index.html` for client routes:

- [x] Modify [src/main.py](../src/main.py): remove the template-rendering routes (`/`, `/calendar`, `/radio`, `/transport`, `/history`) and replace them with a single catch-all route that serves `frontend/dist/index.html`.
- [x] Add serving the bundle as static: `app = Flask(..., static_folder='frontend/dist', static_url_path='/')`.
- [x] Keep the `/api/*` routes unchanged.
- [x] Update run.bat and deploy/ — an SPA build script before starting Flask in production.

> **Phase 5 notes:** the `/` route and an `errorhandler(404)` act as a catch-all —
> any path that is not a real file in `frontend/dist/` and does not start with
> `/api/` receives `index.html`, so `vue-router` takes over the client routes
> (`/calendar`, `/radio`, `/transport`, `/history`) including on refresh / direct
> URL access. Non-existent `/api/*` calls receive a real JSON 404, not the SPA
> shell. `run.bat` and `deploy/DEPLOY.md` now run `npm run build` before Flask.
>
> The SPA bundle is served through the `/` route + `/assets/<path>`; Flask's
> `static_folder` stays on `static/` (at `/static`), and the old Jinja pages are
> still accessible at `/legacy`, `/legacy/calendar`, `/legacy/radio`,
> `/legacy/transport`, `/legacy/history` — useful as a reference for visual
> comparison during the migration. These `/legacy/*` routes and the `templates/`
> + `static/` directories are removed in **Phase 6**.

### Phase 6 — Polish & cleanup (1-2 days)

- [x] Remove templates/ and static/ — moved into [legacy/](../legacy/) as a backup.
      The `/legacy/*` routes and the `render_template` calls have been removed from
      [src/main.py](../src/main.py).
- [x] Per-route code splitting — each view (`DashboardView`, `CalendarView`,
      `RadioView`, `TransportView`, `HistoryView`) is dynamically `import()`-ed in
      [frontend/src/router/index.ts](../frontend/src/router/index.ts), so Vite emits
      a separate chunk per route.
- [x] Bundle optimization for the RPi: added `vite-plugin-compression`, which emits
      `.br` and `.gz` next to each asset; Flask automatically chooses the correct
      variant based on `Accept-Encoding`. Initial bundle (index + index.css, gzip):
      **~88 KB**; total uncompressed `dist/`: ~353 KB; total `dist/` with
      `.br`/`.gz` included: ~619 KB on disk — under target (< 300 KB on the wire).
- [ ] Testing in the Chromium kiosk on the RPi — to be done on the device (we can't
      run Chromium ARM from this environment).
- [x] Update [docs/INSTALLATION.md](INSTALLATION.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/TECHNICAL_SPECS.md](TECHNICAL_SPECS.md).

> **Phase 6 notes:** Flask no longer has either a `template_folder` or a
> `static_folder` — the entire UI comes from `frontend/dist/`. The precompressed
> assets are served only if the client sends `Accept-Encoding: br` / `gzip`;
> otherwise the original file is delivered (the same content hash, so the cache
> stays valid). The [legacy/](../legacy/) directory keeps the MPA code for
> historical reference and can be deleted entirely after the migration is
> validated in production.

---

## 6. Migration strategy (incremental vs big-bang)

### 6.1 Recommendation: **strangler pattern**

We don't port everything at once. We go view by view, keeping the old pages functional:

1. We start with `RadioView` (the smallest) as a *proof of concept*.
2. We run in parallel: Flask serves `/` as the SPA (with only `RadioView` ported) and the rest (`/calendar`, `/transport`, `/history`) stay Jinja.
3. The SPA has routes only for the ported views; the rest redirect to the Flask MPA URL (full reload).
4. At each iteration, we move one more view into the SPA.
5. Finally, we delete templates/ and static/.

Advantage: the application stays functional in all phases; we can roll back easily.

### 6.2 Alternative: big-bang

A separate branch, complete port, merge when ready. Faster if there is full-time availability, but risky.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The Web Speech API behaves differently as a Vue *composable* than as imperative code | Isolate it in `VoiceController.vue` with `onMounted/onUnmounted`; test early on the Chromium RPi. |
| Bundle too large for the RPi | Per-route code splitting + `vite-plugin-compression` (gzip/brotli). Check `total < 500 KB`. |
| Loss of voice/radio state on a new deploy | Optional service worker in Phase 6+ for offline cache (out of scope initially). |
| The current polling (weather, tuya, now-playing) must be centralized | `composables/usePolling.ts` with automatic cleanup on unmount. |
| Kiosk mode runs with a stale cache after deploy | Automatic bundle versioning (Vite already does it via the hash in the name); cache-bust on `index.html`. |
| The Flask API has no CORS for dev | We use the Vite proxy, so CORS is not needed in dev; in prod it is same-origin. |

---

## 8. Total effort estimate

| Phase | Days (1 dev) |
|---|---|
| 0 — Preparation | 0.5 |
| 1 — Infrastructure | 1.5 |
| 2 — Dashboard | 3.5 |
| 3 — Secondary views | 2.5 |
| 4 — Persistent components | 1 |
| 5 — Backend integration | 1 |
| 6 — Polish | 1.5 |
| **Total** | **~11.5 days** |

> **Status:** Phases 0-6 complete (Chromium kiosk testing on the RPi remains as an
> on-device verification). The old MPA is archived in [legacy/](../legacy/).

---

## 9. Acceptance criteria

The migration is considered complete when:

1. All five views (dashboard, calendar, radio, transport, history) work identically to before.
2. Navigating between them does NOT trigger a reload (check in DevTools → Network).
3. The mini radio player keeps playing when changing views.
4. Voice/AI chat keeps its history across navigation.
5. The total bundle (gzip) is < 300 KB.
6. The application runs smoothly on the RPi 4 in kiosk mode.
7. All existing backend tests pass (API unchanged).
8. templates/ and static/js/ are deleted (or archived).

---

## 10. Out of scope for this migration

Things that are **NOT** part of this migration but may follow:

- Migrating the Flask backend → FastAPI (separately).
- PWA / offline support / service worker.
- Server-side rendering (Nuxt) — not needed for a personal-use application.
- WebSocket for live updates (replacing polling). Recommended as a *follow-up*.
- Per-user authentication (currently single-tenant).
