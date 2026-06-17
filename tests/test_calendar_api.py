"""Route tests for /api/calendar/* (src/main.py).

Runs against the real in-memory DB. Tests create a task on a fixed date and
assert it surfaces in the month/year aggregation for that date.
"""
import json
from datetime import datetime

import main


def _create_task_on(client, user_id, dt):
    resp = client.post('/api/tasks', data=json.dumps({
        'description': 'Calendar probe',
        'user_id': user_id,
        'scheduled_date': dt.isoformat(),
    }), content_type='application/json')
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


# ── validation ───────────────────────────────────────────────────────────────
def test_month_rejects_bad_month(client):
    assert client.get('/api/calendar/month?year=2026&month=13').status_code == 400
    assert client.get('/api/calendar/month?year=2026&month=0').status_code == 400


def test_month_rejects_non_numeric(client):
    assert client.get('/api/calendar/month?year=abc&month=6').status_code == 400


def test_year_rejects_non_numeric(client):
    assert client.get('/api/calendar/year?year=abc').status_code == 400


# ── month aggregation ────────────────────────────────────────────────────────
def test_month_includes_scheduled_task(client, initial_user):
    dt = datetime(2026, 3, 14, 10, 0, 0)
    _create_task_on(client, initial_user['id'], dt)

    resp = client.get('/api/calendar/month?year=2026&month=3')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['year'] == 2026 and data['month'] == 3
    key = dt.date().isoformat()
    assert key in data['days']
    descriptions = [occ['description'] for occ in data['days'][key]]
    assert 'Calendar probe' in descriptions


def test_month_user_filter_excludes_other_users(client, initial_user):
    dt = datetime(2026, 4, 9, 9, 0, 0)
    _create_task_on(client, initial_user['id'], dt)

    # Filter on a user id that doesn't own the probe task.
    other_id = initial_user['id'] + 999
    resp = client.get(f'/api/calendar/month?year=2026&month=4&user_ids={other_id}')
    assert resp.status_code == 200
    assert dt.date().isoformat() not in resp.get_json()['days']


# ── year aggregation ─────────────────────────────────────────────────────────
def test_year_counts_task_day(client, initial_user):
    dt = datetime(2026, 5, 20, 8, 0, 0)
    _create_task_on(client, initial_user['id'], dt)

    resp = client.get('/api/calendar/year?year=2026')
    assert resp.status_code == 200
    data = resp.get_json()
    key = dt.date().isoformat()
    assert key in data['days']
    assert data['days'][key]['total'] >= 1
