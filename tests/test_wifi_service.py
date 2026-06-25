"""Unit tests for WiFiService (src/wifi/service.py).

The service only ever talks to the outside world through ``subprocess`` and
``shutil.which``, so we stub those and assert on the commands it builds and how
it parses ``nmcli`` output. Fully platform-independent — runs on Windows/CI
without NetworkManager installed.
"""
import pytest

import wifi.service as wifi_mod
from wifi.service import WiFiService


class FakeCompleted:
    def __init__(self, returncode=0, stdout='', stderr=''):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


# `nmcli -t -f IN-USE,SIGNAL,SECURITY,SSID device wifi list` style output.
SCAN_OUT = (
    '*:72:WPA2:HomeNet\n'
    ' :55:WPA2:HomeNet\n'        # weaker duplicate of the connected SSID
    ' :90:WPA1 WPA2:Neighbour\n'
    ' :40::OpenCafe\n'           # open network (empty security)
    ' :88:WPA2:\n'               # hidden network (empty SSID) — dropped
)


def default_handler(cmd):
    """Happy path: nmcli present, connected to HomeNet on wlan0 @ 192.168.0.5."""
    if cmd[:5] == ['nmcli', '-t', '-f', 'IN-USE,SIGNAL,SECURITY,SSID', 'device']:
        return 0, SCAN_OUT
    if cmd[:5] == ['nmcli', '-t', '-f', 'IN-USE,SSID,DEVICE', 'device']:
        return 0, '*:HomeNet:wlan0\n :Neighbour:wlan0\n'
    if cmd[:4] == ['nmcli', '-t', '-f', 'IP4.ADDRESS']:
        return 0, 'IP4.ADDRESS[1]:192.168.0.5/24\n'
    if cmd[:4] == ['nmcli', 'device', 'wifi', 'connect']:
        return 0, 'Device successfully activated'
    if cmd[:3] == ['nmcli', 'device', 'disconnect']:
        return 0, ''
    if cmd[:4] == ['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE']:
        return 0, 'wlan0:wifi:connected\nlo:loopback:unmanaged\n'
    return 0, ''


@pytest.fixture
def svc(monkeypatch):
    calls = []
    monkeypatch.setattr(wifi_mod.shutil, 'which', lambda name: f'/usr/bin/{name}')

    service = WiFiService()
    service._handler = default_handler  # type: ignore[attr-defined]

    def fake_run(cmd, capture_output=True, text=True, timeout=None):
        cmd = list(cmd)
        calls.append(cmd)
        rc, out = service._handler(cmd)  # type: ignore[attr-defined]
        return FakeCompleted(rc, out, '')

    monkeypatch.setattr(wifi_mod.subprocess, 'run', fake_run)
    return service, calls


def _cmds(calls):
    return [' '.join(str(p) for p in c) for c in calls]


# ── availability ───────────────────────────────────────────────────────────────
def test_missing_tools_reported(monkeypatch):
    monkeypatch.setattr(wifi_mod.shutil, 'which', lambda name: None)
    service = WiFiService()
    assert service.is_available() is False
    res = service.scan()
    assert res['available'] is False
    assert res['networks'] == []
    assert 'nmcli' in res['error']
    assert service.status() == {'available': False, 'connected': False, 'ssid': None, 'ip': None}


# ── terse parsing ──────────────────────────────────────────────────────────────
def test_split_terse_honours_escaped_colon():
    # SSID "My:Net" arrives escaped as "My\:Net".
    assert WiFiService._split_terse(r'*:72:WPA2:My\:Net') == ['*', '72', 'WPA2', 'My:Net']


# ── scan ───────────────────────────────────────────────────────────────────────
def test_scan_parses_dedupes_and_sorts(svc):
    service, _ = svc
    res = service.scan()
    assert res['available'] is True and res['error'] is None
    ssids = [n['ssid'] for n in res['networks']]
    # Hidden (empty SSID) dropped; HomeNet deduped to one entry; sorted by signal.
    assert ssids == ['Neighbour', 'HomeNet', 'OpenCafe']
    home = next(n for n in res['networks'] if n['ssid'] == 'HomeNet')
    assert home['signal'] == 72 and home['in_use'] is True and home['security'] == 'WPA2'
    cafe = next(n for n in res['networks'] if n['ssid'] == 'OpenCafe')
    assert cafe['security'] is None  # open network


