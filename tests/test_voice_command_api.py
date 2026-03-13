import json


class TestVoiceCommandAPI:
    def test_voice_add_task(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({'command': 'adaugă task cumpără pâine'}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'response' in data
        assert 'command' in data
        assert 'timestamp' in data

    def test_voice_weather_query(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({'command': 'care e vremea azi'}),
            content_type='application/json')
        assert resp.status_code == 200
        assert 'response' in resp.get_json()

    def test_voice_tasks_query(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({'command': 'care sunt taskurile de azi'}),
            content_type='application/json')
        assert resp.status_code == 200
        assert 'response' in resp.get_json()

    def test_voice_unknown_command(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({'command': 'ceva complet necunoscut xyz'}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'response' in data
        assert len(data['response']) > 0

    def test_voice_missing_command_field(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({}),
            content_type='application/json')
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_voice_command_response_contains_command(self, client):
        resp = client.post('/api/voice-command',
            data=json.dumps({'command': 'add task test something'}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['command'] == 'add task test something'
