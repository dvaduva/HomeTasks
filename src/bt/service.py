import os
import re
import json
import time
import signal
import shutil
import logging
import tempfile
import threading
import subprocess

logger = logging.getLogger(__name__)

CMD_TIMEOUT = 10        # seconds for a bluetoothctl/pactl shell-out
CONNECT_TIMEOUT = 15    # bluetoothctl connect can be slow on first link
SINK_WAIT = 6.0         # max seconds to wait for the A2DP sink after connect

# mpv flags: headless, quiet, never open a window or TUI, loop nothing.
MPV_BASE = ['mpv', '--no-video', '--no-terminal', '--really-quiet', '--ao=pulse']

# Substring present in every BT player's command line (the sink starts with
# bluez_output./bluez_sink.). Used to recognise our mpv processes when sweeping
# orphans, so the match can't catch unrelated mpv invocations.
PLAYER_MARKER = '--audio-device=pulse/bluez'

# Where the running player's pid + metadata is persisted. Lives in the temp dir,
# which Linux clears on reboot — exactly when any orphaned mpv would also die —
# so a stale file never outlives the process it describes. Surviving gunicorn
# worker recycles (which orphan the detached mpv) is the whole point: a fresh
# worker reads this to find and control a player it never spawned.
STATE_FILE = os.path.join(tempfile.gettempdir(), 'hometasks-bt-player.json')


