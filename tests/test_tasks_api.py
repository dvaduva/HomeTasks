import json
import pytest
from datetime import datetime, timedelta


def future_dt(hours=2):
    return (datetime.now() + timedelta(hours=hours)).isoformat()


class TestTasksAPI:
    def test_get_tasks_returns_list(self, client):
        resp = client.get('/api/tasks')
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_create_task(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Test task',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt()
            }),
            content_type='application/json')
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['description'] == 'Test task'
        assert data['user_id'] == initial_user['id']
        assert data['status'] == 'pending'

    def test_create_task_missing_description(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({'user_id': initial_user['id'], 'scheduled_date': future_dt()}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_create_task_missing_user_id(self, client):
        resp = client.post('/api/tasks',
            data=json.dumps({'description': 'Task', 'scheduled_date': future_dt()}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_create_task_missing_scheduled_date(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({'description': 'Task', 'user_id': initial_user['id']}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_create_task_invalid_date(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Task',
                'user_id': initial_user['id'],
                'scheduled_date': 'not-a-date'
            }),
            content_type='application/json')
        assert resp.status_code == 400

    def test_get_task_by_id(self, client, initial_user):
        task_id = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Specific task',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt()
            }),
            content_type='application/json').get_json()['id']

        resp = client.get(f'/api/tasks/{task_id}')
        assert resp.status_code == 200
        assert resp.get_json()['id'] == task_id

    def test_get_task_not_found(self, client):
        assert client.get('/api/tasks/99999').status_code == 404

    def test_update_task_status(self, client, initial_user):
        task_id = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Task to complete',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt()
            }),
            content_type='application/json').get_json()['id']

        resp = client.put(f'/api/tasks/{task_id}',
            data=json.dumps({'status': 'completed'}),
            content_type='application/json')
        assert resp.status_code == 200
        assert resp.get_json()['status'] == 'completed'

    def test_update_task_invalid_status(self, client, initial_user):
        task_id = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Task',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt()
            }),
            content_type='application/json').get_json()['id']

        resp = client.put(f'/api/tasks/{task_id}',
            data=json.dumps({'status': 'invalid_status'}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_delete_task(self, client, initial_user):
        task_id = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Task to delete',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt()
            }),
            content_type='application/json').get_json()['id']

        assert client.delete(f'/api/tasks/{task_id}').status_code == 200
        assert client.get(f'/api/tasks/{task_id}').status_code == 404

    def test_delete_task_not_found(self, client):
        assert client.delete('/api/tasks/99999').status_code == 404

    def test_get_today_tasks(self, client):
        resp = client.get('/api/tasks/today')
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_get_upcoming_tasks(self, client):
        resp = client.get('/api/tasks/upcoming')
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_filter_tasks_by_status(self, client):
        resp = client.get('/api/tasks?status=pending')
        assert resp.status_code == 200
        for task in resp.get_json():
            assert task['status'] == 'pending'

    def test_filter_tasks_invalid_status(self, client):
        assert client.get('/api/tasks?status=invalid').status_code == 400

    def test_task_with_recurrence(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Daily task',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt(),
                'recurrence_pattern': 'daily'
            }),
            content_type='application/json')
        assert resp.status_code == 201
        assert resp.get_json()['recurrence_pattern'] == 'daily'

    def test_task_invalid_recurrence(self, client, initial_user):
        resp = client.post('/api/tasks',
            data=json.dumps({
                'description': 'Bad recurrence task',
                'user_id': initial_user['id'],
                'scheduled_date': future_dt(),
                'recurrence_pattern': 'hourly'
            }),
            content_type='application/json')
        assert resp.status_code == 400
