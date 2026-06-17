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

## Configurare Wi-Fi din interfață (doar RPi)

Tab-ul **Setări → Rețea** permite scanarea și conectarea la o rețea Wi-Fi direct
din interfață. Funcționează doar pe RPi, prin `nmcli` (NetworkManager), și apare
automat doar acolo unde `nmcli` există (pe Windows/dev tab-ul este ascuns).

### 1. Asigură-te că NetworkManager gestionează Wi-Fi-ul

Raspberry Pi OS Bookworm folosește NetworkManager implicit. Verifică:

```bash
nmcli general status        # trebuie să răspundă (NetworkManager activ)
nmcli device wifi list      # trebuie să listeze rețele
```

Pe imagini mai vechi (cu `dhcpcd`/`wpa_supplicant`), activează NetworkManager:

```bash
sudo raspi-config   # Advanced Options → Network Config → NetworkManager
sudo reboot
```

### 2. Permite userului serviciului (`pi`) să administreze rețeaua

Aplicația rulează ca user `pi` (vezi `hometasks.service`), iar `nmcli connect` /
`disconnect` cer drepturi prin polkit. Userul trebuie să fie în grupul `netdev`:

```bash
sudo usermod -aG netdev pi
```

Dacă polkit tot refuză acțiunea (eroare „not authorized" la conectare), adaugă o
regulă care permite membrilor `netdev` controlul rețelei fără parolă:

```bash
sudo tee /etc/polkit-1/rules.d/50-hometasks-nm.rules > /dev/null <<'EOF'
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0 &&
        subject.isInGroup("netdev")) {
        return polkit.Result.YES;
    }
});
EOF
sudo systemctl restart polkit
```

Apoi repornește aplicația ca să prindă noul grup:

```bash
sudo systemctl restart hometasks
```

### 3. Testează

```bash
# ca user pi, fără sudo — trebuie să meargă:
sudo -u pi nmcli device wifi connect "<SSID>" password "<parola>"
```

Dacă această comandă reușește fără `sudo`, butonul „Conectează" din interfață va
funcționa. Endpoint-urile expuse sunt `/api/wifi/status`, `/api/wifi/scan`,
`/api/wifi/connect`, `/api/wifi/disconnect`.

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
