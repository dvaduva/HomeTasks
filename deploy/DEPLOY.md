# Deploy HomeTasks pe Raspberry Pi

## Cerințe

- Raspberry Pi cu Raspberry Pi OS (sau Debian/Ubuntu)
- Python 3.9+
- Node.js 18+ și npm (pentru build-ul SPA — `sudo apt install nodejs npm`)
- Acces internet pentru instalarea pachetelor

## Pași pentru deploy

### 1. Clonează/copiază proiectul

```bash
git clone <repo-url> /home/pi/hometasks
cd /home/pi/hometasks
```

### 2. Creează mediul virtual și instalează dependențele

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

### 3. Configurează variabilele de mediu

```bash
cp .env.example .env
nano .env   # editează cu valorile reale
```

Câmpuri obligatorii:
- `SECRET_KEY` — cheie secretă unică (generează cu `python3 -c "import secrets; print(secrets.token_hex(32))"`)
- `WEATHER_API_KEY` — cheia API OpenWeatherMap (gratuit la openweathermap.org)

### 4. Construiește bundle-ul SPA

Flask servește frontend-ul din `frontend/dist/`. Acesta trebuie generat înainte
de pornire (și la fiecare actualizare a codului din `frontend/`):

```bash
cd frontend
npm install
npm run build
cd ..
```

Rezultatul (`frontend/dist/`) nu este versionat în git — se reconstruiește la
fiecare deploy.

### 5. Creează directorul pentru date și log-uri

```bash
mkdir -p /home/pi/hometasks/data
sudo mkdir -p /var/log/hometasks
sudo chown pi:pi /var/log/hometasks
```

### 6. Testează că aplicația pornește

```bash
source venv/bin/activate
gunicorn --config deploy/gunicorn.conf.py wsgi:app
# Verifică în browser: http://<IP_RASPBERRY>:5000
# Ctrl+C pentru a opri
```

### 7. Instalează ca serviciu systemd

```bash
sudo cp deploy/hometasks.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hometasks
sudo systemctl start hometasks
```

### 8. Verifică statusul serviciului

```bash
sudo systemctl status hometasks
sudo journalctl -u hometasks -f   # urmărire log-uri live
```

## Comenzi utile

```bash
# Pornire/oprire/restart
sudo systemctl start hometasks
sudo systemctl stop hometasks
sudo systemctl restart hometasks

# Log-uri
tail -f /var/log/hometasks/access.log
tail -f /var/log/hometasks/error.log
```

## Actualizarea aplicației

```bash
cd /home/pi/hometasks
git pull
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart hometasks
```

## Rulare teste

```bash
source venv/bin/activate
pip install pytest pytest-cov
pytest tests/ -v
pytest tests/ --cov=src --cov-report=term-missing
```
