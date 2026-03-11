# Arhitectura aplicației HomeTasks (Web)

## Diagrama de arhitectură

```
+---------------------+     +------------------+     +----------------------+
|                     |     |                  |     |                      |
|   Frontend Browser  |<--->|   Backend Server |<--->|   Model Date         |
|   (HTML/CSS/JS)     |     |   (Flask/FastAPI)|     |   (SQLite)           |
|                     |     |                  |     |                      |
+---------------------+     +------------------+     +----------------------+
          ^                         ^                         ^
          |                         |                         |
          |                         |                         |
+---------------------+     +------------------+     +----------------------+
|                     |     |                  |     |                      |
|  Modul Vreme        |     |  Modul Ollama    |     |  Modul Vocal         |
|  (API meteorologic) |     |  (AI local)      |     |  (Speech-to-Text)    |
|                     |     |                  |     |                      |
+---------------------+     +------------------+     +----------------------+
```

## Descriere componentelor

### 1. Frontend Browser
- **Scop**: Afișarea informațiilor utilizatorului și capturarea interacțiunilor prin browser
- **Tehnologii**: HTML5, CSS3, JavaScript (Vanilla sau cu HTMX/Alpine.js pentru simplicitate)
- **Responsabilități**:
  - Afișarea taskurilor pentru ziua curentă și următoarele 7 zile
  - Afișarea informațiilor meteorologice curente și prognoza
  - Capturarea input-ului prin formulare și butoane
  - Afișarea notificărilor și mesajelor de confirmare
  - Actualizarea dinamică a conținutului prin AJAX/WebSockets
  - Implementarea recunoașterii vocale client-side prin Web Speech API
  - Responsivitate pentru acces de pe dispozitive mobile și tablete

### 2. Backend Server (Flask/FastAPI)
- **Scop**: Coordonația fluxului de date, logica de aplicatie și expunerea API-urilor
- **Tehnologii**: Python cu framework-ul Flask sau FastAPI
- **Responsabilități**:
  - Primirea cererilor HTTP de la frontend și direcționarea lor către modulele corespunzătoare
  - Gestionarea stării aplicației prin sesiuni sau tokenuri
  - Coordinarea comunicării dintre modulele de business logic
  - Implementarea regulilor de business (validare taskuri, verificare permisiuni utilizator etc.)
  - Gestionarea erorilor și returnarea de răspunsuri HTTP corespunzătoare
  - Servirea fișierelor statice (HTML, CSS, JS)
  - Expunerea API-urilor REST pentru comunicarea cu frontend-ul

### 3. Model Date (SQLite)
- **Scop**: Stocarea persistentă a datelor aplicației
- **Tehnologie**: SQLite cu SQLAlchemy ORM (sau direct sqlite3 pentru simplicitate)
- **Tabele principale**:
  - `utilizatori`: Informații despre membrii familiei (nume, preferințe etc.)
  - `taskuri`: Taskurile cu detalii (descriere, dată, utilizator asignat, statut etc.)
  - `comentarii`: Comentarii atasate taskurilor
  - `preferinte`: Setările aplicației per utilizator (limbă, notificări etc.)

### 4. Modul Vreme
- **Scop**: Obținerea și procesarea informațiilor meteorologice
- **Tehnologie**: Requests library pentru apeluri HTTP catre API-uri meteorologice
- **Funcționalități**:
  - Obținerea vremii curente pentru locația configurată
  - Obținerea prognozei pe 7 zile
  - Transformarea datelor primite în format utilizabil de aplicație
  - Caching temporar pentru a reduce numărul de cereri API
  - Gestionearea erorilor de conectare și limitări de rate

### 5. Modul Ollama
- **Scop**: Comunicarea cu modelul AI local rulând pe serverul Ollama
- **Tehnologie**: Requests library pentru apeluri HTTP catre Ollama API (localhost:11434)
- **Funcționalități**:
  - Trimiterea interogărilor textuale către modelul AI
  - Primirea și procesarea răspunsurilor de la model
  - Gestionarea conversațiilor (menținerea contextului)
  - Timeout-uri și mecanisme de retry pentru cereri eșuate
  - Compresie a contextului pentru a evita depășirea limitelor de tokeni

### 6. Modul Vocal (opțional - server-side)
- **Scop**: Conversia vorbirii în text (doar dacă se implementează pe server)
- **Tehnologii** (doar pentru implementare server-side opțională): 
  - SpeechRecognition pentru speech-to-text
  - PyAudio pentru accesul la hardware-ul de audio (doar pe server)
