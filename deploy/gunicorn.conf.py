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
timeout = 120
keepalive = 5

# Restart workers after this many requests to prevent memory leaks
max_requests = 500
max_requests_jitter = 50

# Preload the app to save RAM on Raspberry Pi
preload_app = True

# Logging
accesslog = "/var/log/hometasks/access.log"
errorlog = "/var/log/hometasks/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sµs'

# Process naming
proc_name = "hometasks"
