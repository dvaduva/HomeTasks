"""Unit tests for BluetoothService (src/bt/service.py).

The service only ever talks to the outside world through ``subprocess`` and
``shutil.which``, so we stub those and assert on the commands it builds and how
it parses their output. This makes the tests fully platform-independent — they
run on Windows/CI without BlueZ, mpv or PipeWire installed.
"""
import pytest

import bt.service as bt_mod
from bt.service import BluetoothService

MAC = 'AA:BB:CC:DD:EE:FF'
SINK = 'bluez_output.AA_BB_CC_DD_EE_FF.1'


# ── test doubles ─────────────────────────────────────────────────────────────────
class FakeCompleted:
    def __init__(self, returncode=0, stdout='', stderr=''):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class FakeProc:
    """Stand-in for subprocess.Popen — alive until terminated/killed."""
    def __init__(self, cmd, alive=True):
        self.cmd = cmd
        self._alive = alive
        self.terminated = False
        self.killed = False

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self.terminated = True
        self._alive = False

    def wait(self, timeout=None):
        return 0

    def kill(self):
        self.killed = True
        self._alive = False


def default_handler(cmd):
    """Maps a command to (returncode, stdout) for the happy path: tools present,
    one paired+connected JBL speaker, its A2DP sink active."""
    if cmd[0] == 'bluetoothctl' and cmd[1] == 'devices':
        return 0, f'Device {MAC} JBL Speaker\n'
    if cmd[0] == 'bluetoothctl' and cmd[1] == 'info':
        return 0, 'Paired: yes\nConnected: yes\n'
    if cmd[0] == 'bluetoothctl' and cmd[1] in ('pair', 'trust', 'connect', 'remove'):
        return 0, ''
    if cmd[0] == 'bluetoothctl' and cmd[1] == '--timeout':  # scan window
        return 0, ''
    if cmd[0] == 'pactl' and cmd[1] == 'list':
        return 0, f'0\t{SINK}\tmodule-bluez5\ts16le 2ch 44100Hz\tRUNNING\n'
    if cmd[0] == 'pactl' and cmd[1] == 'set-sink-volume':
        return 0, ''
    return 0, ''


@pytest.fixture
def svc(monkeypatch):
    """A BluetoothService wired to fakes. Returns (service, calls, procs); the
    handler can be swapped per-test via ``service._handler``."""
    calls = []
    procs = []

    monkeypatch.setattr(bt_mod.shutil, 'which', lambda name: f'/usr/bin/{name}')

    service = BluetoothService()
    service._handler = default_handler  # type: ignore[attr-defined]

    def fake_run(cmd, capture_output=True, text=True, timeout=None):
        cmd = list(cmd)
        calls.append(cmd)
        rc, out = service._handler(cmd)  # type: ignore[attr-defined]
        return FakeCompleted(rc, out, '')

    def fake_popen(cmd, **kwargs):
        p = FakeProc(list(cmd))
        procs.append(p)
        return p

    monkeypatch.setattr(bt_mod.subprocess, 'run', fake_run)
    monkeypatch.setattr(bt_mod.subprocess, 'Popen', fake_popen)
    return service, calls, procs


def _cmds(calls):
    """Flatten recorded commands to space-joined strings for easy matching."""
    return [' '.join(str(p) for p in c) for c in calls]


# ── discovery / availability ─────────────────────────────────────────────────────
def test_missing_tools_reported(monkeypatch):
    monkeypatch.setattr(bt_mod.shutil, 'which', lambda name: None)
    service = BluetoothService()
    assert service.is_available() is False
    res = service.get_devices()
    assert res['available'] is False
    assert res['devices'] == []
    assert 'bluetoothctl' in res['error']


def test_get_devices_lists_paired_with_flags(svc):
    service, calls, _ = svc
    res = service.get_devices()
    assert res['available'] is True
    assert res['error'] is None
    assert res['devices'] == [
        {'id': MAC, 'name': 'JBL Speaker', 'connected': True, 'paired': True},
    ]


def test_get_devices_excludes_unpaired(svc):
    service, _, _ = svc

    def handler(cmd):
        if cmd[0] == 'bluetoothctl' and cmd[1] == 'info':
            return 0, 'Paired: no\nConnected: no\n'
        return default_handler(cmd)

    service._handler = handler
    assert service.get_devices()['devices'] == []


# ── sink resolution ──────────────────────────────────────────────────────────────
def test_sink_token():
    assert BluetoothService._sink_token(MAC) == 'bluez_output.AA_BB_CC_DD_EE_FF'


def test_find_sink_found(svc):
    service, _, _ = svc
    assert service._find_sink(MAC, wait=0) == SINK


def test_find_sink_missing_raises(svc):
    service, _, _ = svc

    def handler(cmd):
        if cmd[0] == 'pactl' and cmd[1] == 'list':
            return 0, '0\tother.sink\tmodule\ts16le\tRUNNING\n'
        return default_handler(cmd)

    service._handler = handler
    with pytest.raises(RuntimeError):
        service._find_sink(MAC, wait=0)


