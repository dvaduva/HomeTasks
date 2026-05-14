# Plan de portare HomeTasks către SPA

Document de planificare pentru tranziția aplicației HomeTasks dintr-o aplicație multi-pagină Flask + Jinja + JS vanilla într-o **Single Page Application** (SPA) care consumă API-ul REST existent.

---

## 1. Starea actuală a aplicației

### 1.1 Arhitectură curentă (MPA)

Aplicația este în prezent o aplicație **multi-page** server-rendered:

| Componentă | Detaliu |
|---|---|
| Backend | Flask (Python) — [src/main.py](src/main.py) |
| Persistență | SQLAlchemy + SQLite — [src/task_manager/](src/task_manager/) |
| Servicii | weather, ollama, voice, tuya — [src/](src/) |
| Templating | Jinja2 — [templates/](templates/) |
| Frontend | HTML + CSS + JS vanilla — [static/](static/) |

### 1.2 Pagini server-rendered actuale

| Rută | Template | JS specific | Funcționalitate |
|---|---|---|---|
| `/` | [base.html](templates/base.html) | [main.js](static/js/main.js) (~3300 linii) | Dashboard taskuri, useri, vreme, AI chat, voice, Tuya |
| `/calendar` | [calendar.html](templates/calendar.html) | [calendar.js](static/js/calendar.js) | Calendar lună/an |
| `/radio` | [radio.html](templates/radio.html) | [radio.js](static/js/radio.js) | Player radio |
| `/transport` | [transport.html](templates/transport.html) | [transport.js](static/js/transport.js) | Mersul autobuzelor |
| `/history` | [history.html](templates/history.html) | [history.js](static/js/history.js) | Istoric taskuri |

### 1.3 API REST disponibil

Backend-ul expune deja un API REST complet — punct de plecare ideal pentru SPA:

- **Useri**: `GET/POST /api/users`, `GET/PUT/DELETE /api/users/<id>`
- **Taskuri**: `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/<id>`, `/api/tasks/today`, `/api/tasks/upcoming`
- **Comentarii**: `GET/POST /api/tasks/<id>/comments`
- **Preferințe**: `GET/PUT /api/preferences`
- **Vreme**: `/api/weather/current`, `/api/weather/forecast`
- **AI**: `/api/ai/chat`, `/api/ai/models`, `/api/ai/status`
- **Voice**: `/api/voice/listen`, `/api/voice/speak`, `/api/voice/server-available`, `/api/voice-command`, `/api/voice-debug-log`
- **Tuya**: `/api/tuya/temperatures`, `/api/tuya/refresh`
- **Transport**: `/api/transport/routes`, `/api/transport/chat`
- **Radio**: `/api/radio/stations`, `/api/radio/proxy/<id>`, `/api/radio/now-playing`
- **Calendar**: `/api/calendar/month`, `/api/calendar/year`

### 1.4 Limitări ale arhitecturii actuale

- **Navigare cu reload complet** între pagini (calendar, radio, transport, history) — întrerupe playerul radio mini, resetează starea voice, repornește polling-ul.
- **Cod duplicat în JS**: i18n, gestionare modală, fetch helpers sunt replicate în mai multe fișiere.
- **Lipsă state management** centralizat — fiecare pagină re-citește users/preferințe la fiecare reload.
- **Bundle JS monolitic** ([main.js](static/js/main.js) are ~3300 linii).
- **Lipsă type safety**, fără build pipeline, fără hot reload în dezvoltare.

---

## 2. Obiectivele portării

1. **Navigare fără reload** — păstrarea stării player radio, voice, AI chat la schimbarea „paginii”.
2. **Componentizare** — extragerea elementelor reutilizabile (card task, modal, listă comentarii etc.).
3. **State global** — un singur store pentru users, preferințe, useri activi, taskuri.
4. **Routing client-side** — URL-uri identice cu cele actuale (`/calendar`, `/radio`, …) pentru a păstra bookmark-urile și kiosk mode-ul.
5. **API-ul backend rămâne neschimbat** — Flask devine doar API + servire bundle SPA.
6. **Build pipeline** modern (Vite) cu hot reload, code splitting, minificare.
7. **Compatibilitate Raspberry Pi kiosk** (Chromium pe ARM) — bundle mic, fără dependențe grele.

