# Gunicorn configuration for HomeTasks production deployment
# Usage: gunicorn --config deploy/gunicorn.conf.py wsgi:app

import multiprocessing

# Server socket
bind = "0.0.0.0:5000"

# Worker processes — pinned to 1 because the Cast controller (pychromecast)
# keeps the device connection and discovery state in a single process's memory.
# With >1 worker a /api/cast/* request can land in a worker that never opened
# the connection. For home use on a Raspberry Pi a single sync worker is plenty.
workers = 1
worker_class = "sync"
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
