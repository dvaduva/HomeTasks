# Ghid de instalare - HomeTasks (Web)

> [English](INSTALLATION.md) · **Română**

## Prerechizite hardware

### Dispozitivul server (Raspberry Pi sau orice alt calculator)
- Model recomandat: Raspberry Pi 4 Model B cu 4GB RAM sau mai mare
- Alternativă acceptabilă: Raspberry Pi 3 Model B+ (performante reduse)
- Orice calculator/modern dispozitiv capabil să ruleze Python 3.9+
- Spațiu de stocare minim: 16GB (32GB+ recomandat pentru actualizări și loguri)
- Sursă de alimentare stabilă (pentru Raspberry Pi: 5V/3A pentru Pi 4, 5V/2.5A pentru Pi 3)

### Pentru acces local pe dispozitiv (opțional)
- Ecran tactil compatibil (doar dacă doriți să accesați aplicația direct pe ecranul Raspberry Pi)
  - Rezoluție minimă: 800x480 px (WVGA)
  - Rezoluție recomandată: 1024x600 px sau 1280x720 px
- Microfon USB cu reducere de zgomot (pentru recunoaștere vocală bună pe dispozitivul local, doar dacă se implementează STT pe server)
- Carcasă de protejare pentru Raspberry Pi (opțional dar recomandat)

### Alte echipamente (opționale)
- Tastatură și mouse USB (pentru configurare inițială)
- Cablu HDMI (dacă ecranul se conectează prin HDMI)
- Conexiune la internet (Wi-Fi sau Ethernet)

## Pregătirea sistemului de operare

### Alegerea sistemului de operare
- Orice sistem de operare capabil să ruleze Python 3.9+:
  - Raspberry Pi OS (formerly Raspbian) 64-bit versiune 2023-05 sau mai nouă (recomandat pentru Raspberry Pi)
  - Ubuntu Server pentru Raspberry Pi 64-bit (alternativă)
  - Alte distribuții Linux compatibile cu ARM v8
  - Windows 10/11 sau macOS (pentru dezvoltare sau utilizare pe alte dispozitive)

### Descărcarea și instalarea sistemului de operare (pentru Raspberry Pi)
1. Accesați site-ul oficial: https://www.raspberrypi.com/software/
2. Descărcați Raspberry Pi OS Lite (64-bit) sau Raspberry Pi OS Desktop (64-bit)
   - Pentru acest proiect, ambele variante funcționează deoarece interfața este web-based
   - Versiunea Lite este suficientă și consumă mai puține resurse
3. Verificați integritatea fișierului descărcat folosind SHA-256 (opțional dar recomandat)

### Scrierea imaginii pe microSD card (pentru Raspberry Pi)
#### Pe Windows
1. Descărcați și instalați Balena Etcher: https://www.balena.io/etcher/
2. Introduceți microSD cardul în cititorul de card al computerului
3. Lansati Balena Etcher
4. Selectați fișierul imaginii .zip sau .img descărcat
5. Selectați unitatea microSD cardului
6. Faceți clic pe "Flash!" și așteptați finalizarea procesului

#### Pe macOS sau Linux
1. Deschideți Terminalul
2. Identificați unitatea microSD cardului cu `lsblk` (Linux) sau `diskutil list` (macOS)
3. Demontați partițiile: `sudo umount /dev/sdX1` (înlocuiți cu unitatea corectă)
4. Scrieți imaginea: 
   ```bash
   sudo dd if=raspios.img of=/dev/sdX bs=4M status=progress conv=fdatasync
   ```
   (înlocuiți `raspios.img` cu calea către imagine și `/dev/sdX` cu unitatea microSD cardului)
5. Așteptați finalizarea procesului

### Prima pornire și configurare de bază (pentru Raspberry Pi)
1. Introduceți microSD cardul în Raspberry Pi
2. Conectați ecranul (doar pentru configurare inițială), tastatură, mouse și sursa de alimentare
3. Raspberry Pi va porni automat și va afișa asistenta de configurare inițială
4. Urmați pașii:
   - Selectați limba, fusul orar și layoutul tastaturii
   - Schimbați parola implicită pentru utilizatorul `pi` (recomandat pentru securitate)
   - Conectați-vă la rețeaua Wi-Fi sau conectați cablul Ethernet
   - Actualizați sistemul când vi se cere (recomandat)
   - Reporniți sistemul când vi se cere
5. După configurare, puteți dezconecta ecranul, tastatură și mouse dacă doriți să rulezi headless

## Instalarea dependințelor software

### Actualizarea sistemului
Deschideți un terminal și rulați:
```bash
sudo apt update
sudo apt upgrade -y
```

### Instalarea Python și pip
Majoritatea sistemelor de operare moderne vin cu Python 3 instalat, dar ne asigurăm că avem versiunea recentă:
```bash
python3 --version  # Trebuie să fie 3.9 sau mai nou
```