---

## 3. Alegerea stack-ului

### 3.1 Recomandare: **Vue 3 + Vite + Pinia + Vue Router**

| Argument | Detaliu |
|---|---|
| Curbă de învățare mică | Sintaxa template e similară cu Jinja, ușor de adoptat venind din vanilla JS. |
| Bundle mic | ~35 KB gzip — important pentru kiosk RPi. |
| Reactivitate simplă | Mai puțin „mental overhead” decât React/Redux. |
| Ecosistem matur | Pinia (store), Vue Router, Vue I18n acoperă tot ce e nevoie. |
| SFC `.vue` | HTML + JS + CSS într-un singur fișier per componentă — apropiat de cum e structurat acum codul. |

### 3.2 Alternative considerate

- **React + Vite + Zustand + React Router** — viabil dacă echipa preferă React. Bundle puțin mai mare.
- **Svelte/SvelteKit** — bundle cel mai mic, dar ecosistem mai mic.
- **Vanilla + history API + componente custom** — minimal, dar reinventează multe lucruri.

### 3.3 Dependențe propuse

```
vue@^3.4
vue-router@^4
pinia@^2
vue-i18n@^9
@vitejs/plugin-vue
vite
```

Opțional pentru DX:
- TypeScript (recomandat pentru un cod de ~6000 linii)
- ESLint + Prettier
- Vitest (testare componente)

---

## 4. Structura propusă pentru proiect

```
frontend/                          # NOU — root SPA
├── index.html                     # entry point (înlocuiește base.html)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.ts                    # bootstrap Vue + Pinia + Router + i18n
    ├── App.vue                    # layout principal (header, user-bar, main, footer)
    ├── router/
    │   └── index.ts               # rute: /, /calendar, /radio, /transport, /history
    ├── stores/                    # Pinia
    │   ├── users.ts
    │   ├── tasks.ts
    │   ├── preferences.ts
    │   ├── weather.ts
    │   ├── radio.ts               # persistă peste navigare!
    │   ├── voice.ts
    │   └── ai.ts
    ├── api/                       # client HTTP centralizat
    │   ├── client.ts              # wrapper fetch + handler erori
    │   ├── tasks.ts
    │   ├── users.ts
    │   ├── weather.ts
    │   └── ...
    ├── i18n/
    │   ├── index.ts
    │   ├── ro.ts                  # migrate din TRANSLATIONS în main.js
    │   └── en.ts
    ├── components/                # componente reutilizabile
    │   ├── TaskCard.vue
    │   ├── TaskModal.vue
    │   ├── CommentsModal.vue
    │   ├── UserChip.vue
    │   ├── WeatherWidget.vue
    │   ├── ConfirmDialog.vue
    │   ├── SettingsPanel.vue
    │   ├── AiChat.vue
    │   ├── VoiceController.vue    # logică recunoaștere/TTS
    │   ├── RadioMiniPlayer.vue    # mini player persistent
    │   └── TuyaPanel.vue
    ├── views/                     # „pagini”
    │   ├── DashboardView.vue      # ex- base.html
    │   ├── CalendarView.vue
    │   ├── RadioView.vue
    │   ├── TransportView.vue
    │   └── HistoryView.vue
    ├── composables/               # hooks reutilizabile
    │   ├── useDateTime.ts
    │   ├── useNotification.ts
    │   └── usePolling.ts
    └── assets/
        ├── css/                   # migrate din static/css/
        └── icons/
```

Backend rămâne neschimbat structural — singura modificare e:
- Servirea bundle-ului SPA build (`frontend/dist/`) ca fișiere statice + fallback la `index.html` pentru rutele client-side.

---

## 5. Faze de implementare

### Faza 0 — Pregătire (½ zi)

- [x] Creează directorul `frontend/` și inițializează proiect Vite + Vue.
- [x] Configurează proxy Vite spre Flask (`/api` → `http://localhost:5000`) pentru dev.
- [x] Adaugă `frontend/dist/` în `.gitignore`.
- [x] Adaugă script `npm run dev` și `npm run build` în README/INSTALARE.

### Faza 1 — Infrastructură (1-2 zile)

