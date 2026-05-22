# Audio Casting Module — HomeTasks

> Plan de implementare pentru distribuirea radio-ului către dispozitive
> **Google Cast** (Chromecast / Google Home / **Mi Smart Speaker**).
>
> **Scop îngustat (v1):** păstrăm redarea radio existentă din browser, neatinsă,
> și adăugăm posibilitatea de a *trimite* (cast) același stream către o boxă
> Cast din rețea, controlat server-side prin `pychromecast`.

## Rol HomeTasks

HomeTasks devine **Controller** de cast:
- descoperă dispozitivele Google Cast din rețea (`pychromecast` + `zeroconf`);
- îi spune unui dispozitiv ales „redă acest URL de stream";
- controlează volum / stop și raportează starea curentă.

Dispozitivul Cast (Mi Smart Speaker etc.) **trage stream-ul singur** de la sursă,
exact ca un Chromecast. Browserul / tab-ul UI poate fi închis fără să se
întrerupă redarea pe boxă.

> Redarea **locală** rămâne neschimbată: `HTMLAudioElement` în tab-ul curent,
> gestionat de `useRadioStore`. „Cast" este o *destinație alternativă*, nu o
> înlocuire.

## Arhitectură

```
┌──────────────────────────────────────────────────────┐
│  Frontend — Vue 3 SPA                                 │
│  ┌───────────────┐   ┌──────────────────────────┐    │
│  │ RadioView.vue │   │ RadioMiniPlayer.vue       │    │
│  └───────┬───────┘   └────────────┬──────────────┘    │
│          └──────────┬─────────────┘                   │
│                useRadioStore (Pinia)                  │
│         ┌───────────┴────────────┐                    │
│         ▼                        ▼                     │
│  HTMLAudioElement          cast target select         │
│  (redare LOCALĂ            (Local / <device>)         │
│   în browser — există)            │                   │
└───────────────────────────────────┼───────────────────┘
                                     │ fetch /api/cast/*
┌────────────────────────────────────┼───────────────────┐
│  Backend — Flask JSON API (src/main.py)                 │
│              ┌──────────────────────▼─────────────────┐ │
│              │  cast/service.py  (pychromecast)        │ │
│              │  - discovery (cache device-uri)         │ │
│              │  - play(device, stream_url)             │ │
│              │  - stop / set_volume / status           │ │
│              └──────────────────────┬──────────────────┘ │
│   reciclează: /api/radio/proxy/<id> (stream reachable)   │
└──────────────────────────────────────┼──────────────────┘
                                        ▼
                          Mi Smart Speaker / Google Home
                          (trage stream-ul direct de la URL)
```

## Biblioteci

### Necesare (v1)
- `pychromecast` — descoperire + control Google Cast (include `zeroconf` pentru mDNS)

### Explicit NEINTRODUSE în v1
- `python-mpv` — serverul e headless, nu redă local
- `Flask-SocketIO` — folosim polling, consistent cu restul aplicației
- `pyttsx3` / `gTTS` pentru cast — TTS există deja doar pentru voice (`/api/voice/speak`); cast-ul de TTS e v2
- `yt-dlp`, surse Spotify — v2+

## API REST (nou)

Toate sub `/api/cast/*`, în stilul JSON existent (vezi `/api/radio/*`).

| Metodă | Endpoint              | Descriere                                                        |
|--------|-----------------------|------------------------------------------------------------------|
| GET    | `/api/cast/devices`   | Listează dispozitivele Cast descoperite (`{devices: [...]}`)     |
| POST   | `/api/cast/play`      | `{device_id, station_id}` → spune boxei să redea stream-ul stației |
| POST   | `/api/cast/stop`      | `{device_id}` → oprește redarea pe boxă                          |
| POST   | `/api/cast/volume`    | `{device_id, volume: 0.0-1.0}`                                   |
| GET    | `/api/cast/status`    | `{device_id}` → stare curentă (playing/paused, titlu, volum)     |

