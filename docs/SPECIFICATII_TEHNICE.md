# Specificații tehnice - HomeTasks

## Cerințe hardware minime

### Raspberry Pi (sau orice alt dispozitiv)
- Model recomandat: Raspberry Pi 4 Model B cu 4GB RAM sau mai mare
- Alternativă acceptabilă: Raspberry Pi 3 Model B+ (performante reduse)
- Orice calculator/modern dispozitiv capabil să ruleze Python 3.9+
- Spațiu de stocare minim: 16GB (32GB+ recomandat pentru actualizări și loguri)

### Pentru acces pe dispozitive locale (opțional)
- Ecran tactil capacitiv (pentru Raspberry Pi local)
- Rezoluție minimă: 800x480 px (WVGA)
- Rezoluție recomandată: 1024x600 px sau 1280x720 px
- Dimensiune fizică: 7-10 inch diagonala
- Interfață: HDMI sau DSI (în funcție de modelul Raspberry Pi)

### Alte componente hardware (pentru recunoaștere vocală locală)
- Microfon extern cu reducere de zgomot (pentru recunoaștere vocală bună pe dispozitivul local)
- Cutie de protegere pentru Raspberry Pi (opțional dar recomandat)
- Sursă de alimentare stabilă 5V/3A minim (pentru Raspberry Pi)

## Dependențe software

### Sistem de operare
- Orice sistem de operare capabil să ruleze Python 3.9+ (Linux, Windows, macOS)
- Raspberry Pi OS (formerly Raspbian) 64-bit versiune 2023-05 sau mai nouă (recomandat pentru Raspberry Pi)
- Ubuntu Server pentru Raspberry Pi 64-bit (alternativă)
- Alte distribuții Linux compatibile cu ARM v8

### Limbaj de programare și mediu de execuție
- Python 3.9 sau mai nou
- Pip 21.0 sau mai nou
- Mediu virtual recomandat (venv/virtualenv)

### Biblioteci Python necesare

#### Framework web
```bash
pip install flask  # sau fastapi
```

#### Gestionare taskuri și date
```bash
pip install sqlalchemy  # ORM pentru baze de date
pip install python-dateutil
```

#### Integrare serviciu meteorologic
```bash
pip install requests
```

#### Integrare cu Ollama
```bash
pip install requests  # pentru cereri HTTP catre Ollama API
```

#### Recunoaștere vocală (opțional - server-side)
```bash
pip install SpeechRecognition
pip install pyaudio   # pentru acces la microfon (doar pe server dacă se face STT pe server)
# Pe sistemul de operare poate fi necesar:
# sudo apt-get install portaudio19-dev python3-pyaudio
```

#### Alte utilitare
```bash
pip install python-dotenv  # pentru gestionare variabile de mediu
pip install loguru         # pentru logging avansat (opțional)
```

## Configurare rețea

### Conexiune la internet
- Wi-Fi 802.11ac sau Ethernet Gigabit (pentru actualizări și acces la servicii externe)
- Bandwidth minim recomandat: 5 Mbps descărcare pentru servicii meteorologice și comunicare cu Ollama

### Acces la serverul Ollama
- Serverul Ollama trebuie să ruleze pe același dispozitiv Raspberry Pi/sau pe alt dispozitiv în aceeași rețea locală
- Portul implicit al Ollama: 11434
- Asigurați-vă că firewall-ul permite traficul pe acest port (dacă este activ)

### Serviciu meteorologic
- Necesită acces la internet pentru a consulta API-ul serviciului meteorologic ales (ex: OpenWeatherMap, WeatherAPI, etc.)
- Frecvență recomandată de actualizare: la 30-60 minute pentru a evita limitările de rate

### Accesare aplicație
- Aplicația rulează pe portul 5000 (implicit Flask) pe dispozitivul gazdă
- Pentru acces local pe Raspberry Pi: `http://localhost:5000`
- Pentru acces de pe alte dispozitive în rețea: `http://<raspberry-pi-ip>:5000`
- Pentru acces de pe internet (necesită configurare de port forwarding și securitate suplimentară)

## Specificări privind recunoaștere vocală

### Opțiuni de implementare
1. **Recunoaștere vocală client-side** (recomandat):
   - Folosește API-ul de SpeechRecognition al browserului (Web Speech API)
   - Nu necesă dependințe suplimentare pe server
   - Suport nativ pentru limba română și engleză în browsere moderne
   - Funcționează doar pe HTTPS sau localhost (pentru securitate)

2. **Recunoaștere vocală server-side** (opțional):
   - Folosește SpeechRecognition bibliotecă Python pe server
   - Necesită microfon conectat la dispozitivul serverului
   - Mai multă latență dar poate funcționa și pe browsere fără suport Web Speech API