- [x] Bootstrap `main.ts` cu Vue + Pinia + Router + i18n.
- [x] Migrează `TRANSLATIONS` din [main.js](static/js/main.js) (rândurile 7-200+) în `i18n/ro.ts` și `i18n/en.ts`.
- [x] Creează `api/client.ts` — fetch wrapper cu gestionare uniformă a erorilor (echivalent cu helper-ele actuale).
- [x] Creează store-urile `users`, `tasks`, `preferences`.
- [x] Setează layoutul principal `App.vue` cu header, user-bar și `<router-view>`.

### Faza 2 — Dashboard / View principal (3-4 zile)

Cea mai grea parte: portarea [main.js](static/js/main.js) (~3300 linii) în componente Vue.

- [x] `WeatherWidget.vue` — widget vreme cu modal forecast.
- [x] `UserBar.vue` — listă useri + selecție activi.
- [x] `TaskCard.vue` — card task cu acțiuni (complete/refuse/edit/delete/comments).
- [x] `TaskList.vue` — listă taskuri „azi” și „următoarele 7 zile”.
- [x] `TaskModal.vue` — modal add/edit task cu recurență.
- [x] `CommentsModal.vue` — modal comentarii.
- [x] `AiChat.vue` — chat panel cu istoric.
- [x] `VoiceController.vue` — wake word, Web Speech API, fallback la server STT/TTS.
- [x] `TuyaPanel.vue` — temperaturi dispozitive.
- [x] `SettingsPanel.vue` — preferințe (limbă, oraș vreme, model AI, Tuya, voice).
- [x] `ConfirmDialog.vue` + `useNotification.ts` (toast-uri) — implementat ca `ToastHost.vue` + composable.

### Faza 3 — View-uri secundare (2-3 zile)

- [x] `CalendarView.vue` — vedere lună și an (din [calendar.js](static/js/calendar.js)).
- [x] `TransportView.vue` — orare autobuz + chat AI transport (din [transport.js](static/js/transport.js)).
- [x] `HistoryView.vue` — istoric (din [history.js](static/js/history.js)).
- [x] `RadioView.vue` — listă stații + player principal (din [radio.js](static/js/radio.js)).

> **Note Faza 3:** rutele `/calendar`, `/radio`, `/transport`, `/history` sunt acum
> servite de SPA; navigarea din footer folosește `<RouterLink>` (fără reload).
> Accesul direct prin URL / refresh pe aceste rute încă lovește template-urile
> Jinja din Flask — fallback-ul catch-all spre `index.html` se face în **Faza 5**.

### Faza 4 — Componente persistente (1 zi)

Avantajul cel mai mare al SPA — `RadioMiniPlayer.vue` continuă să cânte la navigare:

- [x] `RadioMiniPlayer.vue` montat în `App.vue`, alimentat din store-ul `radio`.
- [x] Sincronizare bidirecțională cu `RadioView.vue` (play/pause/stație curentă).
- [x] Voice controller persistent (nu se reinițializează la schimbarea view-ului).

> **Note Faza 4:** elementul `<audio>` și toată starea de redare au fost mutate
> în `stores/radio.ts` (singleton Pinia), deci redarea supraviețuiește navigării.
> `RadioView.vue` și `RadioMiniPlayer.vue` sunt acum doar UI peste store.
> `VoiceController.vue` era deja montat în footer-ul din `App.vue` (în afara
> `<RouterView>`), deci nu se reinițializează la schimbarea view-ului.

### Faza 5 — Integrare backend (1 zi)

Flask trebuie să servească SPA-ul și să facă fallback pe `index.html` pentru rutele client:

- [ ] Modifică [src/main.py](src/main.py): șterge rutele care randează template (`/`, `/calendar`, `/radio`, `/transport`, `/history`) și înlocuiește-le cu o singură rută catch-all care servește `frontend/dist/index.html`.
- [ ] Adaugă servirea bundle-ului ca static: `app = Flask(..., static_folder='frontend/dist', static_url_path='/')`.
- [ ] Păstrează rutele `/api/*` neschimbate.
- [ ] Actualizează [run.bat](run.bat) și [deploy/](deploy/) — script de build SPA înainte de pornirea Flask în producție.

### Faza 6 — Polish & cleanup (1-2 zile)

