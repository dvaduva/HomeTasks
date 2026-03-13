import json


class TestPreferencesAPI:
    def test_get_preferences(self, client):
        resp = client.get('/api/preferences')
        assert resp.status_code == 200
        data = resp.get_json()
        for field in ('language', 'weather_city', 'weather_units', 'ai_model', 'voice_language'):
            assert field in data

    def test_update_preferences(self, client):
        resp = client.put('/api/preferences',
            data=json.dumps({
                'language': 'en',
                'weather_city': 'London',
                'weather_units': 'imperial'
            }),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['language'] == 'en'
        assert data['weather_city'] == 'London'
        assert data['weather_units'] == 'imperial'

    def test_update_preferences_no_data(self, client):
        resp = client.put('/api/preferences')
        assert resp.status_code == 400

    def test_update_preferences_unknown_fields_ignored(self, client):
        resp = client.put('/api/preferences',
            data=json.dumps({'non_existent_field': 'value', 'language': 'ro'}),
            content_type='application/json')
        assert resp.status_code == 200
        assert resp.get_json()['language'] == 'ro'

    def test_update_ai_settings(self, client):
        resp = client.put('/api/preferences',
            data=json.dumps({'ai_temperature': 0.9, 'ai_max_tokens': 800}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['ai_temperature'] == 0.9
        assert data['ai_max_tokens'] == 800

    def test_update_voice_settings(self, client):
        resp = client.put('/api/preferences',
            data=json.dumps({'voice_language': 'en-US', 'voice_auto_start': True}),
            content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['voice_language'] == 'en-US'
        assert data['voice_auto_start'] is True
