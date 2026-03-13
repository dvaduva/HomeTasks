import json
import pytest
from datetime import datetime, timedelta


def future_dt(hours=2):
    return (datetime.now() + timedelta(hours=hours)).isoformat()


@pytest.fixture(scope='module')
def task_for_comments(client, initial_user):
    resp = client.post('/api/tasks',
        data=json.dumps({
            'description': 'Task for comments',
            'user_id': initial_user['id'],
            'scheduled_date': future_dt()
        }),
        content_type='application/json')
    return resp.get_json()


class TestCommentsAPI:
    def test_add_comment(self, client, initial_user, task_for_comments):
        task_id = task_for_comments['id']
        resp = client.post(f'/api/tasks/{task_id}/comments',
            data=json.dumps({'text': 'Test comment', 'user_id': initial_user['id']}),
            content_type='application/json')
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['text'] == 'Test comment'
        assert data['task_id'] == task_id
        assert data['user_id'] == initial_user['id']

    def test_get_comments(self, client, task_for_comments):
        task_id = task_for_comments['id']
        resp = client.get(f'/api/tasks/{task_id}/comments')
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_add_comment_missing_text(self, client, initial_user, task_for_comments):
        task_id = task_for_comments['id']
        resp = client.post(f'/api/tasks/{task_id}/comments',
            data=json.dumps({'user_id': initial_user['id']}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_add_comment_missing_user_id(self, client, task_for_comments):
        task_id = task_for_comments['id']
        resp = client.post(f'/api/tasks/{task_id}/comments',
            data=json.dumps({'text': 'No user comment'}),
            content_type='application/json')
        assert resp.status_code == 400

    def test_comment_has_required_fields(self, client, initial_user, task_for_comments):
        task_id = task_for_comments['id']
        resp = client.post(f'/api/tasks/{task_id}/comments',
            data=json.dumps({'text': 'Field check comment', 'user_id': initial_user['id']}),
            content_type='application/json')
        data = resp.get_json()
        for field in ('id', 'text', 'task_id', 'user_id', 'created_at'):
            assert field in data