Dacă nu aveți Python 3.9+:
```bash
# Pe Raspberry Pi OS / Ubuntu/Debian
sudo apt install python3 python3-pip python3-dev -y

# Biblioteci de sistem necesare compilării PyAudio (microfon/comenzi vocale).
# Fără ele, `pip install` eșuează cu „fatal error: portaudio.h: No such file or directory”,
# deoarece pe RPi (aarch64) PyAudio se compilează din sursă.
sudo apt install portaudio19-dev -y

# Pe macOS (folosind Homebrew)
# brew install python3

# Pe Windows: Descărcați și instalați de pe https://www.python.org/downloads/
```

### Crearea unui mediu virtual (recomandat)
```bash
# Navigați în directorul waar doriți să instalați aplicația
# Exemplu pentru Raspberry Pi:
cd /home/pi
mkdir HomeTasks
cd HomeTasks

# Creați mediul virtual
python3 -m venv venv

# Activați mediul virtual
source venv/bin/activate

# Verificați că lucrați în mediul virtual
which python  # Trebuie să pointeze către venv/bin/python
```

### Instalarea dependințelor Python
În mediul virtual activat:
```bash
# Asigurați-vă că pip este actualizat
pip install --upgrade pip

# Instalați toate dependințele dintr-o singură comandă
pip install -r requirements.txt
```

Dependințele includ: Flask, SQLAlchemy, requests, python-dotenv, tinytuya (pentru integrare IoT Tuya), gunicorn (server producție), pytest, gTTS (TTS pe server pentru RPi kiosk).

> **Notă (Raspberry Pi):** PyAudio nu are wheel precompilat pentru `aarch64`, deci
> se compilează din sursă și are nevoie de header-ele PortAudio. Dacă `pip install`
> eșuează cu `fatal error: portaudio.h: No such file or directory`, instalați întâi
> pachetele de sistem `python3-dev` și `portaudio19-dev` (vezi mai sus), apoi reluați
> `pip install -r requirements.txt`.

## Descărcarea și configurarea aplicației HomeTasks

### Obținerea sursei aplicației
```bash
# În mediul virtual activat
git clone https://github.com/dvaduva/HomeTasks.git
cd HomeTasks
```

### Crearea fișierului de variabile de mediu
Creați un fișier `.env` în directorul rădăcină al aplicației:
```bash
cp .env.example .env
```
Editați fișierul `.env` și completați:
```env
# Flask settings
FLASK_APP=wsgi.py
FLASK_ENV=production  # schimbați în development pentru dezvoltare locală
# Generați cu: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=cheia_secreta_pentru_sesiuni

# Database (implicit: SQLite în folderul data/)
# Pentru PostgreSQL: DATABASE_URL=postgresql://user:parola@localhost/hometasks
DATABASE_URL=sqlite:///./data/hometasks.db

# Weather API (cheie gratuită de pe openweathermap.org)
WEATHER_API_KEY=cheia_ta_pentru_openweathermap

# Setări Ollama AI
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b
OLLAMA_TIMEOUT=120

# Setări aplicație
DEFAULT_LANGUAGE=ro  # sau en pentru engleză
TEMPERATURE_UNIT=C  # sau F
UPDATE_INTERVAL_MINUTES=30
VOICE_ACTIVATION_WORD=Hey HomeTasks
VOICE_DEBUG_LOG=false

# Tuya Cloud (eu.platform.tuya.com) - pentru temperaturi din senzori IoT
TUYA_ACCESS_ID=your_access_id
TUYA_ACCESS_SECRET=your_access_secret
TUYA_API_REGION=eu
```

### Configurarea serverului Ollama
**Important pentru Raspberry Pi:** Ollama suportă doar **sistem 64-bit (arm64)**. Dacă aveți Raspberry Pi OS 32-bit (armv7l), scriptul oficial va afișa `ERROR: Unsupported architecture: armv7l`. Trebuie să folosiți **Raspberry Pi OS 64-bit** (vezi secțiunea „Alegerea sistemului de operare”) sau să rulați Ollama pe un alt calculator din rețea și să setați în `.env`: `OLLAMA_HOST=http://<ip-acel-pc>:11434`.

1. Instalați Ollama pe dispozitivul dvs. (Raspberry Pi 64-bit sau orice alt Linux x86_64/arm64):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Porniți serviciul Ollama:
   ```bash
   ollama serve &
   ```
   Pentru a rulea în fundal permanent, considerați configurarea ca un serviciu systemd (vezi mai jos).
3. Descărcați un model potrivit (exemplu: llama3:8b):
   ```bash
   ollama pull llama3:8b
   ```
4. Verificați că modelul este disponibil:
   ```bash
   ollama list
   ```

### Configurarea Ollama ca serviciu systemd (opțional dar recomandat)
1. Creați fișierul de serviciu:
   ```bash
   sudo nano /etc/systemd/system/ollama.service
   ```
2. Adăugați următorul conținut:
   ```ini
   [Unit]
   Description=Ollama service
   After=network-online.target

   [Service]
   ExecStart=/usr/local/bin/ollama serve
   User=pi
   Group=pi
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=default.target
   ```