- [ ] Înlătură [templates/](templates/) și [static/](static/) — sau le mută într-un `legacy/` ca backup.
- [ ] Code splitting per route (Vite o face automat cu `import()` dynamic în router).
- [ ] Optimizare bundle pentru RPi: verifică dimensiune (`npm run build` + `du -sh dist/`).
- [ ] Testare în kiosk Chromium pe RPi.
- [ ] Update [docs/INSTALARE.md](docs/INSTALARE.md), [docs/ARHITECTURA.md](docs/ARHITECTURA.md), [docs/SPECIFICATII_TEHNICE.md](docs/SPECIFICATII_TEHNICE.md).

---

## 6. Strategie de migrare (incremental vs big-bang)

### 6.1 Recomandare: **strangler pattern**

Nu portăm totul deodată. Mergem view-cu-view, păstrând paginile vechi funcționale:

1. Începem cu `RadioView` (cea mai mică) ca *proof of concept*.
2. Rulăm în paralel: Flask servește `/` ca SPA (cu doar `RadioView` portat) și restul (`/calendar`, `/transport`, `/history`) rămân Jinja.
3. SPA-ul are doar rute pentru view-urile portate; restul redirecționează către URL-ul Flask MPA (full reload).
4. La fiecare iterație, mai mutăm un view în SPA.
5. La final, ștergem [templates/](templates/) și [static/](static/).

Avantaj: aplicația rămâne funcțională în toate fazele; putem da rollback ușor.

### 6.2 Alternativă: big-bang

Branch separat, portare completă, merge când e gata. Mai rapid dacă există disponibilitate full-time, dar riscant.

---

## 7. Riscuri și mitigări

| Risc | Mitigare |
|---|---|
| Web Speech API se comportă diferit ca *composable* Vue față de cod imperativ | Izolează în `VoiceController.vue` cu `onMounted/onUnmounted`; testează devreme pe Chromium RPi. |
| Bundle prea mare pentru RPi | Code splitting per route + `vite-plugin-compression` (gzip/brotli). Verifică `total < 500 KB`. |
| Pierderea stării voice/radio la deploy nou | Service worker opțional în Faza 6+ pentru offline cache (out-of-scope inițial). |
| Polling-ul curent (vreme, tuya, now-playing) trebuie centralizat | `composables/usePolling.ts` cu cleanup automat la unmount. |
| Kiosk mode rulează cu cache vechi după deploy | Versionare automată a bundle-urilor (Vite o face deja prin hash în nume); cache-bust la `index.html`. |
| API-ul Flask nu are CORS pentru dev | Folosim proxy Vite, deci nu e nevoie de CORS în dev; în prod e same-origin. |

---

## 8. Estimare efort total

| Fază | Zile (1 dev) |
|---|---|
| 0 — Pregătire | 0.5 |
| 1 — Infrastructură | 1.5 |
| 2 — Dashboard | 3.5 |
| 3 — View-uri secundare | 2.5 |
| 4 — Componente persistente | 1 |
| 5 — Integrare backend | 1 |
| 6 — Polish | 1.5 |
| **Total** | **~11.5 zile** |

---

## 9. Criterii de acceptanță

Portarea e considerată completă când:

1. Toate cele 5 view-uri (dashboard, calendar, radio, transport, history) funcționează identic ca înainte.
2. Navigarea între ele NU declanșează reload (verifică în DevTools → Network).
3. Mini playerul radio continuă să cânte la schimbarea de view.
4. Voice/AI chat își păstrează istoricul la navigare.
5. Bundle total (gzip) < 300 KB.
6. Aplicația rulează fluid pe RPi 4 în kiosk mode.
7. Toate testele backend existente trec (API neschimbat).
8. [templates/](templates/) și [static/js/](static/js/) sunt șterse (sau arhivate).

---

## 10. În afara scope-ului acestei portări

Lucruri care **NU** fac parte din această portare, dar pot urma:

- Migrarea backend Flask → FastAPI (separat).
- PWA / offline support / service worker.
- Server-side rendering (Nuxt) — nu e nevoie pentru o aplicație de uz personal.
- WebSocket pentru update-uri live (înlocuiește polling-ul). Recomandat ca *follow-up*.
- Autentificare per utilizator (acum e single-tenant).