class BluetoothService:
    """Plays radio to a Bluetooth A2DP speaker wired point-to-point to the RPi.

    This is the architectural inverse of Cast (``src/cast/service.py``): there is
    no network between the RPi and the speaker, so the **RPi is the player**. We
    shell out to ``mpv`` to fetch + decode the stream and push PCM into the
    PipeWire/PulseAudio sink that BlueZ routes over A2DP. The speaker only ever
    receives already-decoded audio.

    Pragmatic v2 (per docs/audio-streaming.ro.md): plain shell-outs to
    ``bluetoothctl`` / ``pactl`` / ``mpv`` — no D-Bus bindings. Pairing is manual
    and stateful (``bluetoothctl``); we only list already-paired devices, never
    scan on demand.

    A2DP is one source → one sink, so there is a single player subprocess at a
    time. Its PID lives in this singleton; ``deploy/gunicorn.conf.py`` runs
    ``workers = 1`` so every request lands in the process that holds it.

    Linux-only: BlueZ/PipeWire don't exist on Windows, so ``get_devices()``
    degrades to an empty list + a friendly ``error`` there (mirrors Cast's
    missing-dependency handling) and the control methods raise.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._proc = None       # subprocess.Popen of the running mpv, or None
        self._current = {}      # {device_id, station_id, url, title}

    # ── tool availability ────────────────────────────────────────────────────────
    @staticmethod
    def _missing_tools():
        """Return a list of the required CLI tools that aren't on PATH."""
        return [t for t in ('bluetoothctl', 'pactl', 'mpv') if shutil.which(t) is None]

    def _require_tools(self):
        missing = self._missing_tools()
        if missing:
            raise RuntimeError(
                'Lipsesc utilitare necesare pe RPi: ' + ', '.join(missing) +
                ' (instalează bluez, pipewire/pulseaudio, mpv).'
            )

    # ── persisted player state (survives gunicorn worker recycles) ───────────────
    @staticmethod
    def _save_state(data):
        try:
            with open(STATE_FILE, 'w') as f:
                json.dump(data, f)
        except OSError as e:
            logger.debug("bt: could not persist player state: %s", e)

    @staticmethod
    def _load_state():
        try:
            with open(STATE_FILE) as f:
                return json.load(f) or {}
        except (OSError, ValueError):
            return {}

    @staticmethod
    def _clear_state():
        try:
            os.remove(STATE_FILE)
        except OSError:
            pass

    # ── orphan process reconciliation ────────────────────────────────────────────
    @staticmethod
    def _find_player_pids():
        """PIDs of every BT mpv player currently running, regardless of which
        gunicorn worker spawned it. Scans /proc directly (no extra CLI deps), so a
        worker recycled out from under a detached mpv can still find and kill it.
        Returns [] off Linux (no /proc) — harmless on dev/CI."""
        pids = []
        try:
            entries = os.listdir('/proc')
        except OSError:
            return pids
        for name in entries:
            if not name.isdigit():
                continue
            try:
                with open(f'/proc/{name}/cmdline', 'rb') as f:
                    parts = f.read().split(b'\0')
            except OSError:
                continue  # process gone or not ours to read
            if not parts or os.path.basename(parts[0]) != b'mpv':
                continue
            if any(p.startswith(PLAYER_MARKER.encode()) for p in parts):
                pids.append(int(name))
        return pids

    @staticmethod
    def _pid_alive(pid):
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    @classmethod
    def _kill_pid(cls, pid):
        """SIGTERM, then SIGKILL if it doesn't exit within ~3s."""
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            return
        for _ in range(30):
            if not cls._pid_alive(pid):
                return
            time.sleep(0.1)
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass

    @staticmethod
    def _run(cmd, timeout=CMD_TIMEOUT):
        """Run a command, returning (returncode, stdout). stderr is folded in so a
        failure message is visible in logs. Never raises for a non-zero exit."""
        try:
            r = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout,
            )
            return r.returncode, (r.stdout or '') + (r.stderr or '')
        except Exception as e:
            logger.debug("bt: command failed %s: %s", cmd, e)
            return 1, str(e)

    # ── discovery (paired devices only) ──────────────────────────────────────────
    def is_available(self):
        """True when the host can actually do Bluetooth (i.e. we're on the RPi).
        The frontend uses this to show the pairing UI only where it works."""
        return not self._missing_tools()

    def get_devices(self):
        """List paired Bluetooth speakers as {id, name, connected, paired}.

        Never scans (scanning is slow and disrupts an active A2DP link). Returns
        an envelope like CastService plus an ``available`` flag:
        {'devices': [...], 'error': str?, 'available': bool}.
        """
        missing = self._missing_tools()
        if missing:
            return {
                'devices': [], 'available': False,
                'error': 'Bluetooth indisponibil aici: lipsesc ' + ', '.join(missing) +
                         ' (funcționează doar pe RPi cu BlueZ).',
            }

        rc, out = self._run(['bluetoothctl', 'devices', 'Paired'])
        # Older bluetoothctl has no `devices Paired` subfilter — fall back to the
        # full list and rely on per-device flags.
        if rc != 0 or 'Device' not in out:
            rc, out = self._run(['bluetoothctl', 'devices'])
        if rc != 0:
            return {'devices': [], 'available': True,
                    'error': 'bluetoothctl a eșuat (BlueZ pornit?).'}

        devices = [d for d in self._parse_devices(out) if d['paired']]
        return {'devices': devices, 'available': True, 'error': None}

    def _parse_devices(self, out):
        """Parse `bluetoothctl devices` output, resolving paired/connected flags
        per device with a single `info` call each."""
        devices = []
        for line in out.splitlines():
            m = re.match(r'\s*Device\s+([0-9A-Fa-f:]{17})\s+(.*)', line)
            if not m:
                continue
            mac, name = m.group(1).upper(), m.group(2).strip()
            paired, connected = self._info_flags(mac)
            devices.append({
                'id': mac, 'name': name or mac,
                'connected': connected, 'paired': paired,
            })
        return devices

    def _info_flags(self, mac):
        """Return (paired, connected) for a device from one `bluetoothctl info`."""
        rc, out = self._run(['bluetoothctl', 'info', mac])
        if rc != 0:
            return False, False
        paired = bool(re.search(r'Paired:\s*yes', out, re.IGNORECASE))
        connected = bool(re.search(r'Connected:\s*yes', out, re.IGNORECASE))
        return paired, connected

    def _is_connected(self, mac):
        return self._info_flags(mac)[1]

    # ── pairing (manual setup, now exposed in the UI) ────────────────────────────
    def scan(self, timeout=10):
        """Run a bounded discovery window, then return every known device
        (paired + freshly discovered) so the UI can offer pairing. Bounded because
        an open-ended scan is slow and disturbs an active A2DP link."""
        self._require_tools()
        timeout = max(3, min(30, int(timeout)))
        # `--timeout N scan on` blocks for N seconds then exits cleanly.
        self._run(['bluetoothctl', '--timeout', str(timeout), 'scan', 'on'],
                  timeout=timeout + 5)
        rc, out = self._run(['bluetoothctl', 'devices'])
        if rc != 0:
            raise RuntimeError('bluetoothctl a eșuat (BlueZ pornit?).')
        return {'devices': self._parse_devices(out)}

    def pair(self, device_id):
        """Pair + trust + connect a speaker (the one-time manual flow, automated).
        ``trust`` is what enables automatic reconnect afterwards."""
        self._require_tools()
        mac = (device_id or '').upper()
        for verb in ('pair', 'trust', 'connect'):
            rc, out = self._run(['bluetoothctl', verb, mac], timeout=CONNECT_TIMEOUT)
            # `pair` on an already-paired device returns non-zero with a benign
            # "already" message — tolerate it and keep going.
            if rc != 0 and 'already' not in out.lower():
                if verb == 'pair':
                    raise RuntimeError(f'Pairing a eșuat pentru {mac}: {out.strip()[:200]}')
                logger.debug("bt: %s on %s returned: %s", verb, mac, out.strip())
        paired, connected = self._info_flags(mac)
        if not paired:
            raise RuntimeError(f'Boxa {mac} nu s-a împerecheat (cod PIN / mod pairing?).')
        return {'id': mac, 'paired': paired, 'connected': connected}

    def remove(self, device_id):
        """Forget a device (unpair). Stops the player first if it's the one in use."""
        self._require_tools()
        mac = (device_id or '').upper()
        with self._lock:
            if self._current.get('device_id') == mac:
                self._kill_locked()
                self._current = {}
        rc, out = self._run(['bluetoothctl', 'remove', mac])
        if rc != 0 and 'not available' not in out.lower():
            raise RuntimeError(f'Nu am putut uita boxa {mac}: {out.strip()[:200]}')
        return {'id': mac, 'removed': True}

    # ── connection ───────────────────────────────────────────────────────────────
    def _connect(self, mac):
        """Connect the speaker if not already connected. Assumes it's already
        paired + trusted (manual one-time setup via bluetoothctl)."""
        if self._is_connected(mac):
            return
        rc, out = self._run(['bluetoothctl', 'connect', mac], timeout=CONNECT_TIMEOUT)
        if rc != 0 or not self._is_connected(mac):
            raise RuntimeError(
                f'Nu m-am putut conecta la boxa {mac}. Asigură-te că e pereche '
                f'(pair + trust) și pornită.'
            )

    # ── sink resolution ──────────────────────────────────────────────────────────
    # The MAC underscored is the stable part of a Bluetooth sink name; the prefix
    # depends on the audio stack: PipeWire / newer PulseAudio expose
    # `bluez_output.<MAC>.…`, while older PulseAudio (e.g. 14.x on RPi Bullseye)
    # exposes `bluez_sink.<MAC>.…a2dp_sink`. Match the MAC, not the prefix.
    SINK_PREFIXES = ('bluez_output.', 'bluez_sink.')

    @staticmethod
    def _sink_token(mac):
        """The MAC fragment present in any Bluetooth sink name:
        AA:BB:CC:DD:EE:FF -> AA_BB_CC_DD_EE_FF"""
        return mac.upper().replace(':', '_')

    def _find_sink(self, mac, wait=SINK_WAIT):
        """Return the full PulseAudio/PipeWire sink name for the connected speaker,
        waiting briefly because the sink appears a moment after connect."""
        import time
        token = self._sink_token(mac)
        deadline = time.time() + wait
        while True:
            rc, out = self._run(['pactl', 'list', 'short', 'sinks'])
            if rc == 0:
                for line in out.splitlines():
                    # columns: index  name  driver  sample-spec  state
                    parts = line.split('\t')
                    if (len(parts) >= 2
                            and parts[1].startswith(self.SINK_PREFIXES)
                            and token in parts[1]):
                        return parts[1]
            if time.time() >= deadline:
                raise RuntimeError(
                    'Sink-ul audio Bluetooth nu a apărut (A2DP neactiv?). '
                    'Verifică profilul boxei în pavucontrol/pactl.'
                )
            time.sleep(0.4)

    # ── playback ─────────────────────────────────────────────────────────────────
    def play(self, device_id, url, title=None, station_id=None):
        """Connect the speaker, then start a detached mpv that decodes ``url`` into
        its A2DP sink. Replaces any currently running player (single A2DP sink)."""
        self._require_tools()
        mac = (device_id or '').upper()
        with self._lock:
            self._connect(mac)
            sink = self._find_sink(mac)
            self._kill_locked()

            cmd = MPV_BASE + [f'--audio-device=pulse/{sink}', url]
            try:
                # start_new_session detaches from the request thread's process
                # group so the player keeps running after the response returns.
                self._proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
            except Exception as e:
                self._proc = None
                raise RuntimeError(f'Nu am putut porni mpv: {e}')

            self._current = {
                'device_id': mac, 'station_id': station_id, 'url': url, 'title': title,
            }
            # Persist pid + metadata so a recycled worker (which loses self._proc)
            # can still find, report and stop this exact player.
            self._save_state(dict(self._current, pid=getattr(self._proc, 'pid', None)))
            logger.info("BT play on %s (sink=%s): %s", mac, sink, url)
            return True

    def stop(self, device_id=None):
        """Stop the player subprocess (no-op if nothing is playing)."""
        with self._lock:
            self._kill_locked()
            self._current = {}
            logger.info("BT stop (%s)", device_id or 'current')
            return True

    def _kill_locked(self):
        """Stop every BT player and clear persisted state. Caller holds ``self._lock``.

        Kills both the player this worker owns *and* any orphan mpv left behind by
        a previously recycled worker (mpv is detached via start_new_session, so a
        gunicorn recycle — see max_requests in gunicorn.conf.py — would otherwise
        leave an unstoppable player that the next Play stacks a second stream on
        top of). Sweeping by /proc scan makes Stop reliable across recycles."""
        proc = self._proc
        self._proc = None
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
            except Exception as e:
                logger.debug("bt: kill failed: %s", e)
        # Sweep any orphans this worker never held a handle to.
        for pid in self._find_player_pids():
            self._kill_pid(pid)
        self._clear_state()

    def set_volume(self, device_id, volume):
        """Set the BT sink volume. ``volume`` is 0.0–1.0 (clamped)."""
        self._require_tools()
        v = max(0.0, min(1.0, float(volume)))
        mac = (device_id or '').upper()
        sink = self._find_sink(mac, wait=1.0)
        pct = round(v * 100)
        rc, out = self._run(['pactl', 'set-sink-volume', sink, f'{pct}%'])
        if rc != 0:
            raise RuntimeError(f'pactl set-sink-volume a eșuat: {out.strip()}')
        logger.info("BT volume on %s -> %d%%", mac, pct)
        return v

    def status(self, device_id=None):
        """Player state derived from the subprocess: 'playing' or 'idle'. The ICY
        now-playing title is merged by the route, not here."""
        with self._lock:
            playing = self._proc is not None and self._proc.poll() is None
            cur = dict(self._current) if playing else {}
            if not playing and self._find_player_pids():
                # A player is running that this (likely recycled) worker never
                # spawned. Report it as playing — with metadata recovered from the
                # state file — so Stop still works and the UI doesn't start a
                # second, overlapping stream.
                playing = True
                cur = self._load_state()
        return {
            'device_id': device_id or cur.get('device_id'),
            'state': 'playing' if playing else 'idle',
            'station_id': cur.get('station_id'),
        }


bluetooth_service = BluetoothService()