def test_scan_passes_rescan_flag(svc):
    service, calls = svc
    service.scan()
    assert any('--rescan yes' in c for c in _cmds(calls))


# ── status ─────────────────────────────────────────────────────────────────────
def test_status_reports_connection_and_ip(svc):
    service, _ = svc
    st = service.status()
    assert st == {'available': True, 'connected': True, 'ssid': 'HomeNet', 'ip': '192.168.0.5'}


def test_status_disconnected(svc):
    service, _ = svc

    def handler(cmd):
        if cmd[:5] == ['nmcli', '-t', '-f', 'IN-USE,SSID,DEVICE', 'device']:
            return 0, ' :Neighbour:wlan0\n'  # nothing in use
        return default_handler(cmd)

    service._handler = handler
    st = service.status()
    assert st['connected'] is False and st['ssid'] is None and st['ip'] is None


# ── connect ────────────────────────────────────────────────────────────────────
def test_connect_builds_command_with_password(svc):
    service, calls = svc
    res = service.connect('HomeNet', 'secret123')
    assert res == {'ssid': 'HomeNet', 'connected': True}
    assert ['nmcli', 'device', 'wifi', 'connect', 'HomeNet', 'password', 'secret123'] in calls


def test_connect_open_network_no_password(svc):
    service, calls = svc
    service.connect('OpenCafe')
    assert ['nmcli', 'device', 'wifi', 'connect', 'OpenCafe'] in calls


def test_connect_hidden_flag(svc):
    service, calls = svc
    service.connect('Stealth', 'pw', hidden=True)
    assert ['nmcli', 'device', 'wifi', 'connect', 'Stealth', 'password', 'pw', 'hidden', 'yes'] in calls


def test_connect_requires_ssid(svc):
    service, _ = svc
    with pytest.raises(RuntimeError):
        service.connect('   ')


def test_connect_failure_raises(svc):
    service, _ = svc

    def handler(cmd):
        if cmd[:4] == ['nmcli', 'device', 'wifi', 'connect']:
            return 1, 'Error: No network with SSID found.'
        return default_handler(cmd)

    service._handler = handler
    with pytest.raises(RuntimeError):
        service.connect('HomeNet', 'badpass')


def test_connect_polkit_denial_gives_friendly_hint(svc):
    service, _ = svc

    def handler(cmd):
        if cmd[:4] == ['nmcli', 'device', 'wifi', 'connect']:
            return 1, 'Error: Failed to add/activate new connection: Insufficient privileges'
        return default_handler(cmd)

    service._handler = handler
    with pytest.raises(RuntimeError) as exc:
        service.connect('HomeNet', 'pw')
    # Raw nmcli text is replaced with an actionable polkit hint.
    assert 'polkit' in str(exc.value)
    assert 'Insufficient privileges' not in str(exc.value)


def test_connect_requires_tools(monkeypatch):
    monkeypatch.setattr(wifi_mod.shutil, 'which', lambda name: None)
    with pytest.raises(RuntimeError):
        WiFiService().connect('HomeNet', 'pw')


# ── disconnect ─────────────────────────────────────────────────────────────────
def test_disconnect_takes_down_active_device(svc):
    service, calls = svc
    res = service.disconnect()
    assert res == {'connected': False}
    assert ['nmcli', 'device', 'disconnect', 'wlan0'] in calls


def test_disconnect_noop_when_nothing_connected(svc):
    service, calls = svc

    def handler(cmd):
        if cmd[:4] == ['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE']:
            return 0, 'wlan0:wifi:disconnected\n'
        return default_handler(cmd)

    service._handler = handler
    assert service.disconnect() == {'connected': False}
    assert not any(c[:3] == ['nmcli', 'device', 'disconnect'] for c in calls)
