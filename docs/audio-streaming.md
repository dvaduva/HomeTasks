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
# IP/URL-ul HomeTasks accesibil de boxa Cast în LAN (pentru stream proxy).
# Dacă lipsește, se folosește host-ul din care a venit request-ul (nu localhost).
CAST_PUBLIC_BASE_URL=http://192.168.1.50:5000
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

1. **Gunicorn: stare pychromecast single-process + streaming care nu blochează.**
   ✅ *rezolvat.* `pychromecast` ține conexiunea la boxă în memoria *unui singur*
   proces (cu >1 worker un `/api/cast/stop` ar putea nimeri alt worker). DAR
   proxy-ul radio streamează **sincron** pe toată durata redării (ore), așa că un
   singur worker `sync` ar bloca întreaga aplicație. **Aplicat:**
   `worker_class = "gthread"`, `workers = 1`, `threads = 8` în
   `deploy/gunicorn.conf.py` — un proces (stare cast coerentă) + thread-uri (un
   stream proxy nu mai blochează API-ul). Plus reconectare lazy în
   `CastService._get_cast` (socket mort → reconstruit din discovery cache).

2. **Discovery nu trebuie să blocheze handler-ul HTTP.** ✅ *rezolvat.*
   Folosim un `CastBrowser` + `Zeroconf` **persistent** (descoperire continuă,
   event-driven — actualizează lista live când apar/dispar device-uri), pornit
   **lazy** la primul request (`cast_service.start()`, idempotent) ca să trăiască
   în worker, nu în masterul preîncărcat. `/api/cast/devices` doar citește lista,
   nu scanează la cerere.

3. **`localhost` nu merge pentru proxy.** ✅ *atenuat.* Dacă boxei i-am da un URL
   cu `localhost`/`127.0.0.1`, s-ar conecta la *ea însăși*. `_cast_base_url`
   detectează host-ul loopback și îl înlocuiește automat cu IP-ul LAN real al
   mașinii (`_detect_lan_ip`); `CAST_PUBLIC_BASE_URL` îl suprascrie explicit.
   **Atenție:** firewall-ul (ex. Windows) trebuie să permită portul 5000 inbound,
   altfel boxa tot nu ajunge la proxy.

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

### Pasul 1 — Discovery ✅ implementat
- `cast/service.py`: `CastBrowser` persistent (descoperire continuă), pornit lazy.
- `GET /api/cast/devices` returnează lista live.
- **Test:** Mi Smart Speaker apare în listă (necesită rețeaua cu boxa).

### Pasul 2 — Cast play/stop ✅ implementat
- `POST /api/cast/play` `{device_id, station_id}`: rezolvă stația → URL (direct sau proxy) → `media_controller.play_media(url, content_type, stream_type='LIVE')`.
- `POST /api/cast/stop`.
- `workers = 1` în gunicorn (Problema 1).
- **Test:** o stație publică sună pe boxă; tab-ul UI închis nu o oprește (necesită rețeaua cu boxa).

### Pasul 3 — Volum + status ✅ implementat
- `POST /api/cast/volume` `{device_id, volume: 0.0-1.0}` → `cast.set_volume`.
- `GET /api/cast/status?device_id=...` → volum/mut din `cast.status` + player_state/title din `media_controller.status`.
- **Test:** volum reglabil; status reflectă play/stop real (necesită rețeaua cu boxa).

### Pasul 4 — Frontend ✅ implementat
- `frontend/src/api/cast.ts` + export în `api/index.ts`.
- `useRadioStore`: `castTarget`/`castDevices`/`isCasting`, acțiuni `loadCastDevices`/`setCastTarget`/`stopCast`; `play`/`onStationClick`/`togglePlayPause`/`setVolume` ramificate local↔cast; polling status la 5s.
- Oprire audio local la comutarea pe cast (Problema 8) — `setCastTarget` + guard pe `onAudioPause`.
- Selector destinație „Acest dispozitiv / <boxă>" în `RadioView.vue`.
- **Test:** flux complet din UI pe ambele destinații (necesită rețeaua cu boxa).

