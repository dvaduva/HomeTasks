import shutil
import logging
import threading
import subprocess

logger = logging.getLogger(__name__)

CMD_TIMEOUT = 12        # seconds for a quick nmcli query (scan/status)
CONNECT_TIMEOUT = 45    # joining a network (DHCP + auth) can be slow


class WiFiService:
    """Manages the RPi's own Wi-Fi connection from the kiosk UI.

    Like ``BluetoothService`` (``src/bt/service.py``) this is a thin, stateful
    wrapper over a system CLI — here ``nmcli`` (NetworkManager), the default on
    Raspberry Pi OS Bookworm. We never touch ``wpa_supplicant.conf`` directly;
    NetworkManager owns the saved profiles and reconnects on its own.

    Linux/RPi-only: ``nmcli`` doesn't exist on Windows, so ``scan()`` degrades to
    an empty list + a friendly ``error`` (mirrors Bluetooth/Cast) and the control
    methods raise. The frontend uses ``is_available()`` to show the UI only where
    it works.
    """

    def __init__(self):
        self._lock = threading.Lock()

    # ── tool availability ────────────────────────────────────────────────────────
    @staticmethod
    def _missing_tools():
        """Return the required CLI tools that aren't on PATH (just nmcli)."""
        return [t for t in ('nmcli',) if shutil.which(t) is None]

    def _require_tools(self):
        missing = self._missing_tools()
        if missing:
            raise RuntimeError(
                'Lipsește NetworkManager (nmcli) pe acest sistem — '
                'configurarea Wi-Fi funcționează doar pe RPi.'
            )

    def is_available(self):
        """True when the host can actually manage Wi-Fi (i.e. we're on the RPi)."""
        return not self._missing_tools()

    @staticmethod
    def _run(cmd, timeout=CMD_TIMEOUT):
        """Run a command, returning (returncode, stdout+stderr). Never raises."""
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return r.returncode, (r.stdout or '') + (r.stderr or '')
        except Exception as e:
            logger.debug("wifi: command failed %s: %s", cmd, e)
            return 1, str(e)

    @staticmethod
    def _split_terse(line):
        """Split an ``nmcli -t`` row on unescaped ``:`` separators.

        nmcli escapes literal colons and backslashes inside fields as ``\\:`` /
        ``\\\\`` in terse mode, so SSIDs containing ``:`` survive a naive split if
        we honour the escaping."""
        fields, cur, esc = [], [], False
        for ch in line:
            if esc:
                cur.append(ch)
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == ':':
                fields.append(''.join(cur))
                cur = []
            else:
                cur.append(ch)
        fields.append(''.join(cur))
        return fields

    # ── discovery ────────────────────────────────────────────────────────────────
    def scan(self):
        """Scan for nearby Wi-Fi networks.

        Returns an envelope like the Bluetooth service:
        {'networks': [{ssid, signal, security, in_use}], 'available': bool, 'error': str?}.
        Networks are deduplicated by SSID (strongest signal wins) and sorted by
        signal descending; hidden/empty SSIDs are dropped.
        """
        missing = self._missing_tools()
        if missing:
            return {
                'networks': [], 'available': False,
                'error': 'Wi-Fi indisponibil aici: lipsește nmcli '
                         '(funcționează doar pe RPi cu NetworkManager).',
            }

        # `--rescan yes` forces a fresh scan; fields ordered with SSID last.
        rc, out = self._run([
            'nmcli', '-t', '-f', 'IN-USE,SIGNAL,SECURITY,SSID',
            'device', 'wifi', 'list', '--rescan', 'yes',
        ], timeout=20)
        if rc != 0:
            return {'networks': [], 'available': True,
                    'error': 'nmcli a eșuat (NetworkManager pornit?).'}

        by_ssid = {}
        for line in out.splitlines():
            if not line.strip():
                continue
            parts = self._split_terse(line)
            if len(parts) < 4:
                continue
            in_use, signal, security = parts[0], parts[1], parts[2]
            ssid = ':'.join(parts[3:]) if len(parts) > 4 else parts[3]
            ssid = ssid.strip()
            if not ssid:
                continue  # hidden network
            try:
                sig = int(signal)
            except ValueError:
                sig = 0
            net = {
                'ssid': ssid,
                'signal': sig,
                'security': (security or '').strip() or None,
                'in_use': in_use.strip() == '*',
            }
            prev = by_ssid.get(ssid)
            if prev is None or net['signal'] > prev['signal'] or net['in_use']:
                by_ssid[ssid] = net

        networks = sorted(by_ssid.values(), key=lambda n: n['signal'], reverse=True)
        return {'networks': networks, 'available': True, 'error': None}

    # ── status ───────────────────────────────────────────────────────────────────
    def status(self):
        """Return {available, connected, ssid, ip}. ``ip`` is the IPv4 of the
        active Wi-Fi device, or None."""
        missing = self._missing_tools()
        if missing:
            return {'available': False, 'connected': False, 'ssid': None, 'ip': None}

        ssid, device = None, None
        rc, out = self._run([
            'nmcli', '-t', '-f', 'IN-USE,SSID,DEVICE', 'device', 'wifi',
        ])
        if rc == 0:
            for line in out.splitlines():
                parts = self._split_terse(line)
                if len(parts) >= 3 and parts[0].strip() == '*':
                    ssid = (':'.join(parts[1:-1])).strip() or None
                    device = parts[-1].strip() or None
                    break

        ip = None
        if device:
            rc, out = self._run(['nmcli', '-t', '-f', 'IP4.ADDRESS', 'device', 'show', device])
            if rc == 0:
                for line in out.splitlines():
                    if line.startswith('IP4.ADDRESS'):
                        # IP4.ADDRESS[1]:192.168.0.5/24
                        val = self._split_terse(line)[-1].strip()
                        ip = val.split('/')[0] or None
                        break

        return {
            'available': True,
            'connected': bool(ssid),
            'ssid': ssid,
            'ip': ip,
        }

    # ── connection ───────────────────────────────────────────────────────────────
    def connect(self, ssid, password=None, hidden=False):
        """Join a Wi-Fi network. NetworkManager saves the profile and reconnects
        automatically afterwards. Raises with a friendly message on failure."""
        self._require_tools()
        ssid = (ssid or '').strip()
        if not ssid:
            raise RuntimeError('SSID este obligatoriu.')

        cmd = ['nmcli', 'device', 'wifi', 'connect', ssid]
        if password:
            cmd += ['password', password]
        if hidden:
            cmd += ['hidden', 'yes']

        with self._lock:
            rc, out = self._run(cmd, timeout=CONNECT_TIMEOUT)
        if rc != 0:
            msg = out.strip().splitlines()[-1] if out.strip() else 'cauză necunoscută'
            # polkit refuses the systemd service (no graphical session) unless the
            # `pi` user has rights to manage NetworkManager. Point the operator at
            # the deploy fix instead of leaking the raw nmcli text.
            low = out.lower()
            if 'not authorized' in low or 'insufficient privileges' in low:
                raise RuntimeError(
                    'Conectarea a eșuat: aplicația nu are drepturi să administreze '
                    'rețeaua (polkit). Vezi deploy/DEPLOY.md → „Permite userului '
                    'serviciului să administreze rețeaua".'
                )
            raise RuntimeError(f'Conectarea la „{ssid}" a eșuat: {msg[:200]}')
        logger.info("Wi-Fi connected to %s", ssid)
        return {'ssid': ssid, 'connected': True}

    def disconnect(self):
        """Disconnect the active Wi-Fi device (the saved profile is kept)."""
        self._require_tools()
        # Find the connected Wi-Fi device, then take it down.
        rc, out = self._run(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE', 'device'])
        device = None
        if rc == 0:
            for line in out.splitlines():
                parts = self._split_terse(line)
                if len(parts) >= 3 and parts[1].strip() == 'wifi' and parts[2].strip() == 'connected':
                    device = parts[0].strip()
                    break
        if not device:
            return {'connected': False}
        with self._lock:
            rc, out = self._run(['nmcli', 'device', 'disconnect', device])
        if rc != 0:
            raise RuntimeError(f'Deconectarea a eșuat: {out.strip()[:200]}')
        logger.info("Wi-Fi disconnected (%s)", device)
        return {'connected': False}


wifi_service = WiFiService()