Frontend-ul corespunzător: un nou modul `frontend/src/api/cast.ts` (oglindă a
`radio.ts`) și extinderea `useRadioStore` cu starea „cast target".

> **De ce `station_id` și nu URL liber:** sursele sunt limitate la stațiile din
> `data/radio/stations.json`. Backend-ul rezolvă `station_id → URL` și decide
> dacă trimite URL-ul direct sau pe cel via proxy (vezi mai jos).

## Stream-ul trebuie să fie accesibil DE pe boxă

Aceasta e mecanica esențială (și o sursă de bug-uri): boxa Cast nu primește
audio de la HomeTasks — primește un **URL** pe care îl deschide singură. Deci:

1. Stație cu URL public (ex. `https://live.kissfm.ro/kissfm.aacp`): trimitem URL-ul
   direct boxei. Mi Smart Speaker / Cast acceptă **MP3 și AAC** peste HTTP/HTTPS.
2. Stație care necesită proxy (CORS / port non-standard `:8443` / TLS dubios —
   vezi flag-ul `proxy` din `stations.json`): trimitem boxei
   `http://<IP-LAN-HomeTasks>:5000/api/radio/proxy/<station_id>`.
   **Reciclăm proxy-ul existent** (`radio_proxy` în `src/main.py`).

Pentru cazul (2), HomeTasks trebuie să-și cunoască **IP-ul/URL-ul propriu
accesibil în LAN** de către boxă (nu `localhost`). Acesta devine un punct de
configurare (vezi `config`).

## Configurare

Aplicația nu folosește `config.yaml` — citește din `.env` + tabela
`Preferences`. Adăugăm:

```env
# IP/URL-ul HomeTasks accesibil de boxa Cast în LAN (pentru stream proxy)
CAST_PUBLIC_BASE_URL=http://192.168.1.50:5000
# Interval re-scan dispozitive Cast (secunde)
CAST_RESCAN_INTERVAL=60
```

(Opțional, mai târziu, mutabil în `Preferences` ca celelalte setări dinamice.)

## Frontend (Vue) — modificări minime

- `frontend/src/api/cast.ts` — client pentru `/api/cast/*`.
- `useRadioStore`: adaugă `castTarget: 'local' | <device_id>` și acțiunile
  `castTo(deviceId)`, `stopCast()`. Când `castTarget !== 'local'`, butonul Play
  apelează `/api/cast/play` în loc de `HTMLAudioElement.play()` (și oprește
  audio-ul local, ca să nu sune în două locuri).
