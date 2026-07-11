# Gunicorn configuration for HomeTasks production deployment
# Usage: gunicorn --config deploy/gunicorn.conf.py wsgi:app

import multiprocessing

# Server socket
bind = "0.0.0.0:5000"

# Single process, multiple threads (gthread):
#  - workers = 1 keeps the Cast controller (pychromecast) connection + discovery
#    state in one process's memory — a /api/cast/* request always finds it.
#  - threads > 1 is essential because the radio proxy streams synchronously for
#    the whole listening session; a sync worker would be tied up for hours and
#    the app would serve nothing else (SPA, status polling, even /api/cast/stop).
#    With gthread, one thread streams while others keep handling requests.
workers = 1
worker_class = "gthread"
threads = 8
# 0 = disabled. A Cast proxy stream can run for hours; killing a quiet worker
# mid-stream stops audio on the speaker even though bytes are flowing again.
timeout = 0
keepalive = 5

# 0 = disabled. Recycling the worker tears down any in-flight /api/radio/proxy
# connections the Cast speaker is still reading from.
max_requests = 0
max_requests_jitter = 0

# Preload the app to save RAM on Raspberry Pi
preload_app = True

# Logging
accesslog = "/var/log/hometasks/access.log"
errorlog = "/var/log/hometasks/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sµs'

# Process naming
proc_name = "hometasks"
