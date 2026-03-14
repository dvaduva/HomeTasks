import os
import json
import time
from datetime import datetime, timezone


class TuyaService:
    def __init__(self):
        self.access_id = os.getenv('TUYA_ACCESS_ID')
        self.access_secret = os.getenv('TUYA_ACCESS_SECRET')
        self.api_region = os.getenv('TUYA_API_REGION', 'eu')
        # tuya_devices.json sits at the project root (two levels up from src/tuya/)
        self.json_path = os.path.normpath(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tuya_devices.json')
        )

    def get_temperatures(self):
        """Parse temperatures from the cached tuya_devices.json file."""
        if not os.path.exists(self.json_path):
            return {'devices': [], 'generated_at': None, 'error': 'Niciun fișier de date. Apasă Actualizează.'}

        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {'devices': [], 'error': str(e)}

        devices = []
        for dev in data.get('devices', []):
            status_result = dev.get('status', {}).get('result', [])
            temp_current = None
            temp_set = None
            for item in status_result:
                if item.get('code') == 'temp_current':
                    temp_current = item.get('value')
                elif item.get('code') == 'temp_set':
                    temp_set = item.get('value')

            devices.append({
                'id': dev.get('id'),
                'name': dev.get('name'),
                'online': dev.get('online', False),
                'temp_current': round(temp_current / 10, 1) if temp_current is not None else None,
                'temp_set': round(temp_set / 10, 1) if temp_set is not None else None,
            })

        return {
            'devices': devices,
            'generated_at': data.get('generated_at'),
        }

    def refresh_from_cloud(self):
        """Connect to Tuya Cloud, fetch all device statuses and write tuya_devices.json."""
        try:
            import tinytuya
        except ImportError:
            return {'error': 'tinytuya nu este instalat. Rulează: pip install tinytuya'}

        if not self.access_id or not self.access_secret:
            return {'error': 'TUYA_ACCESS_ID și TUYA_ACCESS_SECRET trebuie setate în .env'}

        kwargs = dict(
            apiRegion=self.api_region,
            apiKey=self.access_id,
            apiSecret=self.access_secret,
        )

        cloud = tinytuya.Cloud(**kwargs)
        if cloud.error:
            return {'error': f'Eroare conectare cloud: {cloud.error}'}

        raw = cloud.getdevices(verbose=True)
        if not raw or 'result' not in raw:
            return {'error': 'Nu s-a putut obține lista de dispozitive din Tuya Cloud'}

        devices_raw = raw.get('result') or []
        if not devices_raw:
            return {'error': raw.get('msg', 'Lista de dispozitive este goală')}

        result = {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'devices': [],
        }
        for dev in devices_raw:
            entry = {
                'id': dev.get('id'),
                'name': dev.get('name'),
                'product_name': dev.get('product_name'),
                'model': dev.get('model'),
                'online': dev.get('online'),
                'status': cloud.getstatus(dev['id']),
            }
            result['devices'].append(entry)
            time.sleep(0.5)

        with open(self.json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return {'success': True, 'device_count': len(devices_raw)}


tuya_service = TuyaService()