### Pasul 5 — Stații prin proxy + edge-cases ✅ implementat
- **Auto-fallback** direct→proxy în `/api/cast/play`: încearcă URL-ul direct, iar
  dacă boxa nu confirmă redarea (`CastService._await_playing` detectează
  `idle_reason=ERROR` sau timeout), reia automat prin proxy-ul LAN. Stațiile cu
  `proxy:true` merg direct pe proxy. Răspunsul include `route: direct|proxy`.
- `CAST_PUBLIC_BASE_URL` documentat în `.env.example` (fallback: host-ul cererii).
- Fix gunicorn `gthread` (vezi Problema 1) — necesar ca stream-ul proxy să nu
  blocheze aplicația.
- **Test (pe teren):** o stație care eșuează direct sună prin proxy; verifică
  `route` în răspuns.

## Bluetooth A2DP — streaming local către boxe (v2, planificat)

> A doua destinație de redare: o boxă **Bluetooth** legată direct de RPi.
> **Atenție — e arhitectura inversă față de Cast**, nu o extindere a ei.

### De ce e fundamental diferit de Cast

La Cast, boxa **trage URL-ul singură** prin rețea; HomeTasks doar comandă și
serverul rămâne headless. La Bluetooth nu există rețea între RPi și boxă: linkul
A2DP e punct-la-punct, deci **RPi-ul devine playerul** — face fetch → decodează
(mp3/aac → PCM) → encodează SBC/AAC → împinge în sink-ul Bluetooth prin stack-ul
audio Linux. Boxa primește doar audio deja redat.

| | Google Cast (v1) | Bluetooth A2DP (v2) |
|---|---|---|
| Cine ia stream-ul | boxa, singură | **RPi** (fetch + decode + redă) |
| Rolul HomeTasks | controller remote | **player local** + sursă A2DP |
| Server headless | da | **nu** (produce audio pe RPi) |
| Transport | rețea HTTP(S) | radio BT punct-la-punct (~10 m) |
| Volum / stop | comenzi remote pe boxă | sink local (`pactl`) / kill subproces |
| Discovery | mDNS, zero-config | **pairing manual** o dată (stateful) |