### Setări de recunoaștere (client-side)
- Limbi suportate: română (ro-RO) și engleză (en-US și en-GB) - prin browser
- Timp de așteptare pentru comandă vocală: 3-5 secunde de tăcere după finalizarea vorbirii
- Limbaj de activare (wakeword): implementat în JavaScript client-side

### Biblioteci de recunoaștere vocală (doar pentru server-side opțional)
- **SpeechRecognition** cu motore de recunoaștere:
  - Google Speech Recognition (necesită conexiune la internet)
  - Vosk (funcționează offline, modele disponibile pentru română și engleză)
  - CMU Sphinx (funcționează offline, acuratețe mai redusă)

## Configurare Ollama

### Modele recomandate
- Pentru înțelegere limbaj natural și generare de răspunsuri:
  - llama3:8b (bun echilibru între performare și calitate)
  - phi3:medium (bun pentru resurse limitate)
  - mistral:7b (bună calitate generală)
- Pentru specializare în taskuri simple:
  - tinyllama:1.1b (foarte rapid, dar cu capabilități limite)

### Descărcare și rulare model
```bash
# Instalare Ollama pe Raspberry Pi sau pe orice alt Linux
curl -fsSL https://ollama.com/install.sh | sh

# Descărcare model potrivit
ollama pull llama3:8b

# Pornire server (implicit pe port 11434)
ollama serve
```

### Cerințe de resurse pentru modele
- llama3:8b: ~4-5GB RAM necesare podczas rulare
- phi3:medium: ~2-3GB RAM necesare
- tinyllama:1.1b: ~1-1.5GB RAM necesare

## Siguranță și confidențialitate

### Stocare date locale
- Taskurile și comentariile sunt stocate local în baza de date SQLite
- Nu se trimit date personale către servicii externe fără consimțământ explicit

### Comunicare cu servicii externe
- Doar datele necesare sunt transmise serviciului meteorologic (coordonate geografice)
- Interacțiunea cu Ollama se face doar pe rețea locală (dacă serverul rulează local)
- Toate cheile API și tokenii de autentificare sunt stocate în variabile de mediu sau fișiere .env (nevizibile în sistemul de control al versiunilor)

### Securitate aplicație web
- Se recomandă utilizarea de variabile de mediu pentru cheile secrete
- Pentru producere, se recomandă utilizarea unui WSGI server precum Gunicorn în loc de serverul de dezvoltare Flask
- Implementare de CSRF protection și validare input
- Servirea prin HTTPS în rețelele publice (folosind nginx ca reverse proxy cu certificat SSL)

### Actualizări de siguranță
- Se recomandă actualizarea regulată a sistemului de operare și dependințelor
- Monitorizare a jurnalelor pentru activități sospexoase

## Performanță și optimizare

### Utilizare resurse
- Utilizare RAM țintă: sub 1GB pentru funcționalitate de bază (plus memorie necesară pentru modelul Ollama)
- Utilizare CPU țintă: sub 30% în stare de liniste pentru a lasa loc pentru procesare AI
- Timp de pornire țintă: sub 10 de secunde de la pornire la interfață utilizabilă

### Optimizări specifice
- Încărcare lângășă a modulelor târziu folosite
- Cache-ing al predicțiilor meteo pentru a reduce numărul de cereri API
- Optimizare interfață pentru actualizări fluide prin teknikă de AJAX/polling sau WebSockets
- Folosire de thread-uri separate pentru operatii blocațitoare (rețeă, I/O)

## Compatibilitate și portabilitate

### Compatibilitate hardware
- Codul ar trebui să funcționeze pe orice dispozitiv capabil să ruleze Python 3.9+
- Perfect pentru Raspberry Pi, dar funcționează la fel bine pe laptopuri, desktop-uri sau servere

### Portabilitate software
- Design modular pentru a permite înlocuirea ușoară a componentelor
- Folosire de abstrații pentru servicii externe (facilită mocking în teste și schimbare furnizori)
- Evitare de dependențe specifice platformei în nucleul aplicației

## Limitări cunoscute

### Limitații hardware
- Performanța recunoașterii vocale server-side poate fi afectată în medii foarte zgomotoase (doar dacă se folosește microfonul serverului)
- Modelele mari de AI pot necesita multă RAM și pot provoca swapping pe dispozitivele cu memorie limitată
- Pentru recunoaștere vocală client-side, funcționează doar pe browsere cu suport Web Speech API (majoritatea browsere moderne)

### Limitații software
- Dependență de conexiune la internet pentru serviciul meteorolic și (potencial) pentru recunoaștere vocală client-side (Google API)
- Limitații legate de rate ale API-urilor gratuite meteorologice
- Dimensiunea modelului Ollama afectează direct utilizarea de RAM și viteza de răspuns
- Recunoașterea vocală client-side funcționează doar pe localhost sau HTTPS (din motive de securitate browser)
