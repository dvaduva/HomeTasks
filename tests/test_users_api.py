import json
import pytest


class TestUsersAPI:
    def test_get_users_returns_list(self, client):
        response = client.get('/api/users')
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)
        assert len(response.get_json()) >= 1

    def test_user_has_required_fields(self, client):
        users = client.get('/api/users').get_json()
        user = users[0]
        for field in ('id', 'name', 'color', 'created_at'):
            assert field in user

    def test_create_user(self, client):
        resp = client.post('/api/users',
            data=json.dumps({'name': 'Ion Popescu', 'color': '#ff0000'}),
            content_type='application/json')
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['name'] == 'Ion Popescu'
        assert data['color'] == '#ff0000'
        assert 'id' in data

    def test_create_user_default_color(self, client):
        resp = client.post('/api/users',
            data=json.dumps({'name': 'Maria Ionescu'}),
            content_type='application/json')
        assert resp.status_code == 201
        assert resp.get_json()['color'] == '#3498db'

    def test_create_user_missing_name(self, client):
        resp = client.post('/api/users',
            data=json.dumps({'color': '#ff0000'}),
            content_type='application/json')
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_get_user_by_id(self, client, initial_user):
        user_id = initial_user['id']
        resp = client.get(f'/api/users/{user_id}')
        assert resp.status_code == 200
        assert resp.get_json()['id'] == user_id

    def test_get_user_not_found(self, client):
        resp = client.get('/api/users/99999')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_update_user(self, client):
        user_id = client.post('/api/users',
            data=json.dumps({'name': 'Temp User', 'color': '#000000'}),
            content_type='application/json').get_json()['id']

        resp = client.put(f'/api/users/{user_id}',
            data=json.dumps({'name': 'Updated User', 'color': '#ffffff'}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['name'] == 'Updated User'
        assert data['color'] == '#ffffff'

    def test_update_user_not_found(self, client):
        resp = client.put('/api/users/99999',
            data=json.dumps({'name': 'Ghost'}),
            content_type='application/json')
        assert resp.status_code == 404

    def test_delete_user(self, client):
        user_id = client.post('/api/users',
            data=json.dumps({'name': 'To Delete'}),
            content_type='application/json').get_json()['id']

        assert client.delete(f'/api/users/{user_id}').status_code == 200
        assert client.get(f'/api/users/{user_id}').status_code == 404

    def test_delete_user_not_found(self, client):
        assert client.delete('/api/users/99999').status_code == 404
