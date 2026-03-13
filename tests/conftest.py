import os
import sys

# Must set env vars before any app module imports
os.environ.setdefault('WEATHER_API_KEY', 'test_api_key_placeholder')
os.environ.setdefault('SECRET_KEY', 'test_secret_key_for_testing')
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('OLLAMA_HOST', 'http://localhost:11434')

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import pytest


@pytest.fixture(scope='session')
def app():
    from main import app as flask_app
    flask_app.config['TESTING'] = True
    return flask_app


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


@pytest.fixture(scope='session')
def initial_user(client):
    """Return the initial test user created at startup."""
    response = client.get('/api/users')
    users = response.get_json()
    assert len(users) > 0, "Expected at least one user from initial data setup"
    return users[0]
