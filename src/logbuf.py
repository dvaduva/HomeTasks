"""Persistent daily log files, surfaced inside the app.

The RPi kiosk is touchscreen-only with no terminal access, so server-side errors
(e.g. why casting a radio station to a speaker failed) are otherwise invisible.
This module writes log records to one file per day under ``logs/`` and keeps only
the last ``RETENTION_DAYS`` days; older files are pruned automatically. The records
are surfaced through ``GET /api/logs`` + a plain ``/logs`` HTML page served
directly by Flask — no SPA rebuild needed to read them.

Design notes:
- A single ``DailyFileLogHandler`` is attached to the root logger, so it captures
  logs from every module (main, cast.service, wifi.service, ...).
- To stay useful without drowning in third-party noise, the handler keeps every
  record at WARNING+ but only INFO/DEBUG records from our own app loggers
  (see ``APP_PREFIXES``); framework chatter (werkzeug access logs, zeroconf,
  urllib3) below WARNING is dropped.
- ``install()`` is idempotent — safe under the Flask debug reloader (which imports
  the module twice) and under gunicorn's fork.
- One file per day: ``logs/hometasks-YYYY-MM-DD.log``. Files older than 14 days are
  deleted on rollover and at startup.
"""

import glob
import logging
import os
import re
import threading
import time

# Top-level logger names we consider "ours" — their INFO/DEBUG lines are kept.
APP_PREFIXES = (
    'main', 'cast', 'bt', 'wifi', 'tuya', 'voice',
    'weather', 'ai', 'ollama', 'task_manager', 'logbuf',
)

RETENTION_DAYS = 14
FILE_PREFIX = 'hometasks-'
FILE_SUFFIX = '.log'
# One physical line per record: "YYYY-MM-DD HH:MM:SS | LEVEL | logger | message".
_LINE_RE = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| (\w+) \| ([^|]+) \| (.*)$')

_log_dir = None  # set by install()


def _today_str():
    return time.strftime('%Y-%m-%d', time.localtime())


def _path_for(date_str):
    return os.path.join(_log_dir, f'{FILE_PREFIX}{date_str}{FILE_SUFFIX}')


class DailyFileLogHandler(logging.Handler):
    """Appends records to a per-day file, rotating at date change and pruning
    files older than ``RETENTION_DAYS``."""

    def __init__(self, log_dir):
        super().__init__(level=logging.DEBUG)
        self._dir = log_dir
        self._lock = threading.Lock()
        self._day = None
        self._stream = None
        os.makedirs(log_dir, exist_ok=True)

    def _ensure_stream(self):
        """Open today's file, rotating (and pruning) when the day changes."""
        day = _today_str()
        if self._stream is not None and day == self._day:
            return
        if self._stream is not None:
            try:
                self._stream.close()
            except Exception:
                pass
        self._day = day
        # line-buffered append so a crash still leaves readable logs on disk.
        self._stream = open(_path_for(day), 'a', encoding='utf-8', buffering=1)
        _prune_old(self._dir)

    def emit(self, record):
        try:
            msg = record.getMessage()
            if record.exc_info and self.formatter:
                msg = msg + ' | ' + self.formatter.formatException(record.exc_info)
            # Collapse newlines so each record stays a single, parseable line.
            msg = msg.replace('\r', ' ').replace('\n', ' ↵ ')
            line = '%s | %s | %s | %s\n' % (
                time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(record.created)),
                record.levelname, record.name, msg,
            )
            with self._lock:
                self._ensure_stream()
                self._stream.write(line)
        except Exception:  # never let logging raise
            self.handleError(record)


def _prune_old(log_dir):
    """Delete daily log files older than the retention window."""
    cutoff = time.time() - RETENTION_DAYS * 86400
    for path in glob.glob(os.path.join(log_dir, f'{FILE_PREFIX}*{FILE_SUFFIX}')):
        date_str = os.path.basename(path)[len(FILE_PREFIX):-len(FILE_SUFFIX)]
        try:
            file_day = time.mktime(time.strptime(date_str, '%Y-%m-%d'))
        except ValueError:
            continue  # not a dated log file we manage
        if file_day < cutoff:
            try:
                os.remove(path)
            except OSError:
                pass


def _app_only_filter(record):
    """Keep WARNING+ from anyone; keep INFO/DEBUG only from our own modules."""
    if record.levelno >= logging.WARNING:
        return True
    return record.name.split('.', 1)[0] in APP_PREFIXES


# ── read side (used by the API/UI) ──────────────────────────────────────────────

def available_days():
    """Return the dates (YYYY-MM-DD) with a log file on disk, newest first."""
    if not _log_dir:
        return []
    days = []
    for path in glob.glob(os.path.join(_log_dir, f'{FILE_PREFIX}*{FILE_SUFFIX}')):
        date_str = os.path.basename(path)[len(FILE_PREFIX):-len(FILE_SUFFIX)]
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_str):
            days.append(date_str)
    return sorted(days, reverse=True)


def read_records(date_str=None, level=logging.NOTSET, limit=None):
    """Parse one day's log file into records (oldest→newest), filtered by level.

    Defaults to today. Unparseable lines (rare) are attached to the previous
    record as continuation text so nothing is silently lost."""
    if not _log_dir:
        return []
    date_str = date_str or _today_str()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_str):
        return []
    path = _path_for(date_str)
    if not os.path.isfile(path):
        return []
    records = []
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            for line in fh:
                line = line.rstrip('\n')
                m = _LINE_RE.match(line)
                if not m:
                    if records:
                        records[-1]['message'] += '\n' + line
                    continue
                ts, levelname, logger_name, message = m.groups()
                records.append({
                    'time': ts[11:],           # HH:MM:SS
                    'datetime': ts,
                    'level': levelname,
                    'levelno': logging.getLevelName(levelname) if isinstance(
                        logging.getLevelName(levelname), int) else 0,
                    'logger': logger_name.strip(),
                    'message': message.replace(' ↵ ', '\n'),
                })
    except OSError:
        return []
    if level:
        records = [r for r in records if r['levelno'] >= level]
    if limit:
        records = records[-limit:]
    return records


# Module-level singleton config so the API layer shares this module's state.
_handler = None


def install(log_dir):
    """Attach the daily file handler to the root logger exactly once, and lower
    the root level to INFO so our app's INFO lines actually reach it."""
    global _log_dir, _handler
    _log_dir = log_dir
    root = logging.getLogger()
    if any(isinstance(h, DailyFileLogHandler) for h in root.handlers):
        return  # already installed (reloader / repeated import)
    _handler = DailyFileLogHandler(log_dir)
    _handler.addFilter(_app_only_filter)
    _handler.setFormatter(logging.Formatter('%(message)s'))
    if root.level == logging.NOTSET or root.level > logging.INFO:
        root.setLevel(logging.INFO)
    root.addHandler(_handler)
    _prune_old(log_dir)
    logging.getLogger('logbuf').info(
        'Daily log files started in %s (keeping last %d days)', log_dir, RETENTION_DAYS)