- UI: un **selector de destinație** (dropdown „Local / <nume boxă>") în
  `RadioView.vue` și/sau `RadioMiniPlayer.vue`.
- Starea de pe boxă (now-playing/volum) se ia prin **polling** pe
  `/api/cast/status`, reutilizând `usePolling`.

## Probleme de implementare (citește înainte de a începe)

1. **Gunicorn multi-worker sparge starea pychromecast.** Producția rulează cu
   `workers = 2` (`deploy/gunicorn.conf.py`), procese `sync` separate.
   `pychromecast` ține conexiunea la boxă și lista de device-uri în memoria
   *unui singur* proces; un request `/api/cast/stop` poate nimeri celălalt
   worker, care nu are conexiunea. **Mitigări:**
   - cel mai simplu: `workers = 1` (suficient pe RPi pentru uz casnic), sau
   - un proces/thread dedicat de cast partajat (mai complex), sau
   - reconectare lazy: la fiecare request, dacă procesul nu are conexiune la
     `device_id`, reconectează prin discovery cache. (Cast permite mai mulți
     controllere; reconectarea e ok.)
   Decizie recomandată v1: **`workers = 1`** + reconectare lazy ca plasă de siguranță.

2. **Discovery e lent și asincron.** `pychromecast.get_chromecasts()` /
   `CastBrowser` blochează câteva secunde și rulează un thread `zeroconf`.
   Nu-l rula sincron în handler-ul HTTP. **Mitigare:** un scan în background la
   startup + re-scan periodic (`CAST_RESCAN_INTERVAL`), cu listă cache-uită în
   memorie; `/api/cast/devices` returnează cache-ul, nu scanează la cerere.

3. **`localhost` nu merge pentru proxy.** Dacă trimitem boxei un URL cu
   `localhost`/`127.0.0.1`, boxa va încerca să se conecteze la *ea însăși*.
   Trebuie IP-ul LAN real al HomeTasks (`CAST_PUBLIC_BASE_URL`).

4. **TLS pe boxă.** Stream-urile pe `:8443` cu certificate neobișnuite pot fi
   respinse de boxă chiar dacă merg în browser. Dacă o stație eșuează la cast
   dar merge local, ruteaz-o prin proxy (HTTP în LAN, transcodare zero).

5. **Codec.** Mi Smart Speaker (Cast) redă MP3/AAC; majoritatea stațiilor din
   `stations.json` sunt deja AAC/MP3. HLS (`.m3u8`) și formate exotice nu sunt
   garantate — de validat per-stație.

6. **Metadata ICY ≠ control Cast.** Titlul „now playing" pe boxă vine din media
   status-ul Cast, nu din proxy-ul ICY existent (`/api/radio/now-playing`).
   Pentru consistență, `/api/cast/status` poate prelua titlul din ICY ca azi.

7. **Mediul de dezvoltare e Windows, ținta e RPi/Linux.** `zeroconf`/mDNS poate
   fi blocat de firewall pe Windows; discovery se testează realist doar în
   rețeaua unde stă boxa.

8. **Race local vs cast.** Dacă utilizatorul redă local și apoi dă cast, trebuie
   oprit explicit `HTMLAudioElement` local (altfel sună în două locuri). Logica
   de toggle din `useRadioStore` trebuie extinsă cu grijă.

## Pași de implementare (în ordine)

### Pasul 1 — Discovery
- `cast/service.py`: scan background la startup + re-scan periodic, cache în memorie.
- `GET /api/cast/devices` returnează cache-ul.
- **Test:** Mi Smart Speaker apare în listă.

### Pasul 2 — Cast play/stop
- `POST /api/cast/play` `{device_id, station_id}`: rezolvă stația → URL (direct sau proxy) → `cast.media_controller.play_media(url, content_type)`.
- `POST /api/cast/stop`.
- Setează `workers = 1` în gunicorn (vezi Problema 1).
- **Test:** o stație publică sună pe boxă; tab-ul UI închis nu o oprește.

### Pasul 3 — Volum + status
- `POST /api/cast/volume`, `GET /api/cast/status`.
- **Test:** volum reglabil; status reflectă play/stop real.

### Pasul 4 — Frontend
- `cast.ts`, selector destinație în UI, integrare în `useRadioStore` cu polling status.
- Oprire audio local când se comută pe cast (Problema 8).
- **Test:** flux complet din UI pe ambele destinații (Local / boxă).

### Pasul 5 — Stații prin proxy + edge-cases
- Validează care stații necesită proxy pentru cast; setează flag-ul `proxy`.
- Configurează `CAST_PUBLIC_BASE_URL`.
- **Test:** o stație care eșuează direct sună prin proxy.

## În afara scopului (v2+)
- Redare programată (necesită întâi un scheduler — APScheduler — care **nu există**).
- Surse suplimentare: TTS-pe-boxă, YouTube (yt-dlp), file upload, Spotify.
- Coadă persistentă.
- Multi-room sync (Snapcast).
- WebSocket push în loc de polling.

## Resurse
- pychromecast: https://github.com/home-assistant-libs/pychromecast
- Cast media content types (codec-uri suportate): documentația Google Cast
- Cod relevant existent: `src/main.py` (`/api/radio/*`, `radio_proxy`),
  `frontend/src/stores/radio.ts`, `data/radio/stations.json`
