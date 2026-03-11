# Ghid de instalare - HomeTasks (Web)

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
- Cază de protejare pentru Raspberry Pi (opțional dar recomandat)

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
sudo apt install python3 python3-pip -y

# Pe macOS (folosind Homebrew)
# brew install python3

# Pe Windows: Descărcați și instalați de pe https://www.python.org/downloads/
```

### Crearea unui mediu virtual (recomandat)
```bash
# Navigați în directorul waar doriți să instalați aplicația
# Exemplu pentru Raspberry Pi:
cd /home/pi
mkdir hometask
cd hometask

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

# Instalați dependințele de bază pentru aplicația web
pip install flask  # sau fastapi
pip install python-dateutil
pip install requests
pip install SpeechRecognition  # opțional, doar dacă implementați STT pe server
pip install pyaudio            # opțional, doar dacă implementați STT pe server
pip install python-dotenv

# Dependențe de sistem pentru PyAudio (pe Raspberry Pi OS, doar dacă nevoie pentru STT pe server):
# sudo apt install portaudio19-dev python3-pyaudio -y
```

## Descărcarea și configurarea aplicației HomeTasks

### Obținerea sursei aplicației
```bash
# În mediul virtual activat
git clone https://github.com/utilizator/HomeTasks.git
cd HomeTasks
```

### Crearea fișierului de variabile de mediu
Creați un fișier `.env` în directorul rădăcină al aplicației:
```bash
cp .env.example .env
```
Editați fișierul `.env` și completați:
```env
# Variabile de mediu pentru HomeTasks
FLASK_APP=src/main.py
FLASK_ENV=development  # schimbați în production pentru producere
SECRET_KEY=cheia_secreta_pentru_sesiuni  # generați o valoare aleatoare sigură
WEATHER_API_KEY=cheia_tua_pentru_serviciul_meteorologic
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b
DEFAULT_LANGUAGE=ro  # sau en pentru engleză
VOICE_ACTIVATION_WORD=Hey HomeTasks
TEMPERATURE_UNIT=C  # sau F
UPDATE_INTERVAL_MINUTES=30
```

### Configurarea serverului Ollama
1. Instalați Ollama pe dispozitivul dvs. (Raspberry Pi sau orice alt Linux):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Porniți serviciul Ollama:
   ```bash
   ollama serve &
   ```
   Pentru a rulea în фонду permanent, considerați configurarea ca un serviciu systemd (vezi mai jos).
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

## Rularea aplicației HomeTasks

### Prima rulare
```bash
# Asigurați-vă că sunteți în directorul aplicației și mediul virtual este activat
cd /home/pi/hometask/HomeTasks
source venv/bin/activate  # Dacă nu este deja activat

# Instalați dependințele specifice aplicației
pip install -r src/requirements.txt

# Rulează aplicația
python src/main.py
```

Aplicația va porni pe http://localhost:5000

### Configurarea aplicației pentru a porni la pornirea sistemului
1. Creați un fișier de serviciu systemd pentru aplicația HomeTasks:
   ```bash
   sudo nano /etc/systemd/system/hometask.service
   ```
2. Adăugați următorul conținut:
   ```ini
   [Unit]
   Description=HomeTasks - Family task management application
   After=network-online.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/hometask/HomeTasks
   Environment=PATH=/home/pi/hometask/HomeTasks/venv/bin
   ExecStart=/home/pi/hometask/HomeTasks/venv/bin/python /home/pi/hometask/HomeTasks/src/main.py
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```
3. Salvați și ieșiți (Ctrl+O, Enter, Ctrl+X în nano)
4. Activați serviciul:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable hometask
   sudo systemctl start hometask
   ```
5. Verificați starea:
   ```bash
   sudo systemctl status hometask
   ```

### Accesarea aplicației
- Pentru acces local pe dispozitivul care rulează aplicația: `http://localhost:5000`
- Pentru acces de pe alte dispozitive în rețea locală: `http://<ip-address>:5000`
  - Găsiți adresa IP cu: `hostname -I` sau `ip addr show`
  - Exemplu: `http://192.168.1.100:5000`

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
cd /home/pi/hometask/HomeTasks
git pull origin main  # sau ramificația voastră de dezvoltare
```

### Actualizarea dependințelor
```bash
source venv/bin/activate
pip install --upgrade -r requirements.txt
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

### Problema: "PortAudio error: -9996 (Invalid input device)"
**Soluție** (doar dacă utilizați STT pe server):
1. Verificați conexiunea microfonului: `arecord -l`
2. Asigurați-vă că utilizatorul are permisiuni de acces la dispozitivele audio:
   ```bash
   sudo usermod -a -G audio pi
   ```
3. Reporniți sistemul sau deconectați-vă și reconectați-vă.

### Problema: "Cannot connect to Ollama server at http://localhost:11434:111 Connection refused"
**Soluție**:
1. Verificați dacă Ollama rulează: `ps aux | grep ollama`
2. Dacă nu rulează, porniți-l manual: `ollama serve &`
3. Dacă rulează ca serviciu, verificați starea: `sudo systemctl status ollama`
4. Asigurați-vă că nu există firewall-uri care să blocheze portul 11434.

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