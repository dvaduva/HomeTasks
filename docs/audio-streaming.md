# Audio Casting Module — HomeTasks

> **English** · [Română](audio-streaming.ro.md)

> Implementation plan for streaming the radio to **Google Cast** devices
> (Chromecast / Google Home / **Mi Smart Speaker**).
>
> **Narrowed scope (v1):** we keep the existing in-browser radio playback
> untouched and add the ability to *send* (cast) the same stream to a Cast
> speaker on the network, controlled server-side through `pychromecast`.

## HomeTasks' role

HomeTasks becomes a cast **Controller**:
- discovers the Google Cast devices on the network (`pychromecast` + `zeroconf`);
- tells a chosen device "play this stream URL";
- controls volume / stop and reports the current state.

The Cast device (Mi Smart Speaker, etc.) **pulls the stream itself** from the
source, exactly like a Chromecast. The browser / UI tab can be closed without
interrupting playback on the speaker.

> **Local** playback stays unchanged: an `HTMLAudioElement` in the current tab,
> managed by `useRadioStore`. "Cast" is an *alternative destination*, not a
> replacement.

## Architecture

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
│  (LOCAL playback           (Local / <device>)         │
│   in the browser — exists)        │                   │
└───────────────────────────────────┼───────────────────┘
                                     │ fetch /api/cast/*
┌────────────────────────────────────┼───────────────────┐
│  Backend — Flask JSON API (src/main.py)                 │
│              ┌──────────────────────▼─────────────────┐ │
│              │  cast/service.py  (pychromecast)        │ │
│              │  - discovery (device cache)             │ │
│              │  - play(device, stream_url)             │ │
│              │  - stop / set_volume / status           │ │
│              └──────────────────────┬──────────────────┘ │
│   reuses: /api/radio/proxy/<id> (reachable stream)       │
└──────────────────────────────────────┼──────────────────┘
                                        ▼
                          Mi Smart Speaker / Google Home
                          (pulls the stream directly from the URL)
```

## Libraries

### Required (v1)
- `pychromecast` — Google Cast discovery + control (includes `zeroconf` for mDNS)

### Explicitly NOT introduced in v1
- `python-mpv` — the server is headless, it does not play locally
- `Flask-SocketIO` — we use polling, consistent with the rest of the application
- `pyttsx3` / `gTTS` for cast — TTS already exists only for voice (`/api/voice/speak`); casting TTS is v2
- `yt-dlp`, Spotify sources — v2+

## REST API (new)

All under `/api/cast/*`, in the existing JSON style (see `/api/radio/*`).

| Method | Endpoint              | Description                                                      |
|--------|-----------------------|------------------------------------------------------------------|
| GET    | `/api/cast/devices`   | Lists the discovered Cast devices (`{devices: [...]}`)           |
| POST   | `/api/cast/play`      | `{device_id, station_id}` → tells the speaker to play the station's stream |
| POST   | `/api/cast/stop`      | `{device_id}` → stops playback on the speaker                    |
| POST   | `/api/cast/volume`    | `{device_id, volume: 0.0-1.0}`                                   |
| GET    | `/api/cast/status`    | `{device_id}` → current state (playing/paused, title, volume)    |

The corresponding frontend: a new `frontend/src/api/cast.ts` module (a mirror of
`radio.ts`) and extending `useRadioStore` with the "cast target" state.

> **Why `station_id` and not a free URL:** the sources are limited to the stations
> in `data/radio/stations.json`. The backend resolves `station_id → URL` and
> decides whether to send the direct URL or the one via the proxy (see below).

## The stream must be reachable FROM the speaker

This is the essential mechanic (and a source of bugs): the Cast speaker doesn't
receive audio from HomeTasks — it receives a **URL** that it opens itself. So:

1. A station with a public URL (e.g. `https://live.kissfm.ro/kissfm.aacp`): we send
   the URL directly to the speaker. Mi Smart Speaker / Cast accept **MP3 and AAC**
   over HTTP/HTTPS.
2. A station that needs a proxy (CORS / non-standard port `:8443` / dubious TLS —
   see the `proxy` flag in `stations.json`): we send the speaker
   `http://<HomeTasks-LAN-IP>:5000/api/radio/proxy/<station_id>`.
   **We reuse the existing proxy** (`radio_proxy` in `src/main.py`).

For case (2), HomeTasks must know its **own URL/IP reachable on the LAN** by the
speaker (not `localhost`). This becomes a configuration point (see `config`).

## Configuration

The application doesn't use a `config.yaml` — it reads from `.env` + the
`Preferences` table. We add:

```env
# The HomeTasks IP/URL reachable by the Cast speaker on the LAN (for the proxy stream).
# If missing, the host the request came from is used (not localhost).
CAST_PUBLIC_BASE_URL=http://192.168.1.50:5000
```

(Optionally, later, movable into `Preferences` like the other dynamic settings.)

## Frontend (Vue) — minimal changes

- `frontend/src/api/cast.ts` — a client for `/api/cast/*`.
- `useRadioStore`: add `castTarget: 'local' | <device_id>` and the actions
  `castTo(deviceId)`, `stopCast()`. When `castTarget !== 'local'`, the Play button
  calls `/api/cast/play` instead of `HTMLAudioElement.play()` (and stops the local
  audio so it doesn't play in two places).
- UI: a **destination selector** (a "Local / <speaker name>" dropdown) in
  `RadioView.vue` and/or `RadioMiniPlayer.vue`.
- The speaker state (now-playing/volume) is taken through **polling** on
  `/api/cast/status`, reusing `usePolling`.

## Implementation issues (read before starting)

1. **Gunicorn: single-process pychromecast state + non-blocking streaming.**
   ✅ *resolved.* `pychromecast` keeps the connection to the speaker in the memory
   of a *single* process (with >1 worker, a `/api/cast/stop` could hit a different
   worker). BUT the radio proxy streams **synchronously** for the entire playback
   duration (hours), so a single `sync` worker would block the whole application.
   **Applied:** `worker_class = "gthread"`, `workers = 1`, `threads = 8` in
   `deploy/gunicorn.conf.py` — one process (coherent cast state) + threads (a proxy
   stream no longer blocks the API). Plus lazy reconnection in
   `CastService._get_cast` (dead socket → rebuilt from the discovery cache).

2. **Discovery must not block the HTTP handler.** ✅ *resolved.*
   We use a **persistent** `CastBrowser` + `Zeroconf` (continuous, event-driven
   discovery — updates the list live as devices appear/disappear), started
   **lazily** on the first request (`cast_service.start()`, idempotent) so it lives
   in the worker, not in the preloaded master. `/api/cast/devices` only reads the
   list, it doesn't scan on demand.

3. **`localhost` doesn't work for the proxy.** ✅ *mitigated.* If we gave the
   speaker a URL with `localhost`/`127.0.0.1`, it would connect to *itself*.
   `_cast_base_url` detects the loopback host and automatically replaces it with
   the machine's real LAN IP (`_detect_lan_ip`); `CAST_PUBLIC_BASE_URL` overrides
   it explicitly. **Note:** the firewall (e.g. Windows) must allow port 5000
   inbound, otherwise the speaker still won't reach the proxy.

4. **TLS on the speaker.** Streams on `:8443` with unusual certificates may be
   rejected by the speaker even if they work in the browser. If a station fails to
   cast but works locally, route it through the proxy (HTTP on the LAN, zero
   transcoding).

5. **Codec.** Mi Smart Speaker (Cast) plays MP3/AAC; most of the stations in
   `stations.json` are already AAC/MP3. HLS (`.m3u8`) and exotic formats are not
   guaranteed — to be validated per station.

6. **ICY metadata ≠ Cast control.** The "now playing" title on the speaker comes
   from the Cast media status, not from the existing ICY proxy
   (`/api/radio/now-playing`). For consistency, `/api/cast/status` can take the
   title from ICY as it does today.

7. **The development environment is Windows, the target is RPi/Linux.**
   `zeroconf`/mDNS may be blocked by the firewall on Windows; discovery is
   realistically tested only on the network where the speaker is.

8. **Local vs cast race.** If the user plays locally and then casts, the local
   `HTMLAudioElement` must be stopped explicitly (otherwise it plays in two
   places). The toggle logic in `useRadioStore` must be extended carefully.

## Implementation steps (in order)

### Step 1 — Discovery ✅ implemented
- `cast/service.py`: a persistent `CastBrowser` (continuous discovery), started lazily.
- `GET /api/cast/devices` returns the live list.
- **Test:** Mi Smart Speaker appears in the list (requires the network with the speaker).

### Step 2 — Cast play/stop ✅ implemented
- `POST /api/cast/play` `{device_id, station_id}`: resolves the station → URL (direct or proxy) → `media_controller.play_media(url, content_type, stream_type='LIVE')`.
- `POST /api/cast/stop`.
- `workers = 1` in gunicorn (Issue 1).
- **Test:** a public station plays on the speaker; closing the UI tab doesn't stop it (requires the network with the speaker).

### Step 3 — Volume + status ✅ implemented
- `POST /api/cast/volume` `{device_id, volume: 0.0-1.0}` → `cast.set_volume`.
- `GET /api/cast/status?device_id=...` → volume/mute from `cast.status` + player_state/title from `media_controller.status`.
- **Test:** volume adjustable; status reflects real play/stop (requires the network with the speaker).

### Step 4 — Frontend ✅ implemented
- `frontend/src/api/cast.ts` + export in `api/index.ts`.
- `useRadioStore`: `castTarget`/`castDevices`/`isCasting`, actions `loadCastDevices`/`setCastTarget`/`stopCast`; `play`/`onStationClick`/`togglePlayPause`/`setVolume` branched local↔cast; status polling at 5s.
- Stop local audio when switching to cast (Issue 8) — `setCastTarget` + a guard on `onAudioPause`.
- A "This device / <speaker>" destination selector in `RadioView.vue`.
- **Test:** the complete flow from the UI on both destinations (requires the network with the speaker).

### Step 5 — Stations via proxy + edge cases ✅ implemented
- **Auto-fallback** direct→proxy in `/api/cast/play`: tries the direct URL, and if
  the speaker doesn't confirm playback (`CastService._await_playing` detects
  `idle_reason=ERROR` or a timeout), it automatically retries via the LAN proxy.
  Stations with `proxy:true` go directly through the proxy. The response includes
  `route: direct|proxy`.
- `CAST_PUBLIC_BASE_URL` documented in `.env.example` (fallback: the request's host).
- The gunicorn `gthread` fix (see Issue 1) — needed so the proxy stream doesn't
  block the application.
- **Test (in the field):** a station that fails directly plays through the proxy;
  check `route` in the response.

## Bluetooth A2DP — local streaming to speakers (v2, planned)

> The second playback destination: a **Bluetooth** speaker connected directly to the RPi.
> **Note — this is the inverse architecture compared to Cast**, not an extension of it.

### Why it is fundamentally different from Cast

With Cast, the speaker **pulls the URL itself** over the network; HomeTasks only
commands it and the server stays headless. With Bluetooth there is no network
between the RPi and the speaker: the A2DP link is point-to-point, so **the RPi
becomes the player** — it fetches → decodes (mp3/aac → PCM) → encodes SBC/AAC →
pushes into the Bluetooth sink through the Linux audio stack. The speaker receives
only already-played audio.

| | Google Cast (v1) | Bluetooth A2DP (v2) |
|---|---|---|
| Who takes the stream | the speaker, itself | **the RPi** (fetch + decode + play) |
| HomeTasks' role | remote controller | **local player** + A2DP source |
| Headless server | yes | **no** (produces audio on the RPi) |
| Transport | HTTP(S) network | point-to-point BT radio (~10 m) |
| Volume / stop | remote commands on the speaker | local sink (`pactl`) / kill subprocess |
| Discovery | mDNS, zero-config | **manual pairing** once (stateful) |

> This **relaxes** an assumption from v1 (the line: *"the server is headless, it
> does not play locally"*): for BT, local playback on the RPi becomes mandatory.
> `python-mpv` / `ffmpeg` / GStreamer — explicitly excluded in v1 — become
> necessary here. It changes nothing about Cast: it remains a pure controller.

### Unified destination model (UI + API)

We extend the existing destination abstraction into a single selector:

```
target = 'local' | 'cast:<device_id>' | 'bt:<device_id>'
```

`useRadioStore` keeps a single `target`; the Play button branches on the prefix:
`local:` → `HTMLAudioElement`, `cast:` → `/api/cast/*` (today), `bt:` →
`/api/output/bt/*` (new). The selector in `RadioView.vue` lists all destinations
together (This device / Cast speakers / Bluetooth speakers). The backend routes by
prefix; the underlying mechanisms stay separate.

### Libraries

**System (RPi/Linux — NOT `pip`):**
- `bluez` — Bluetooth stack + `bluetoothctl` (pairing/connect/trust) and D-Bus.
- `pipewire` (or `pulseaudio`) — routing an audio sink to the BT speaker.

**Python:**
- playback: shell-out to `mpv`/`ffmpeg` as a subprocess, OR `python-mpv`.
- BT/sink control: `dbus-python`/`pydbus` (BlueZ) or shell-out to
  `bluetoothctl` + `pactl`. Pragmatic for v2: shell-out, without a D-Bus binding.

### REST API (new, under the output abstraction)

| Method | Endpoint                  | Description                                                    |
|--------|---------------------------|----------------------------------------------------------------|
| GET    | `/api/output/bt/devices`  | Paired/connected BT speakers (`{devices:[{id,name,connected}]}`) |
| POST   | `/api/output/bt/play`     | `{device_id, station_id}` → connects + starts the local player on the sink |
| POST   | `/api/output/bt/stop`     | `{device_id}` → stops the player subprocess                    |
| POST   | `/api/output/bt/volume`   | `{device_id, volume:0.0-1.0}` → `pactl set-sink-volume`         |
| GET    | `/api/output/bt/status`   | subprocess state (playing/idle) + ICY title as today           |

`station_id → URL` is resolved exactly as for Cast (reusing the logic from
`/api/cast/play`), but the URL is consumed **locally by the RPi**, not sent to the
speaker — so the `CAST_PUBLIC_BASE_URL` / LAN proxy / firewall issues **do not
apply**. New code parallel to `cast/service.py`: a `bt/service.py`
(`BluetoothService`).

### BT-specific implementation issues

1. **Pairing is manual state, not discovery.** The speaker must be *paired +
   trusted* once with `bluetoothctl` before the API can use it; after that,
   automatic reconnection. There is no zero-config equivalent to mDNS. `/devices`
   lists what is already paired, it doesn't scan on demand (BT scanning is slow and
   disturbs the link).

2. **A single A2DP sink at a time.** A2DP is 1 source → 1 sink. No multi-room (that
   stays with Snapcast, v2+). Switching between BT speakers = disconnect +
   reconnect.

3. **The player subprocess must be managed by a single process.** It aligns with
   the existing `workers=1`/`gthread` (Issue 1): we start/stop a detached `mpv` that
   writes to the BT sink; HomeTasks keeps the PID. The process doesn't block the
   threads (it runs out-of-process), unlike the synchronous proxy.

4. **D-Bus/BlueZ permissions.** The user gunicorn runs under must have access to
   BlueZ and to the audio session (the `bluetooth` group, a PipeWire/Pulse session
   for the service user). On a headless RPi this means PipeWire on the system bus or
   a dedicated user-service — a sensitive configuration point.

5. **Impossible to test on Windows.** BlueZ is Linux-only; all development/testing
   is done on the RPi with the real speaker (stricter than for Cast, where at least
   discovery could be inspected).

6. **Volume/stop/status have a different meaning than for Cast.** "stop" = kill the
   subprocess; "volume" = the local sink's volume (or AVRCP); "status" = the state
   of the local process, not `media_controller.status`. The now-playing title still
   comes from ICY.

7. **Latency/codec.** SBC introduces latency (irrelevant for radio, no sync). The
   speaker negotiates the codec; we don't control quality finely in v2.

### Implementation steps (in order)

#### Step 1 — Pairing + listing
- We document the manual pairing (`bluetoothctl`: `scan on`, `pair`, `trust`).
- `bt/service.py`: `BluetoothService.get_devices()` (trusted/connected speakers).
- `GET /api/output/bt/devices`. **Test:** the paired speaker appears in the list (on the RPi).

#### Step 2 — Local play/stop on the sink
- `POST /api/output/bt/play`: connect the speaker → resolve the station → URL → start
  `mpv --audio-device=<bt_sink> <url>` as a subprocess; keep the PID.
- `POST /api/output/bt/stop`: terminate the subprocess.
- **Test:** a station plays on the BT speaker; closing the UI tab doesn't stop it (runs on the RPi).

#### Step 3 — Volume + status
- `POST /api/output/bt/volume` → `pactl set-sink-volume`.
- `GET /api/output/bt/status` → the subprocess state + the ICY title.

#### Step 4 — Unified frontend
- `useRadioStore`: generalize `castTarget` → `target` (`local|cast:|bt:`);
  Play/volume/stop branch on the prefix.
- A single selector in `RadioView.vue` with all destinations.
- **Test:** switching local ↔ Cast ↔ BT from the UI, without double audio (Issue 8 v1).

## Out of scope (v2+)
- Scheduled playback (requires a scheduler first — APScheduler — which **does not exist**).
- Additional sources: TTS-on-speaker, YouTube (yt-dlp), file upload, Spotify.
- Persistent queue.
- Multi-room sync (Snapcast).
- WebSocket push instead of polling.

## Resources
- pychromecast: https://github.com/home-assistant-libs/pychromecast
- Cast media content types (supported codecs): the Google Cast documentation
- Relevant existing code: `src/main.py` (`/api/radio/*`, `radio_proxy`),
  `frontend/src/stores/radio.ts`, `data/radio/stations.json`