> Asta **relaxează** o premisă din v1 (linia: *„serverul e headless, nu redă
> local"*): pentru BT, redarea locală pe RPi devine obligatorie. `python-mpv` /
> `ffmpeg` / GStreamer — excluse explicit la v1 — devin necesare aici.
> Nu schimbă nimic la Cast: rămâne controller pur.

### Model unificat de destinație (UI + API)

Extindem abstracția existentă de destinație într-un singur selector:

```
target = 'local' | 'cast:<device_id>' | 'bt:<device_id>'
```

`useRadioStore` păstrează un singur `target`; butonul Play ramifică pe prefix:
`local:` → `HTMLAudioElement`, `cast:` → `/api/cast/*` (azi), `bt:` →
`/api/output/bt/*` (nou). Selectorul din `RadioView.vue` listează toate
destinațiile la un loc (Acest dispozitiv / boxe Cast / boxe Bluetooth).
Backend-ul rutează după prefix; mecanismele din spate rămân separate.

### Biblioteci

**Sistem (RPi/Linux — NU `pip`):**
- `bluez` — stack Bluetooth + `bluetoothctl` (pairing/connect/trust) și D-Bus.
- `pipewire` (sau `pulseaudio`) — rutarea unui sink audio către boxa BT.

**Python:**
- redare: shell-out la `mpv`/`ffmpeg` ca subproces, SAU `python-mpv`.
- control BT/sink: `dbus-python`/`pydbus` (BlueZ) ori shell-out la
  `bluetoothctl` + `pactl`. Pragmatic la v2: shell-out, fără binding D-Bus.

### API REST (nou, sub abstracția de output)

| Metodă | Endpoint                  | Descriere                                                       |
|--------|---------------------------|----------------------------------------------------------------|
| GET    | `/api/output/bt/devices`  | Boxe BT pereche/conectate (`{devices:[{id,name,connected}]}`)   |
| POST   | `/api/output/bt/play`     | `{device_id, station_id}` → conectează + pornește playerul local pe sink |
| POST   | `/api/output/bt/stop`     | `{device_id}` → oprește subprocesul player                     |
| POST   | `/api/output/bt/volume`   | `{device_id, volume:0.0-1.0}` → `pactl set-sink-volume`         |
| GET    | `/api/output/bt/status`   | stare subproces (playing/idle) + titlu ICY ca azi              |

`station_id → URL` se rezolvă exact ca la Cast (reciclând logica din
`/api/cast/play`), dar URL-ul e consumat **local de RPi**, nu trimis boxei — deci
problemele de `CAST_PUBLIC_BASE_URL` / proxy LAN / firewall **nu se aplică**.
Cod nou paralel cu `cast/service.py`: un `bt/service.py` (`BluetoothService`).

### Probleme de implementare specifice BT

1. **Pairing e stare manuală, nu discovery.** Boxa trebuie *paired + trusted* o
   dată cu `bluetoothctl` înainte ca API-ul s-o poată folosi; după, reconectare
   automată. Nu există echivalent zero-config al mDNS. `/devices` listează ce e
   deja pereche, nu scanează la cerere (scan-ul BT e lent și deranjează linkul).

2. **Un singur sink A2DP odată.** A2DP e 1 sursă → 1 sink. Fără multi-room (rămâne
   la Snapcast, v2+). Comutarea între boxe BT = deconectare + reconectare.

3. **Subprocesul player trebuie gestionat de un singur proces.** Se aliniază cu
   `workers=1`/`gthread` existent (Problema 1): pornim/oprim un `mpv` detașat care
   scrie în sink-ul BT; HomeTasks ține PID-ul. Procesul nu blochează thread-urile
   (rulează out-of-process), spre deosebire de proxy-ul sincron.

4. **Permisiuni D-Bus/BlueZ.** User-ul sub care rulează gunicorn trebuie să aibă
   acces la BlueZ și la sesiunea audio (grup `bluetooth`, sesiune PipeWire/Pulse
   pentru user-ul de serviciu). Pe RPi headless asta înseamnă PipeWire pe system
   bus sau un user-service dedicat — punct sensibil de configurare.

5. **Imposibil de testat pe Windows.** BlueZ e doar Linux; tot dezvoltarea/testul
   se fac pe RPi cu boxa reală (mai strict decât la Cast, unde măcar discovery-ul
   se putea inspecta).

6. **Volum/stop/status au alt sens decât la Cast.** „stop" = kill subproces;
   „volum" = volumul sink-ului local (sau AVRCP); „status" = starea procesului
   local, nu `media_controller.status`. Titlul now-playing rămâne din ICY.

7. **Latență/codec.** SBC introduce latență (irelevant pentru radio, fără sync).
   Boxa negociază codecul; nu controlăm calitatea fin la v2.

### Pași de implementare (în ordine)

#### Pasul 1 — Pairing + listare
- Documentăm pairing-ul manual (`bluetoothctl`: `scan on`, `pair`, `trust`).
- `bt/service.py`: `BluetoothService.get_devices()` (boxe trusted/connected).
- `GET /api/output/bt/devices`. **Test:** boxa pereche apare în listă (pe RPi).

#### Pasul 2 — Play/stop local pe sink
- `POST /api/output/bt/play`: connect boxă → rezolvă stația → URL → pornește
  `mpv --audio-device=<bt_sink> <url>` ca subproces; ține PID-ul.
- `POST /api/output/bt/stop`: termină subprocesul.
- **Test:** o stație sună pe boxa BT; tab UI închis nu o oprește (rulează pe RPi).

#### Pasul 3 — Volum + status
- `POST /api/output/bt/volume` → `pactl set-sink-volume`.
- `GET /api/output/bt/status` → starea subprocesului + titlu ICY.

#### Pasul 4 — Frontend unificat
- `useRadioStore`: generalizează `castTarget` → `target` (`local|cast:|bt:`);
  Play/volume/stop ramifică pe prefix.
- Selector unic în `RadioView.vue` cu toate destinațiile.
- **Test:** comutare local ↔ Cast ↔ BT din UI, fără sunet dublu (Problema 8 v1).

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
