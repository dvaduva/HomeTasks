"""Route tests for /api/radio/* (src/main.py).

Station CRUD runs against the real in-memory DB (each test creates its own
station, so order/seed state doesn't matter). now-playing stubs the ICY fetch
to avoid a real network read.
"""
import json
import uuid

import main


def _post(client, path, body):
    return client.post(path, data=json.dumps(body), content_type='application/json')


def _put(client, path, body):
    return client.put(path, data=json.dumps(body), content_type='application/json')


def _create(client, **overrides):
    body = {'name': f'Radio {uuid.uuid4().hex[:6]}', 'url': 'http://stream.example/mp3'}
    body.update(overrides)
    resp = _post(client, '/api/radio/stations', body)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


# ── list ─────────────────────────────────────────────────────────────────────
def test_list_returns_stations_key(client):
    resp = client.get('/api/radio/stations')
    assert resp.status_code == 200
    assert isinstance(resp.get_json()['stations'], list)


# ── create / validation ──────────────────────────────────────────────────────
def test_create_requires_name(client):
    resp = _post(client, '/api/radio/stations', {'url': 'http://x'})
    assert resp.status_code == 400
    assert 'name' in resp.get_json()['error']


def test_create_requires_url(client):
    resp = _post(client, '/api/radio/stations', {'name': 'No URL'})
    assert resp.status_code == 400
    assert 'url' in resp.get_json()['error']


def test_create_ok_sets_slug_id(client):
    station = _create(client, name='Radio ZU Test')
    assert station['id']  # slug-based id
    assert station['name'] == 'Radio ZU Test'


# ── update ───────────────────────────────────────────────────────────────────
def test_update_ok(client):
    station = _create(client)
    resp = _put(client, f"/api/radio/stations/{station['id']}", {'name': 'Renamed'})
    assert resp.status_code == 200
    assert resp.get_json()['name'] == 'Renamed'


def test_update_unknown_is_404(client):
    resp = _put(client, '/api/radio/stations/nope-not-real', {'name': 'X'})
    assert resp.status_code == 404


# ── delete ───────────────────────────────────────────────────────────────────
def test_delete_ok(client):
    station = _create(client)
    assert client.delete(f"/api/radio/stations/{station['id']}").status_code == 200
    # Second delete now misses.
    assert client.delete(f"/api/radio/stations/{station['id']}").status_code == 404


# ── reorder ──────────────────────────────────────────────────────────────────
def test_reorder_requires_list(client):
    resp = _post(client, '/api/radio/stations/reorder', {'order': 'not-a-list'})
    assert resp.status_code == 400


def test_reorder_applies_order(client):
    a = _create(client)
    b = _create(client)
    resp = _post(client, '/api/radio/stations/reorder', {'order': [b['id'], a['id']]})
    assert resp.status_code == 200
    ids = [s['id'] for s in resp.get_json()['stations']]
    # b must now sit ahead of a.
    assert ids.index(b['id']) < ids.index(a['id'])


# ── now-playing ──────────────────────────────────────────────────────────────
def test_now_playing_requires_id(client):
    assert client.get('/api/radio/now-playing').status_code == 400


def test_now_playing_unknown_station_is_404(client):
    assert client.get('/api/radio/now-playing?id=nope-not-real').status_code == 404


def test_now_playing_returns_title(client, monkeypatch):
    station = _create(client)
    monkeypatch.setattr(main, '_fetch_icy_metadata', lambda url, timeout=5.0: 'Artist - Song')
    main._icy_cache.clear()  # avoid a stale cache hit from a prior run
    resp = client.get(f"/api/radio/now-playing?id={station['id']}")
    assert resp.status_code == 200
    assert resp.get_json()['title'] == 'Artist - Song'
