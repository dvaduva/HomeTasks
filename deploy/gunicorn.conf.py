# Gunicorn configuration for HomeTasks production deployment
# Usage: gunicorn --config deploy/gunicorn.conf.py wsgi:app

import multiprocessing

# Server socket
bind = "0.0.0.0:5000"

# Worker processes — 2 is appropriate for a Raspberry Pi (1-2 cores)
workers = 2
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
