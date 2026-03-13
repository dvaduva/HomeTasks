"""
WSGI entry point for production deployment with Gunicorn or other WSGI servers.

Usage:
    gunicorn --config deploy/gunicorn.conf.py wsgi:app
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from main import app

if __name__ == '__main__':
    app.run()
