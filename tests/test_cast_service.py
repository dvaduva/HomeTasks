"""Unit tests for CastService (src/cast/service.py).

Control methods route through _get_cast, which we patch with a fake Chromecast
so no pychromecast / LAN device is needed. _await_playing is tested directly
against a fake media-controller status.
"""
import pytest

from cast.service import CastService


class FakeMediaController:
    def __init__(self, states):
        # states: list of (player_state, idle_reason) yielded on each .status read
        self._states = list(states)
        self.played = None
        self.stopped = False

    @property
    def status(self):
        # Hold the last state once exhausted.
        ps, ir = self._states[0] if self._states else ('IDLE', None)
        if len(self._states) > 1:
            self._states.pop(0)
        return type('St', (), {'player_state': ps, 'idle_reason': ir,
                               'title': 'T', 'content_id': 'C'})()

    def play_media(self, url, content_type, title=None, stream_type=None):
        self.played = (url, content_type, title, stream_type)

    def block_until_active(self, timeout=None):
        pass

    def stop(self):
        self.stopped = True


class FakeCast:
    def __init__(self, states=(('PLAYING', None),)):
        self.media_controller = FakeMediaController(states)
        self._volume = None
        self.quit_called = False
        self.status = type('Cs', (), {'volume_level': 0.5, 'volume_muted': False,
                                      'display_name': 'Default Media Receiver'})()

    def set_volume(self, v):
        self._volume = v

    def quit_app(self):
        self.quit_called = True


def test_set_volume_clamps_high(monkeypatch):
    svc = CastService()
    cast = FakeCast()
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    assert svc.set_volume('d1', 5.0) == 1.0
    assert cast._volume == 1.0


def test_set_volume_clamps_low(monkeypatch):
    svc = CastService()
    cast = FakeCast()
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    assert svc.set_volume('d1', -3.0) == 0.0


def test_play_url_success(monkeypatch):
    svc = CastService()
    cast = FakeCast(states=(('PLAYING', None),))
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    assert svc.play_url('d1', 'http://stream', 'audio/mpeg', title='Radio') is True
    assert cast.media_controller.played[0] == 'http://stream'
    assert cast.media_controller.played[3] == 'LIVE'  # radio = live stream


def test_play_url_direct_error_raises_fast(monkeypatch):
    svc = CastService()
    cast = FakeCast(states=(('IDLE', 'ERROR'),))
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    with pytest.raises(RuntimeError, match='idle_reason=ERROR'):
        svc.play_url('d1', 'http://stream', tolerate_flap=False)


def test_stop_calls_media_controller(monkeypatch):
    svc = CastService()
    cast = FakeCast()
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    assert svc.stop('d1') is True
    assert cast.media_controller.stopped is True


def test_stop_falls_back_to_quit_app(monkeypatch):
    svc = CastService()
    cast = FakeCast()

    def boom():
        raise Exception('socket dead')

    cast.media_controller.stop = boom
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    assert svc.stop('d1') is True
    assert cast.quit_called is True


def test_status_shape(monkeypatch):
    svc = CastService()
    cast = FakeCast(states=(('PLAYING', None),))
    monkeypatch.setattr(svc, '_get_cast', lambda device_id: cast)
    st = svc.status('d1')
    assert st['device_id'] == 'd1'
    assert st['volume'] == 0.5
    assert st['player_state'] == 'PLAYING'
    assert st['title'] == 'T'


def test_get_devices_without_browser_returns_empty():
    # No discovery has run (no zeroconf), so the list is empty but well-formed.
    svc = CastService()
    svc._started = True  # prevent start() from attempting real discovery
    out = svc.get_devices()
    assert out['devices'] == []
    assert 'error' in out


def test_await_playing_recovers_after_flap(monkeypatch):
    monkeypatch.setattr('cast.service.time.sleep', lambda s: None)
    # Flaps to IDLE/ERROR once, then reaches PLAYING — tolerated.
    mc = FakeMediaController(states=[('IDLE', 'ERROR'), ('PLAYING', None)])
    # Should not raise.
    CastService._await_playing(mc, tolerate_flap=True)