# ── playback ─────────────────────────────────────────────────────────────────────
def test_play_builds_mpv_command(svc):
    service, calls, procs = svc
    service.play(MAC, 'http://stream/radio', title='S', station_id='s1')

    assert len(procs) == 1
    cmd = procs[0].cmd
    assert cmd[0] == 'mpv'
    assert f'--audio-device=pulse/{SINK}' in cmd
    assert cmd[-1] == 'http://stream/radio'
    # already connected → no explicit `connect` call needed
    assert not any(c[:2] == ['bluetoothctl', 'connect'] for c in calls)


def test_play_connects_when_disconnected(svc):
    service, calls, _ = svc
    state = {'connected': False}

    def handler(cmd):
        if cmd[0] == 'bluetoothctl' and cmd[1] == 'info':
            conn = 'yes' if state['connected'] else 'no'
            return 0, f'Paired: yes\nConnected: {conn}\n'
        if cmd[0] == 'bluetoothctl' and cmd[1] == 'connect':
            state['connected'] = True
            return 0, ''
        return default_handler(cmd)

    service._handler = handler
    service.play(MAC, 'http://x')
    assert any(c[:2] == ['bluetoothctl', 'connect'] for c in calls)


def test_play_replaces_existing_player(svc):
    service, _, procs = svc
    service.play(MAC, 'http://one')
    service.play(MAC, 'http://two')
    assert len(procs) == 2
    assert procs[0].terminated is True   # old player killed
    assert procs[1].poll() is None       # new one running


def test_stop_kills_player(svc):
    service, _, procs = svc
    service.play(MAC, 'http://x', station_id='s1')
    service.stop(MAC)
    assert procs[0].terminated is True
    assert service.status()['state'] == 'idle'


# ── status ───────────────────────────────────────────────────────────────────────
def test_status_playing_then_idle(svc):
    service, _, _ = svc
    assert service.status()['state'] == 'idle'
    service.play(MAC, 'http://x', station_id='s1')
    st = service.status()
    assert st['state'] == 'playing'
    assert st['station_id'] == 's1'
    assert st['device_id'] == MAC


# ── volume ───────────────────────────────────────────────────────────────────────
def test_set_volume_calls_pactl_with_percent(svc):
    service, calls, _ = svc
    applied = service.set_volume(MAC, 0.5)
    assert applied == 0.5
    assert ['pactl', 'set-sink-volume', SINK, '50%'] in calls


def test_set_volume_clamps_above_one(svc):
    service, calls, _ = svc
    assert service.set_volume(MAC, 3.0) == 1.0
    assert ['pactl', 'set-sink-volume', SINK, '100%'] in calls


# ── pairing ──────────────────────────────────────────────────────────────────────
def test_pair_runs_pair_trust_connect(svc):
    service, calls, _ = svc
    res = service.pair(MAC)
    assert res == {'id': MAC, 'paired': True, 'connected': True}
    joined = _cmds(calls)
    assert f'bluetoothctl pair {MAC}' in joined
    assert f'bluetoothctl trust {MAC}' in joined
    assert f'bluetoothctl connect {MAC}' in joined


def test_pair_raises_when_not_paired(svc):
    service, _, _ = svc

    def handler(cmd):
        if cmd[0] == 'bluetoothctl' and cmd[1] == 'info':
            return 0, 'Paired: no\nConnected: no\n'
        return default_handler(cmd)

    service._handler = handler
    with pytest.raises(RuntimeError):
        service.pair(MAC)


def test_pair_tolerates_already_paired(svc):
    service, _, _ = svc

    def handler(cmd):
        if cmd[0] == 'bluetoothctl' and cmd[1] == 'pair':
            return 1, 'Device AA:BB:CC:DD:EE:FF already paired'
        return default_handler(cmd)

    service._handler = handler
    # Should not raise: 'already' is benign, and info still reports Paired: yes.
    assert service.pair(MAC)['paired'] is True


def test_remove_runs_remove(svc):
    service, calls, _ = svc
    res = service.remove(MAC)
    assert res == {'id': MAC, 'removed': True}
    assert ['bluetoothctl', 'remove', MAC] in calls


def test_remove_stops_player_if_in_use(svc):
    service, _, procs = svc
    service.play(MAC, 'http://x', station_id='s1')
    service.remove(MAC)
    assert procs[0].terminated is True


# ── scan ─────────────────────────────────────────────────────────────────────────
def test_scan_returns_devices(svc):
    service, calls, _ = svc
    res = service.scan(5)
    assert res['devices'] == [
        {'id': MAC, 'name': 'JBL Speaker', 'connected': True, 'paired': True},
    ]
    assert any(c[:2] == ['bluetoothctl', '--timeout'] for c in calls)


def test_scan_requires_tools(monkeypatch):
    monkeypatch.setattr(bt_mod.shutil, 'which', lambda name: None)
    with pytest.raises(RuntimeError):
        BluetoothService().scan(5)