- **Funcționalități** (doar pentru server-side):
  - Ascultarea continuă pentru comanda de activare (wakeword) sau modul de push-to-talk
  - Recunoaștere vorbirii în limba română și engleză
  - Filtrażie zgomotului de fundal
  - Conversia textului în comandă acționabilă pentru controller
  - Opțional: sintetizarea vorbirii pentru răspunsurile AI

> **Notă**: Pentru majoritatea implementărilor, recunoașterea vocală va fi realizată client-side prin Web Speech API al browserului, eliminând nevoia pentru acest modul pe server.

## Fluxuri de date cheie

### Adăugare nou task prin frontend
1. Utilizatorul completează formularul în browser și apasă "Adaugă task"
2. Frontend trimite o cerere POST la `/api/tasks` prin JavaScript (fetch/AJAX)
3. Backend primește cererea și o direcționează către task_manager
4. Task_manager validează datele și le trimite modelului de date pentru salvare
5. Modelul de date salvează taskul în baza de date SQLite
6. Backend returnează un răspuns JSON cu taskul creat sau eroare
7. Frontend actualizează lista de taskuri prin JavaScript fără reîncărcarea paginii

### Adăugare nou task prin comandă vocală client-side
1. Utilizatorul activează recunoașterea vocală prin buton sau wakeword în browser
2. Browserul captează audio-ul și îl convertește în text folosind Web Speech API
3. Textul este trimis backend-ului prin cerere POST la `/api/voice-command`
4. Backend primește cererea și o direcționează către controllerul principal
5. Controllerul determină dacă este o comandă de sistem sau o interogare pentru AI
6. Dacă este interogare pentru AI, controllerul trimite textul modulului Ollama
7. Modulul Ollama face o cerere catre serverul Ollama local și primește răspunsul
8. Răspunsul este returnat frontend-ului pentru afișare
9. Opțional: frontend-ul utilizează Web Speech API pentru text-to-speech al răspunsului

### Actualizare informații meteo
1. La intervale regulate (de exemplu, la fiecare 30 de minute) sau la pornirea aplicației
2. Backend solicită modulului de vreme să obțină datele actualizate
3. Modulul de vreme face o cerere catre API-ul serviciului meteorologic
4. Datele primite sunt procesate și transformate în format intern
5. Backend actualizează modelul de date cu noile informații meteo
6. Frontend primește actualizarea prin polling sau WebSocket și reafișează secțiunea de vreme

### Actualizare în timp real (opțional cu WebSockets)
1. Dacă se implementează WebSockets, frontend-ul deschide o conexiune la `/ws`
2. Atunci când datele se modifică în backend (task adăugat, vreme actualizată etc.)
3. Backend trimite un mesaj WebSocket tuturor clientilor conectați
4. Frontend primesc mesajul și actualizează interfața corespunzător

## Pattern-uri de design utilizate

### Arhitectură client-server (REST)
- Separarea clară a preocupărilor între frontend (prezentare) și backend (logica și date)
- Comunicarea prin intermediul API-urilor REST standardizate
- Facilită dezvoltarea独立ă a frontend-ului și backend-ului

### MVC (Model-View-Controller) adaptat pentru web
- **Model**: Baza de date SQLite și clasele de entitate (utilizator, task etc.)
- **View**: Template-urile HTML și fișierele statice servite de backend
- **Controller**: Rutele Flask/FastAPI care gestionează cererile HTTP

### Dependency Injection
- Modulele primește dependințele prin constructor sau metode de setare
- Facilită mocking în teste și schimbarea implementărilor (ex: diferite provideri de vreme)

### Observer Pattern (prin WebSockets sau polling)
- Frontend se abonează la schimbări de date prin WebSocket sau polling
- Permite actualizări automate atunci când datele de baza se schimbă

### Singleton (limitat)
- Unele servicii precum managerul de conexiune la baza de date pot folosi pattern-ul singleton
- Asigură o singură instanță pe aplicare pentru resursele care sunt costis de creat

## Securitate și izolare

### Privace date
- Toate datele personale (taskuri, comentarii) rămân stocate local pe dispozitivul serverului
- Nu se trimit date personale către servicii externe fără consimțământ explicit
- Doar coordonatele geografice necesare sunt transmise serviciului meteorologic

### Izolare module
- Fiecare modul are o interfață bine definită și comunică prin intermediul backend-ului
- Erorile într-un modul nu se propagă necontrolat în alte module
- Posibilitatea de a înlocui sau dezactiva module individuele fără a afecta restul aplicației