3. Salvați și ieșiți (Ctrl+O, Enter, Ctrl+X în nano)
4. Activați serviciul:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ollama
   sudo systemctl start ollama
   ```
5. Verificați starea:
   ```bash
   sudo systemctl status ollama
   ```

### Configurarea integrării Tuya (opțional)
Dacă doriți să afișați temperaturile de la senzori IoT Tuya (termostate, senzori de temperatură):

1. Creați un cont pe [Tuya IoT Platform](https://eu.platform.tuya.com)
2. Creați un proiect Cloud și obțineți `Access ID` și `Access Secret`
3. Adăugați dispozitivele dvs. la proiect
4. Completați în `.env`:
   ```env
   TUYA_ACCESS_ID=your_access_id
   TUYA_ACCESS_SECRET=your_access_secret
   TUYA_API_REGION=eu  # eu, us, cn, in în funcție de regiune
   ```
   Alternativ, aceste credențiale pot fi configurate și din interfața web, la Setări → Tuya Cloud.

## Configurarea Wi-Fi din interfață (doar pe RPi)

HomeTasks poate gestiona conexiunea Wi-Fi a Raspberry Pi-ului direct din interfața
web — util pentru un dispozitiv kiosk fără tastatură: scanezi rețelele din jur,
introduci parola și te conectezi, totul de pe ecranul tactil. Funcția este la
**Setări → Network**.

### Cerințe
- **NetworkManager** (`nmcli`), standardul pe **Raspberry Pi OS Bookworm**.
  Aplicația folosește exclusiv `nmcli`; nu atinge niciodată `wpa_supplicant.conf`.
  NetworkManager deține profilurile salvate și reconectează automat după repornire.
- Pe sisteme fără `nmcli` (Windows, Raspberry Pi OS mai vechi cu `dhcpcd`),
  funcția se dezactivează elegant: **tab-ul „Network" nici nu se afișează**, iar
  scanarea întoarce o listă goală în loc să dea eroare.

Verificați disponibilitatea pe RPi:
```bash
which nmcli                       # tipic /usr/bin/nmcli
systemctl status NetworkManager   # trebuie să fie „active (running)"
```
Dacă lipsește pe un sistem mai vechi: `sudo apt install network-manager`, apoi
activați-l (`sudo systemctl enable --now NetworkManager`).

### Cum funcționează
Frontend-ul comunică cu API-ul REST `/api/wifi/*`, iar backend-ul rulează `nmcli`:

| Acțiune | Endpoint | Comandă `nmcli` |
| --- | --- | --- |
| Detecție disponibilitate / status | `GET /api/wifi/status` | `nmcli -t -f IN-USE,SSID,DEVICE device wifi` + `device show <dev>` pentru IP |
| Scanare rețele | `POST /api/wifi/scan` | `nmcli -t -f IN-USE,SIGNAL,SECURITY,SSID device wifi list --rescan yes` |
| Conectare | `POST /api/wifi/connect` | `nmcli device wifi connect <ssid> [password <parola>] [hidden yes]` |
| Deconectare | `POST /api/wifi/disconnect` | `nmcli device disconnect <dev>` |

- **Afișarea tab-ului**: la deschiderea Setărilor, interfața apelează
  `/api/wifi/status`; tab-ul „Network" apare **doar dacă răspunsul are
  `available: true`** (adică `nmcli` există pe sistem).
- **Pornirea scanării**: scanarea NU rulează la pornirea aplicației. Se
  declanșează (a) automat când deschideți tab-ul „Network", (b) manual cu butonul
  „Scanează" și (c) automat după o conectare/deconectare reușită. `--rescan yes`
  forțează o scanare proaspătă (timeout 20 s).
- **Rezultate**: rețelele sunt deduplicate după SSID (câștigă semnalul cel mai
  puternic), sortate descrescător după putere; rețelele ascunse (SSID gol) sunt
  ignorate. Fiecare intrare arată puterea semnalului, lacăt 🔒 pentru rețele
  securizate și marcaj pentru rețeaua curentă.
- **Conectare**: pentru rețele securizate apare un câmp de parolă inline; pentru
  rețele deschise conectarea pornește imediat (timeout 45 s — DHCP + autentificare
  pot dura). Pe un kiosk fără tastatură, parola se poate scrie cu tastatura pe
  ecran (butonul ⌨ de lângă câmpul de parolă).

> **Permisiuni:** serviciul `hometasks` rulează ca `pi` **fără sesiune grafică**,
> deci conectarea cere drepturi polkit pentru administrarea NetworkManager
> (apartenență la `netdev` plus, pe polkit 0.105, o ajustare în `.pkla`). Vezi
> [deploy/DEPLOY.md](../deploy/DEPLOY.md) → „Permite userului serviciului să
> administreze rețeaua" dacă conectarea eșuează cu „Not authorized" / „Insufficient
> privileges".

> **Notă:** detaliile de implementare sunt în [src/wifi/service.py](../src/wifi/service.py)
> (backend) și `frontend/src/components/WiFiManager.vue` (UI). Funcția oglindește
> panoul Bluetooth (`src/bt/service.py`) — același tipar scanare/conectare.

## Rularea aplicației HomeTasks

### Prima rulare
```bash
# Asigurați-vă că sunteți în directorul aplicației și mediul virtual este activat
cd /home/pi/HomeTasks
source venv/bin/activate  # Dacă nu este deja activat

# Instalați dependințele specifice aplicației
pip install -r requirements.txt

# Rulează aplicația
python src/main.py
```

Aplicația va porni pe http://localhost:5000

### Frontend SPA (Vue 3 + Vite)

Aplicația este o **Single Page Application** Vue 3 + Vite + Pinia. Codul SPA se
află în directorul `frontend/`; Flask servește bundle-ul construit din
`frontend/dist/` și expune doar API-ul REST `/api/*`. Vezi
[docs/SPA_MIGRATION.ro.md](SPA_MIGRATION.ro.md) pentru detalii arhitecturale.

Prerechizite suplimentare: **Node.js 18+ și npm**.

#### Instalarea Node.js 18 (pe Raspberry Pi)
**Important:** Node.js din depozitul implicit Raspberry Pi OS / Debian este de
obicei mult prea vechi (ex. v10), iar `vue-tsc`/Vite au nevoie de **Node 18+**.
Cu un Node vechi, build-ul eșuează cu erori de tipul
`SyntaxError: Unexpected token .` (optional chaining `?.`) sau avertismente
`npm WARN EBADENGINE ... current: { node: 'v10.x' }`. Instalați Node 18 din
NodeSource:

```bash
# Eliminați Node-ul vechi din apt (dacă există)
sudo apt remove --purge nodejs npm -y
sudo apt autoremove -y

# Adăugați depozitul NodeSource 18.x și instalați
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Confirmați versiunea (trebuie v18.x)
node -v
npm -v
```

> Funcționează și pe Raspberry Pi OS 32-bit (armhf) — NodeSource oferă build-uri
> armhf pentru Node 18. Dacă NodeSource nu merge pe placa voastră, folosiți `nvm`:
> `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`,
> redeschideți terminalul, apoi `nvm install 18 && nvm use 18`.

```bash
# Instalare dependențe SPA (o singură dată)
cd frontend
npm install

# Dezvoltare (Vite dev server pe :5173, proxy /api → Flask :5000)
# Pornește Flask separat în alt terminal: python src/main.py
npm run dev

# Build pentru producție (bundle în frontend/dist/)
npm run build

# Verificare doar de tipuri (TypeScript), fără build
npm run type-check
```

În dev, deschideți http://localhost:5173 — Vite face proxy pentru `/api/*` către
Flask (`http://localhost:5000`). Routerul Vue gestionează toate cele cinci
view-uri (`/`, `/calendar`, `/radio`, `/transport`, `/history`) cu code-splitting
automat per route; Flask face fallback la `index.html` pentru orice path non-API
ca să meargă refresh-ul direct pe rute client-side.

Build-ul produce și fișiere `.br` și `.gz` precompresate (prin
`vite-plugin-compression`). Flask le servește automat clienților care anunță
`Accept-Encoding: br` / `gzip` — util pentru kiosk-ul Chromium pe Raspberry Pi
(bundle inițial ~88 KB gzip).

> **Notă:** codul MPA original (template-uri Jinja + JS vanilla) e arhivat în
> [legacy/](../legacy/) ca referință; nu mai e servit de aplicație. Poate fi
> șters complet după validarea SPA-ului în producție.

### Configurarea aplicației pentru a porni la pornirea sistemului
1. Creați un fișier de serviciu systemd pentru aplicația HomeTasks:
   ```bash
   sudo nano /etc/systemd/system/hometasks.service
   ```
2. Adăugați următorul conținut:
   ```ini
   [Unit]
   Description=HomeTasks - Family task management application
   After=network-online.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/HomeTasks
   Environment="PATH=/home/pi/HomeTasks/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
   ExecStart=/home/pi/HomeTasks/venv/bin/python /home/pi/HomeTasks/src/main.py
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```
3. Salvați și ieșiți (Ctrl+O, Enter, Ctrl+X în nano)
4. Activați serviciul:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable hometasks
   sudo systemctl start hometasks
   ```
5. Verificați starea:
   ```bash
   sudo systemctl status hometasks
   ```

### Accesarea aplicației
- Pentru acces local pe dispozitivul care rulează aplicația: `http://localhost:5000`
- Pentru acces de pe alte dispozitive în rețea locală: `http://<ip-address>:5000`
  - Găsiți adresa IP cu: `hostname -I` sau `ip addr show`
  - Exemplu: `http://192.168.1.100:5000`

### Pornirea automată a browserului în modul kiosk (ecran local pe Raspberry Pi)

Dacă aveți un ecran conectat la Raspberry Pi și doriți ca aplicația să se deschidă automat în browser la pornirea sistemului, urmați pașii de mai jos.

**Cerință**: Raspberry Pi OS cu interfață grafică (Desktop), nu versiunea Lite.

1. Instalați Chromium dacă nu este deja instalat:
   ```bash
   sudo apt install chromium -y
   ```
   > **Numele binarului diferă între versiuni:** pe Raspberry Pi OS **Bookworm/Trixie**
   > pachetul și comanda sunt `chromium`. Pe **Bullseye** (și mai vechi) erau
   > `chromium-browser`. Verificați ce aveți cu `which chromium` / `which chromium-browser`
   > și folosiți numele corect în comanda `Exec=` de mai jos — dacă e greșit, autostart-ul
   > eșuează în tăcere (browserul nu se deschide la pornire).

2. Creați directorul autostart dacă nu există:
   ```bash
   mkdir -p ~/.config/autostart
   ```

3. Creați fișierul de autostart pentru kiosk:
   ```bash
   nano ~/.config/autostart/hometasks-kiosk.desktop
   ```

4. Adăugați următorul conținut:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=HomeTasks Kiosk
   Exec=bash -c "sleep 5 && chromium --kiosk --touch-events=enabled --alsa-output-device=plughw:CARD=Headphones,DEV=0 --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble http://localhost:5000/"
   X-GNOME-Autostart-enabled=true
   ```
   > `sleep 5` asigură că serviciul `hometasks` pornește înainte de a deschide browserul.
   >
   > `--touch-events=enabled` este **esențial pe ecranele tactile**: fără el, Chromium
   > adesea nu recunoaște touchscreen-ul RPi și tratează atingerea ca pe un click de
   > mouse — butoanele funcționează, dar **nu poți derula listele cu degetul** (ex. lista
   > de posturi radio). Flag-ul forțează procesarea corectă a gesturilor de touch (drag-scroll).

5. Salvați și ieșiți (Ctrl+O, Enter, Ctrl+X în nano)

6. Opțional — dezactivați screensaver-ul și economisirea energiei pentru ecran:
   ```bash
   # Adăugați în ~/.config/autostart/disable-screensaver.desktop
   nano ~/.config/autostart/disable-screensaver.desktop
   ```
   ```ini
   [Desktop Entry]
   Type=Application
   Name=Disable Screensaver
   Exec=xset s off -dpms
   X-GNOME-Autostart-enabled=true
   ```

7. Reporniți Raspberry Pi:
   ```bash
   sudo reboot
   ```

După repornire, browserul va deschide automat `http://localhost:5000` în modul fullscreen (kiosk).

## Verificarea instalării

### Verificarea componentelor
1. **Python și dependințe**: 
   ```bash
   python -c "import flask, requests; print('Dependințe de bază disponibile')"
   ```
2. **Microfon** (doar dacă utilizați STT pe server):
   - Rulează `arecord -l` pentru a vedea dacă microfonul este detectat
   - Testează cu `arecord -d 5 test.wav && aplay test.wav`
3. **Ollama**:
   ```bash
   curl http://localhost:11434/api/version
   ollama list
   ```

### Loguri și depanare
- Aplicația scrie loguri în directorul `logs/` (se creează automat)
- Pentru a vedea logurile în timp real: `tail -f logs/hometask.log`
- Pentru a vedea logurile Ollama (dacă rulează ca serviciu): `journalctl -u ollama`
- In caz de erori, verifică:
  - `logs/hometask.log` pentru erori aplicației
  - `dmesg` pentru probleme de hardware

## Actualizarea aplicației

### Actualizarea sursei
```bash
cd /home/pi/HomeTasks
git pull origin main  # sau ramificația voastră de dezvoltare
```

### Actualizarea dependințelor
```bash
source venv/bin/activate
pip install --upgrade -r requirements.txt
```

### Rebuild frontend SPA (după `git pull`)
Dacă a fost actualizat codul din `frontend/`, refaceți bundle-ul servit de Flask:
```bash
cd frontend
npm install        # actualizează dependențele SPA dacă s-au schimbat
npm run build      # regenerează frontend/dist/
cd ..
sudo systemctl restart hometasks   # dacă rulează ca serviciu
```

### Actualizarea modelului Ollama
```bash
ollama pull llama3:8b  # înlocuiți cu modelul voastră
# Pentru a șterge un model vechi:
# ollama rm llama3:8b
```

## Soluționarea problemelor comune la instalare

### Problema: "No module named 'flask'"
**Soluție**: Instalați Flask:
```bash
pip install flask
```

### Problema: "Eroare la recunoasterea vorbirii: audio-capture" (Raspberry Pi / Linux)
**Cauză**: Browserul nu poate capta microfonul. La `http://<IP-RPi>:5000` de pe alt dispozitiv, microfonul folosit este al acelui dispozitiv. Pe RPi (Chromium la `http://localhost:5000`), microfonul USB trebuie să fie dispozitivul implicit de captură și Chromium trebuie să aibă permisiune pentru microfon.

**Pași pe RPi:**

1. Verificați microfonul: `arecord -l` (notați cardul, ex. card 1).
2. Utilizator în grupul `audio`: `sudo usermod -a -G audio pi` → delogare/relogare.
3. Dispozitiv implicit de captură:
   - **PulseAudio** (`pactl info` merge): `pactl list sources short`, apoi `pactl set-default-source <sursa_USB>`.
   - **Doar ALSA**: în `~/.asoundrc` setați `capture.pcm "plughw:1,0"` (adaptând cardul la `arecord -l`).
4. Test: `arecord -d 3 -f cd test.wav && aplay test.wav`.
5. În Chromium: permisiune microfon (lacăt → Setări site → Microfon: Permite). Deschideți aplicația prin `http://localhost:5000` sau `http://127.0.0.1:5000`.

### Problema: "Eroare la recunoasterea vorbirii: network" / "aborted" (RPi / Chromium)
**Cauză**: Web Speech API folosește serviciul Google; lipsă internet sau firewall → „network” sau „aborted”.

**Ce faceți:** Verificați internetul (`ping -c 3 8.8.8.8`, `curl -sI https://www.google.com`). Nu blocați domenii Google (Pi-hole/firewall). Dacă în Chromium merge https://www.google.com/intl/ro/chrome/demos/speech.html dar nu în aplicație, problema e la aplicație/rețea; dacă nici acolo nu merge, e la Chromium/rețea/Google.

**Debug (fără consolă / kiosk):** Deschideți `http://localhost:5000?voice_debug=1` sau **Setări → Vocal → Afișează jurnal debug voce pe ecran**. În `.env`: `VOICE_DEBUG_LOG=1` activează și scrierea în `logs/voice-debug.log`; `VOICE_DEBUG_LOG=0` sau `false` dezactivează și panoul „Voice debug” pe ecran (serverul îl ascunde în frontend).

### Soluție: microfon pe server (când browserul dă „aborted” / „network”)
Dependențe: `pip install -r requirements.txt`. Microfon detectat: `arecord -l`; utilizator în grupul `audio`. În aplicație: **Setări → Vocal → Folosește microfonul serverului**. Comanda vocală se dă apăsând butonul de microfon; ascultarea pentru cuvântul de activare este dezactivată când această opțiune e bifată.

Dacă opțiunea e gri: pe RPi instalați `sudo apt install portaudio19-dev` (sau `python3-pyaudio`), apoi `pip install -r requirements.txt`. Verificați `arecord -l` și grupul `audio`. Dacă tot nu merge: setați captura ALSA în `~/.asoundrc` (ca la punctul 3 de mai sus) și testați `arecord -d 3 -f cd test.wav && aplay test.wav`. Mesaje frecvente: „No speech heard” → vorbiți în cele ~6 s; „Recognition service error” → internet; „Microfon indisponibil” → ALSA/PyAudio.

### TTS (voce răspuns AI) pe RPi în mod kiosk
Dacă **YouTube se aude** în Chromium dar **mesajele AI (🔊) nu**, sunetul pentru TTS în aplicație trebuie redat prin același flux ca YouTube (HTML5 Audio). Pașii care funcționează:

1. **PulseAudio în sesiune**  
   În `~/.config/lxsession/LXDE-pi/autostart` adăugați linia **`@pulseaudio --start`** (înainte de linia care pornește Chromium), ca PulseAudio să ruleze în sesiunea de desktop.
   > ⚠️ **NU** faceți acest pas dacă ați configurat PulseAudio în **mod system** pentru boxele Bluetooth (vezi [audio-streaming.ro.md](audio-streaming.ro.md), „Runbook RPi"). Cele două servere se bat pe placa de sunet. Cu modul system, Chromium și microfonul folosesc oricum serverul system (`default-server` din `client.conf`), deci săriți peste `@pulseaudio --start`.

2. **Dependențe proiect**  
   `pip install -r requirements.txt` (include gTTS pentru TTS pe server).

3. **Chromium cu ieșirea ALSA corectă**  
   Porniți Chromium cu parametrul pentru boxe/căști, de ex.:  
   `--alsa-output-device=plughw:CARD=Headphones,DEV=0`  
   (dispozitivul îl vedeți cu `aplay -L`; pentru Headphones e tipic `plughw:CARD=Headphones,DEV=0`).

4. **raspi-config**  
   **System Options → Audio → Headphones** (sau HDMI, dacă folosiți monitorul cu boxe integrate).

Cu acești pași, răspunsurile vocale AI (și YouTube) ar trebui să se audă în boxe. Fără gTTS instalat, aplicația revine la TTS din browser, care în kiosk poate să nu se audă.

### Problema: "PortAudio error: -9996 (Invalid input device)"
**Soluție** (doar dacă utilizați STT pe server):
1. Verificați conexiunea microfonului: `arecord -l`
2. Asigurați-vă că utilizatorul are permisiuni de acces la dispozitivele audio:
   ```bash
   sudo usermod -a -G audio pi
   ```
3. Reporniți sistemul sau deconectați-vă și reconectați-vă.

### Problema: "SyntaxError: Unexpected token ." sau "vue-tsc: Permission denied" la `npm run build`
**Cauză**: Node.js prea vechi (ex. v10 din depozitul Raspberry Pi OS). `vue-tsc`
și Vite folosesc sintaxă (optional chaining `?.`) suportată doar de **Node 18+**.
Semnele tipice:
- `SyntaxError: Unexpected token .` în `@volar/typescript/.../runTsc.js`
- `npm WARN EBADENGINE ... required: { node: '^18.0.0 ...' }, current: { node: 'v10.x' }`
- `ExperimentalWarning: The fs.promises API is experimental` (Node 10/11)
- `sh: 1: vue-tsc: Permission denied` (cod 126) — binarele din `node_modules/.bin/`
  fără bit de execuție, frecvent după `npm install` rulat cu un Node vechi.

**Soluție**:
1. Instalați **Node 18** (vezi „Instalarea Node.js 18 (pe Raspberry Pi)"). Verificați cu `node -v`.
2. Reinstalați curat dependențele SPA cu Node-ul nou și rebuild:
   ```bash
   cd ~/HomeTasks/frontend
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```
> Nu rulați `npm` cu `sudo` — nu rezolvă versiunea Node și strică owner-ul
> fișierelor. Dacă ați folosit `sudo` din greșeală: `sudo chown -R pi:pi node_modules ~/.npm`.

### Problema: "ERROR: Unsupported architecture: armv7l" la instalarea Ollama
**Cauză**: Ollama nu oferă build-uri pentru procesor 32-bit ARM (armv7l). Scriptul oficial suportă doar x86_64 și arm64 (64-bit).

**Soluții**:
1. **Recomandat**: Folosiți **Raspberry Pi OS 64-bit** (nu Lite 32-bit). Reinstalați sistemul cu imaginea 64-bit de pe [raspberrypi.com/software](https://www.raspberrypi.com/software/), apoi rulați din nou `curl -fsSL https://ollama.com/install.sh | sh`.
2. **Alternativă**: Rulați Ollama pe un alt calculator din rețea (PC, Mac sau Raspberry Pi cu OS 64-bit), porniți acolo `ollama serve` (sau serviciul Ollama), și în `.env` pe Raspberry Pi setați: `OLLAMA_HOST=http://<IP-calculatorul-cu-ollama>:11434`. Aplicația HomeTasks va folosi Ollama de pe acel host.

### Problema: "Cannot connect to Ollama server at http://localhost:11434:111 Connection refused"
**Soluție**:
1. Verificați dacă Ollama rulează: `ps aux | grep ollama`
2. Dacă nu rulează, porniți-l manual: `ollama serve &`
3. Dacă rulează ca serviciu, verificați starea: `sudo systemctl status ollama`
4. Asigurați-vă că nu există firewall-uri care să blocheze portul 11434.

### Problema: "Could not find a suitable TLS CA certificate bundle"
**Cauza**: Pachetul `certifi` nu găsește certificatele SSL (de obicei după ștergerea și recrearea mediului virtual).
**Soluție**: Recreați mediul virtual și reinstalați dependențele:
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# sau: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Problema: "API key invalid" pentru serviciul meteorologic
**Soluție**:
1. Verificați cheia API în fișierul `.env`
2. Asigurați-vă că serviciul meteorologic selectat acceptă cheia voastră
3. Testați cheia API direct în browser sau cu curl:
   ```bash
   curl "http://api.openweathermap.org/data/2.5/weather?q=London&appid=TA_CHEIE_AICI"
   ```
4. Verificați limita zilna de cereri pentru contul voastră.

### Problema: Aplicația se închide imediat după pornire
**Soluție**:
1. Verificați logurile: `cat logs/hometask.log`
2. Căutați erori de importare lipsă și instalați pachetele respective
3. Asigurați-vă că fișierul `.env` există și conține variabilele necesare
4. Rulează aplicația din terminal pentru a vedea erori în timp real: `python src/main.py`

### Problema: Nu pot accesa aplicația de pe alte dispozitive
**Soluție**:
1. Asigurați-vă că aplicația rulează și este accesibilă pe portul 5000: `netstat -tuln | grep 5000`
2. Verificați firewall-ul local: `sudo ufw status` sau `sudo iptables -L`
3. Dacă aveți firewall activ, permiteți traficul pe portul 5000:
   ```bash
   sudo ufw allow 5000/tcp
   ```
4. Asigurați-vă că utilizați adresa IP corectă a dispozitivului (nu localhost de pe alte dispozitive)

### Problema: Tab-ul „Network" (Wi-Fi) nu apare în Setări
**Cauză**: Tab-ul „Network" se afișează doar dacă backend-ul răspunde
`available: true` la `/api/wifi/status`, ceea ce se întâmplă **doar când `nmcli`
(NetworkManager) este găsit pe sistem**.

**Diagnostic** (pe RPi, cu aplicația pornită):
```bash
# 1. Ce raportează backend-ul? Urmăriți câmpul "available"
curl -s http://localhost:5000/api/wifi/status

# 2. Există nmcli și rulează NetworkManager?
which nmcli
systemctl status NetworkManager
```

**Soluție în funcție de rezultat**:
1. **`"available": false`** → lipsește NetworkManager. Pe Raspberry Pi OS Bookworm
   e standard; pe versiuni mai vechi (Bullseye/Buster) instalați-l:
   ```bash
   sudo apt install network-manager -y
   sudo systemctl enable --now NetworkManager
   ```
   (Notă: poate intra în conflict cu `dhcpcd` pe sisteme vechi — pe Bookworm nu e
   o problemă.) Apoi reporniți aplicația și redeschideți Setările.
2. **`"available": true` dar tab-ul tot nu apare** → bundle vechi de frontend în
   browser. Asigurați-vă că ați rulat `npm run build` după `git pull` (vezi
   „Rebuild frontend SPA"), apoi faceți **hard refresh** în Chromium
   (Ctrl+Shift+R). În mod kiosk, reporniți Chromium sau goliți cache-ul.
3. **`nmcli` lipsește (`which nmcli` gol)** dar credeți că e instalat → confirmați
   calea; serviciul `hometasks` găsește binarele din `/usr/bin` (inclus în PATH-ul
   din unit-ul systemd).

### Problema: Conectarea la Wi-Fi eșuează cu „Not authorized" / „Insufficient privileges"
**Cauză**: Serviciul `hometasks` rulează ca `pi` prin systemd, **fără sesiune
grafică**. NetworkManager cere autorizare prin polkit, iar regulile implicite cer o
sesiune activă pentru salvarea unei conexiuni de sistem — deci un serviciu fără
sesiune e refuzat chiar dacă `pi` e în grupul `netdev`.

**Soluție**: Acordă userului serviciului drepturi polkit pentru NetworkManager.
Pașii diferă în funcție de versiunea polkit (`pkaction --version`) — pe polkit 0.105
trebuie relaxată regula vendor din `.pkla`. Procedura completă, testată, e în
[deploy/DEPLOY.md](../deploy/DEPLOY.md) → „Permite userului serviciului să
administreze rețeaua". Verificare rapidă că a mers:
```bash
GPID=$(systemctl show -p MainPID --value hometasks)
sudo pkcheck --action-id org.freedesktop.NetworkManager.settings.modify.system --process "$GPID"; echo "exit=$?"
# exit=0 înseamnă autorizat → butonul „Conectează" va funcționa
```

### Problema: Performanța slaba sau blocări frecvente
**Soluție**:
1. Monitorizați utilizarea de resurse: `top` sau `htop`
2. Dacă utilizarea RAM-ului este ridicată, considerați:
   - Utilizarea unui model Ollama mai mic (ex: phi3:medium sau tinyllama:1.1b)
   - Reducerea temperaturii modelului pentru răspunsuri mai rapide
   - Crescerea memoriei de swap (opțional, dar poate afecta durata de viață a microSD cardului)
3. Dacă utilizarea CPU-ului este ridicată:
   - Verificați dacă există procese de fond nevăzătoare
   - Reduceți frecvența de actualizare a vremii în setări
   - Optimizați interfața web prin reducerea animațiilor neessențiale

## Backup și recuperare

### Backup-ul aplicației și datelor
1. Oparați aplicația dacă rulează
2. Faceți o copie de rezervă a directorului complet:
   ```bash
   cd /home/pi
   tar -czvf hometask_backup_$(date +%Y%m%d_%H%M%S).tar.gz hometask/HomeTasks
   ```
3. Copiați fișierul de backup pe un dispozitiv extern sau în cloud

### Recuperarea din backup
1. Copiați fișierul de backup înapoi pe dispozitivul dvs.
2. Extrageți:
   ```bash
   tar -xzvf hometask_backup_YYYYMMDD_HHMMSS.tar.gz
   ```
3. Restaurați mediul virtual dacă este necesar (ștergeți directorul `venv` și recreați-l)
4. Restaurați dependințele: `pip install -r requirements.txt`
5. Verificați fișierul `.env` și adaptați-l dacă este necesar

## Recomandări de menținere

### Saptămânal
- Verificați jurnalul de activitate pentru activități neobisnuite
- Curățați cache-ul aplicației prin meniul de setări → Avansat → Șterge cache

### Lunar
- Actualizați sistemul de operare: `sudo apt update && sudo apt upgrade -y`
- Actualizați dependințele Python: `pip list --outdated` și actualizați pachetele necesare
- Verificați spațiul disponibil pe disc: `df -h`
- Verificați integritatea fișierului de bază de date (opțional): `sqlite3 data/hometask.db "PRAGMA integrity_check;"`

### Anual
- Schimbați microSD cardul (pentru Raspberry Pi, au tendinza de degradare cu timpul)
- Revizuiți nevoile de hardware și considerați un upgrade dacă aplicația devine prea lentă
- Actualizați modelul Ollama la ultima versiune disponibilă

---

Notă: Deoarece aceasta este o aplicație web, poate rula pe orice dispozitiv capabil să ruleze Python 3.9+, nu numai pe Raspberry Pi. Accesul se face prin browser la adresa http://<ip-address>:5000.