import time
import logging
import threading

logger = logging.getLogger(__name__)

CONNECT_TIMEOUT = 10        # seconds to wait for a device connection / media session
PLAY_CONFIRM_TIMEOUT = 12   # tolerant window for routes that legitimately flap (proxy)
PLAY_CONFIRM_DIRECT = 4     # short window for the direct attempt: fail fast → fall back


class CastService:
    """Discovers and controls Google Cast devices (Chromecast / Google Home /
    Mi Smart Speaker) on the LAN via ``pychromecast``.

    Discovery uses a single, long-lived ``CastBrowser`` + ``Zeroconf`` that
    updates its device list live as devices appear and disappear — no periodic
    polling needed. HTTP handlers read that list through ``get_devices()``.

    Control (play/stop) connects lazily: a ``Chromecast`` object per device is
    built on first use and cached. If the cached socket is dead it is rebuilt —
    this is the mitigation for the gunicorn multi-worker caveat (a control
    request may land in a worker that never opened the connection).

    Threading note: with gunicorn ``preload_app=True`` anything started at import
    time lives in the *master* and does NOT survive the fork into workers. So
    ``start()`` is idempotent and is meant to be triggered from the request path,
    guaranteeing the browser/connections live in the worker that serves traffic.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._zconf = None
        self._browser = None
        self._started = False
        self._discovery_error = None
        self._connections = {}  # device_id (str) -> Chromecast

    # ── discovery ──────────────────────────────────────────────────────────────
    def start(self):
        """Idempotent: launch the persistent CastBrowser once per process."""
        with self._lock:
            if self._started:
                return
            self._started = True

        try:
            import zeroconf
            from pychromecast import discovery
        except ImportError:
            self._discovery_error = 'pychromecast nu este instalat. Rulează: pip install pychromecast'
            logger.warning(self._discovery_error)
            return

        try:
            self._zconf = zeroconf.Zeroconf()
            self._browser = discovery.CastBrowser(discovery.SimpleCastListener(), self._zconf)
            self._browser.start_discovery()
            self._discovery_error = None
            logger.info("Cast discovery started (CastBrowser)")
        except Exception as e:
            self._discovery_error = str(e)
            logger.warning("Cast discovery failed to start: %s", e)

    def get_devices(self):
        """Return the live device list. Never blocks on the network."""
        self.start()
        devices = []
        if self._browser is not None:
            for uuid, info in list(self._browser.devices.items()):
                devices.append({
                    'id': str(uuid),
                    'name': getattr(info, 'friendly_name', None) or 'Cast device',
                    'model': getattr(info, 'model_name', None),
                    'cast_type': getattr(info, 'cast_type', None),
                    'manufacturer': getattr(info, 'manufacturer', None),
                })
        return {'devices': devices, 'error': self._discovery_error}

    # ── control ────────────────────────────────────────────────────────────────
    def play_url(self, device_id, url, content_type='audio/mpeg', title=None,
                 tolerate_flap=True):
        """Tell a device to start streaming ``url``. The device fetches it itself,
        so playback survives the UI tab closing.

        ``tolerate_flap`` picks the confirm strategy: True (proxy route) waits the
        long, transient-error-tolerant window; False (direct route) fails fast on
        the first error so the caller can fall back to the proxy without stalling.

        Raises RuntimeError if the device fails to actually start playing — the
        caller uses that to fall back to the LAN proxy URL."""
        cast = self._get_cast(device_id)
        mc = cast.media_controller
        # stream_type=LIVE: radio has no seekable timeline / fixed duration.
        mc.play_media(url, content_type, title=title, stream_type='LIVE')
        mc.block_until_active(timeout=CONNECT_TIMEOUT)
        self._await_playing(mc, tolerate_flap=tolerate_flap)
        logger.info("Cast play on %s: %s", device_id, url)
        return True

    @staticmethod
    def _await_playing(mc, tolerate_flap=True):
        """Block until the media is PLAYING/BUFFERING, or raise if the device
        never starts. A device that can't fetch a URL (bad TLS, refused port,
        unsupported codec) goes IDLE with idle_reason=ERROR.

        ``tolerate_flap=True``: some streams (raw AAC over our proxy) flap to
        IDLE/ERROR once while the receiver probes the format, then buffer and
        play. We keep watching until ``PLAY_CONFIRM_TIMEOUT`` and reach PLAYING
        if the device recovers; only a sustained failure raises.

        ``tolerate_flap=False``: used for the direct attempt — raise on the first
        ERROR within the short ``PLAY_CONFIRM_DIRECT`` window so the caller falls
        back to the proxy in ~1s instead of stalling ~12s on a stream the device
        won't accept directly."""
        timeout = PLAY_CONFIRM_TIMEOUT if tolerate_flap else PLAY_CONFIRM_DIRECT
        deadline = time.time() + timeout
        last_reason = None
        while time.time() < deadline:
            st = mc.status
            state = (getattr(st, 'player_state', '') or '').upper()
            if state in ('PLAYING', 'BUFFERING'):
                return
            if state == 'IDLE':
                reason = (getattr(st, 'idle_reason', '') or '').upper()
                if reason in ('ERROR', 'CANCELLED', 'INTERRUPTED'):
                    last_reason = reason
                    if not tolerate_flap:
                        raise RuntimeError(f'Boxa nu a putut reda stream-ul (idle_reason={reason})')
            time.sleep(0.4)
        if last_reason:
            raise RuntimeError(f'Boxa nu a putut reda stream-ul (idle_reason={last_reason})')
        raise RuntimeError('Boxa nu a confirmat redarea (timeout)')

    def stop(self, device_id):
        """Stop playback on a device."""
        cast = self._get_cast(device_id)
        try:
            cast.media_controller.stop()
        except Exception as e:
            logger.debug("media_controller.stop failed (%s); quitting app", e)
            cast.quit_app()
        logger.info("Cast stop on %s", device_id)
        return True

    def set_volume(self, device_id, volume):
        """Set device volume. ``volume`` is 0.0–1.0 (clamped)."""
        v = max(0.0, min(1.0, float(volume)))
        cast = self._get_cast(device_id)
        cast.set_volume(v)
        logger.info("Cast volume on %s -> %.2f", device_id, v)
        return v

    def status(self, device_id):
        """Return current playback/volume state for a device.

        ``cast.status`` is the receiver state (volume, current app);
        ``media_controller.status`` is the media state (player_state, title)."""
        cast = self._get_cast(device_id)
        cs = cast.status                       # CastStatus | None
        ms = cast.media_controller.status      # MediaStatus
        return {
            'device_id': device_id,
            'volume': getattr(cs, 'volume_level', None),
            'muted': getattr(cs, 'volume_muted', None),
            'app': getattr(cs, 'display_name', None),
            'player_state': getattr(ms, 'player_state', None),
            'title': getattr(ms, 'title', None),
            'content_id': getattr(ms, 'content_id', None),
        }

    # ── connection management ──────────────────────────────────────────────────
    def _get_cast(self, device_id):
        """Return a connected Chromecast for ``device_id``, (re)connecting if the
        cached one is stale. Raises RuntimeError with a user-facing message."""
        self.start()
        with self._lock:
            cast = self._connections.get(device_id)
            if cast is not None:
                if self._is_alive(cast):
                    return cast
                self._drop(device_id, cast)

            info = self._find_cast_info(device_id)
            if info is None:
                raise RuntimeError('Dispozitivul Cast nu a fost găsit (încă nedescoperit?).')

            from pychromecast import get_chromecast_from_cast_info
            cast = get_chromecast_from_cast_info(info, self._zconf)
            cast.wait(timeout=CONNECT_TIMEOUT)
            self._connections[device_id] = cast
            return cast

    def _find_cast_info(self, device_id):
        if self._browser is None:
            return None
        for uuid, info in list(self._browser.devices.items()):
            if str(uuid) == device_id:
                return info
        return None

    @staticmethod
    def _is_alive(cast):
        try:
            sock = getattr(cast, 'socket_client', None)
            return bool(sock and getattr(sock, 'is_connected', False))
        except Exception:
            return False

    @staticmethod
    def _drop(device_id, cast):
        try:
            cast.disconnect(blocking=False)
        except Exception:
            pass


cast_service = CastService()
