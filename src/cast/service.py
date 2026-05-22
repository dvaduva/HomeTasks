import os
import time
import logging
import threading
from datetime import datetime

logger = logging.getLogger(__name__)

DEFAULT_RESCAN_INTERVAL = 60  # seconds between discovery passes
SCAN_WINDOW = 5               # seconds to listen for mDNS responses per pass


class CastService:
    """Discovers Google Cast devices (Chromecast / Google Home / Mi Smart
    Speaker) on the LAN and keeps an in-memory cache.

    Discovery runs in a background daemon thread that re-scans every
    CAST_RESCAN_INTERVAL seconds. HTTP handlers only ever read the cache via
    ``get_devices()`` — they never trigger a (slow, blocking) network scan.

    Threading note: with gunicorn ``preload_app=True`` a thread started at
    import time lives in the *master* process and does NOT survive the fork into
    workers. So ``start()`` is idempotent and is meant to be called from the
    request path (the first ``/api/cast/devices`` hit), guaranteeing discovery
    runs inside the worker that actually serves requests.
    """

    def __init__(self):
        try:
            self.rescan_interval = int(os.getenv('CAST_RESCAN_INTERVAL', DEFAULT_RESCAN_INTERVAL))
        except (TypeError, ValueError):
            self.rescan_interval = DEFAULT_RESCAN_INTERVAL

        self._lock = threading.Lock()
        self._devices = {}        # uuid (str) -> device dict
        self._last_scan = None    # ISO timestamp of last successful scan
        self._scan_error = None   # last scan error message, or None
        self._thread = None
        self._started = False

    # ── public read API (called by HTTP handlers) ─────────────────────────────
    def get_devices(self):
        """Return the cached device list. Never blocks on the network."""
        with self._lock:
            return {
                'devices': list(self._devices.values()),
                'last_scan': self._last_scan,
                'error': self._scan_error,
            }

    # ── background discovery ───────────────────────────────────────────────────
    def start(self):
        """Idempotent: launch the background discovery thread once per process."""
        with self._lock:
            if self._started:
                return
            self._started = True
        self._thread = threading.Thread(target=self._run, name='cast-discovery', daemon=True)
        self._thread.start()
        logger.info("Cast discovery thread started (rescan every %ds)", self.rescan_interval)

    def _run(self):
        while True:
            self._scan_once()
            time.sleep(self.rescan_interval)

    def _scan_once(self):
        try:
            import zeroconf
            from pychromecast import discovery
        except ImportError:
            self._set_error('pychromecast nu este instalat. Rulează: pip install pychromecast')
            return

        zconf = None
        browser = None
        try:
            zconf = zeroconf.Zeroconf()
            browser = discovery.CastBrowser(discovery.SimpleCastListener(), zconf)
            browser.start_discovery()
            # Give mDNS responders a window to answer before reading the cache.
            time.sleep(SCAN_WINDOW)

            found = {}
            for info in list(browser.devices.values()):
                uuid = str(getattr(info, 'uuid', '') or '')
                if not uuid:
                    continue
                found[uuid] = {
                    'id': uuid,
                    'name': getattr(info, 'friendly_name', None) or 'Cast device',
                    'model': getattr(info, 'model_name', None),
                    'cast_type': getattr(info, 'cast_type', None),
                    'manufacturer': getattr(info, 'manufacturer', None),
                }

            with self._lock:
                self._devices = found
                self._last_scan = datetime.now().isoformat()
                self._scan_error = None
            logger.info("Cast discovery: %d device(s) found", len(found))
        except Exception as e:
            logger.warning("Cast discovery scan failed: %s", e)
            self._set_error(str(e))
        finally:
            try:
                if browser is not None:
                    browser.stop_discovery()
            except Exception:
                pass
            try:
                if zconf is not None:
                    zconf.close()
            except Exception:
                pass

    def _set_error(self, message):
        with self._lock:
            self._scan_error = message


cast_service = CastService()