## Diagrama de secvență pentru adăugarea unui task prin frontend

```
Utilizator (Browser)     Backend Server     Model Date      Ollama (opțional)
        |                      |                  |               |
        |--- Click "Adaugă task" ---|               |               |
        |                      |                  |               |
        |--- POST /api/tasks {data} ------------>|               |
        |                      |                  |               |
        |                      |--- Validează date --------------->|
        |                      |                  |               |
        |                      |<--- Date valide -----------------|               |
        |                      |                  |               |
        |                      |--- Salvează task in DB --------->|
        |                      |                  |               |
        |                      |<----- Task ID -------|           |
        |                      |                  |               |
        |                      |--- Response 201 {task} --------->|
        |                      |                  |               |
        |<---------- Response 201 {task} ---------|               |
        |                      |                  |               |
        |--- Actualizează lista taskuri (JS) ---->|               |
```

## Diagramă de secvență pentru comandă vocală client-side cu AI

```
Utilizator (Browser)     Backend Server      Ollama
        |                      |                  |
        |--- Click mic ---------|                  |
        |                      |                  |
        |--- Vorbește: "Ce tarea are Maria?" --->| 
        |                      |                  |
        |                      |--- Trimite la Ollama ---------------->
        |                      |                  |
        |                      |<----- Răspuns AI -------------------
        |                      |                  |
        |                      |--- Response {text} ------------------>
        |                      |                  |
        |<---------- Response {text} -----------|                  |
        |                      |                  |
        |--- (Opțional) TTS: "Maria are să cumpere lângă" ------------|
```

## Tehnologii și cadre alternativă

### Variante pentru Frontend
- **Vanilla JavaScript**: Cea mai simplă, fără dependințe externe, bună pentru aplicații mici
- **HTMX**: Permite acces la funcționalități AJAX și WebSockets prin atribute HTML, reduce nevoia de JavaScript scris manual
- **Alpine.js**: Framework mic pentru interactivitate, similar cu Vue dar mai ușor de învățat
- **Vue.js/React**: Framework-uri mai puternice pentru aplicații complexe, dar cu o curbe de învățare mai încetă

### Variante pentru Backend
- **Flask**: Cea mai simplă și flexibilă, bună pentru prototipare și aplicații mici
- **FastAPI**: Mai rapidă, cu documentare automată OpenAPI/Swagger, susține asynchronous nativ
- **Django**: Framework complet cu admin built-in, potențial peste nevoi pentru această aplicație

### Variante pentru recunoaștere vocală
- **Web Speech API (browser)**: Implementare client-side, funcționează în Chrome, Edge, Safari (cu limite), necesită HTTPS sau localhost
- **SpeechRecognition (Python)**: Implementare server-side, necesită microfon pe server, funcționează offline cu Vosk sau online cu Google API
- **Whisper.cpp**: Model de stat-of-the-art pentru recunoaștere vocală, consum moder de resurse, funcționează offline

### Variante pentru stocare date
- **SQLite**: Alegerea implicită pentru simplicitate și zero configurare, perfect pentru Raspberry Pi
- **PostgreSQL**: Pentru aplicatii care necesită mai multă concurență sau functii avansate
- **TinyDB**: Alternativă orientată document, bună pentru seturi mici de date

## Considerații de performanță

### Threading și concurență
- Operatiile de rețea (vreme, Ollama) rulează în fire separate sau folosind asynchronous (în FastAPI) pentru a nu bloca cererile HTTP
- Actualizările frontend se fac prin JavaScript asincron pentru a nu bloca interfața utilizatorului

### Management memorie
- Cache limitat pentru predicțiile meteo (maxim 1-2 ore)
- Istoricul conversațiilor cu AI limitat la ultimele N interacții pentru a preveni consumul excesiv de memorie
- Elaborare periodică a taskurilor vechi (de exemplu, taskurile mai vechi de 30 de zile sunt arhivate sau șterse)

### Optimizare frontend
- Minimizarea fișierelor CSS și JS prin instrumente precum PurgeCSS și Terser
- Încărcare lângășă a componentelor rarement folosite (cod splitting)
- Folosire de tehnici de lazy loading pentru imagini și resurse neessențiale
- Actualizări parțiale ale interfeței prin manipulare DOM în loc de reîncărcare completă

### Optimizare backend
- Paginare pentru listele lungi de taskuri
- Indexare corespunzătoare în baza de date pentru interogări rapide
- Compresie HTTP pentru răspunsuri
- Cache de răspunsuri frecvente (ex: prognoza meteo) pentru a reducere numărul de cereri API externe