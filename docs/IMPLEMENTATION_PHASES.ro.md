# Fazele de implementare - HomeTasks

Această pagină descrie fazele recomandate pentru implementarea aplicației HomeTasks, organizate în ordine logică pentru a asigura un flux de dezvoltare eficient și testabil.

## Fază 1: Pregătirea mediului și structura de bază

**Obiectiv**: Crearea structurii de directoare și configurarea mediului de dezvoltare

### Activități:
- Crearea structurii de directoare proiectului conform specificațiilor din README.md
- Setarea mediului virtual Python (`venv`)
- Crearea fișierului `.env.example` cu variabilele necesare
- Crearea fișierului `requirements.txt` cu dependințele de bază
- Inițializarea depozitului Git (opțional)
- Verificarea că mediul funcționează cu un script "Hello World" simplu

**Livrabile**:
- Directorul proiectului cu structura corectă
- Mediu virtual activat și funcțional
- Fișiere de configurare de bază (`.env.example`, `requirements.txt`)

## Fază 2: Baza de date și modelele de date

**Obiectiv**: Implementarea stocării persistentă pentru taskuri, utilizatori și comentarii

### Activități:
- Proiectarea schemei bazei de date SQLite
- Crearea modelelor SQLAlchemy pentru:
  - Utilizator (nume, culoare, preferințe etc.)
  - Task (descriere, dată, utilizator asignat, statut, repetitivitate etc.)
  - Comentariu (text, timestamp, legătură cu taskul)
  - Preferințe aplicație (limbă, unități de temperatură etc.)
- Implementarea funcțiilor de bază CRUD (Create, Read, Update, Delete) pentru fiecare model
- Crearea migrărilor de bază de date (opțional, pentru evolutia schemei)
- Scrierea de teste unitare simple pentru modele

**Livrabile**:
- Fișierele modelelor în `src/task_manager/`
- Funcțiile de acces la date funcționale
- Baza de date SQLite inițializată cu tabele corecte

## Fază 3: API-ul backend - Taskuri și utilizatori

**Obiectiv**: Crearea endpoint-urilor REST pentru gestionarea taskurilor și utilizatorilor

### Activități:
- Implementarea endpoint-urilor în `src/main.py` (sou controlere separate dacă proiectul crește):
  - GET `/api/tasks` - Lista taskurilor cu filtrare (zi, utilizator etc.)
  - POST `/api/tasks` - Creare nou task
  - GET `/api/tasks/<id>` - Obținerea unui task specific
  - PUT `/api/tasks/<id>` - Actualizare task existent
  - DELETE `/api/tasks/<id>` - Ștergere task
  - GET `/api/users` - Lista utilizatorilor
  - POST `/api/users` - Creare utilizator nou
- Implementarea validării datelor de intrare
- Gestionarea erorilor cu coduri HTTP corespunzătoare (400, 404, 500 etc.)
- Scrierea de teste de integrare pentru endpoint-uri

**Livrabile**:
- API-ul funcțional care poate fi testat cu instrumente precum `curl` sau Postman
- Documentație de bază a endpoint-urilor (opțional)

## Fază 4: Integrarea cu serviciul meteorologic

**Obiectiv**: Adăugarea funcționalității de afișare a vremii

### Activități:
- Crearea modulului `src/weather/service.py`
- Implementarea funcției pentru obținerea vremii curente și prognozei de la OpenWeatherMap API
- Adăugarea gestionării cheilor API prin variabile de mediu
- Implementarea cache-ingului temporar pentru a reduce numărul de cereri API
- Crearea endpoint-ului `/api/weather` pentru a returna datele meteorologice
- Gestionarea erorilor de conectare și limitări de rate
- Adăugarea câmpurilor relevante în modelul de preferințe (oraș, unități de temperatură)

**Livrabile**:
- Endpoint-ul `/api/weather` care returnă date meteorologice valide
- Capacitatea de a specifica orașul și unitățile prin variabile de mediu

## Fază 5: Integrarea cu Ollama (AI)

**Obiectiv**: Adăugarea funcționalității de interacțiune cu modelul de AI

### Activități:
- Crearea modulului `src/ollama/client.py`
- Implementarea funcțiilor pentru comunicarea cu serverul Ollama:
  - Generare text simplu (`/api/generate`)
  - Conversație structurată cu menținere de context (`/api/chat`)
- Implementarea strategiei de gestionare a contextului (limitat la ultimele N mesaje)
- Adăugarea gestionării erorilor (timeout, model negăsit etc.)
- Mecanisme de retry pentru erori temporare
- Crearea endpoint-ului `/api/ai/chat` pentru interacțiunea cu utilizatorul
- Adăugarea suportului pentru limba română și engleză prin detectare și traducere (dacă este necesar)

**Livrabile**:
- Endpoint-ul `/api/ai/chat` care poate primi mesaje și returna răspunsuri de la Ollama
- Capacitatea de menținere a contextei scurte în conversații

## Fază 6: Frontend de bază și layout

**Obiectiv**: Crearea interfeței de utilizator de bază

### Activități:
- Crearea template-ului de bază `templates/base.html` cu structura comună
- Implementarea stilurilor CSS de bază în `static/css/`
- Crearea paginii principale `templates/index.html` cu:
  - Header (dată, vreme, buton de setări)
  - Sidebar (lista de utilizatori)
  - Zona principală (pentru afișarea taskurilor)
  - Footer (butoane de acțiune, indicator vocal)
- Implementarea layout-ului responsiv cu CSS Flexbox/Grid
- Adăugarea fișierelor JavaScript de bază în `static/js/`

**Livrabile**:
- Interfață de utilizator vizualizabilă în browser la `http://localhost:5000`
- Layout de bază care se adaptează la diferite dimensiuni de ecran

## Fază 7: Interfața de gestionare a taskurilor

**Obiectiv**: Implementarea funcționalităților complete de management al taskurilor

### Activități:
- Implementarea JavaScript pentru:
  - Afișarea listelor de taskuri primite de la API
  - Adăugarea de noi taskuri prin formulare
  - Editarea taskurilor existente
  - Marcare ca terminat/refuzare
  - Adăugarea de comentarii la taskuri
- Crearea componentelor UI pentru:
  - Formularul de adăugare/editare task
  - Afișarea detaliilor unui task
  - Lista de comentarii
- Implementarea filtrării taskurilor după zi și utilizator
- Adăugarea indicatoarelor de stare (încărcare, erori etc.)
- Implementarea navigării între zile (săgeți ← →)

**Livrabile**:
- Interfață complet funcțională pentru gestionarea taskurilor
- Capacitatea de adăuga, edita, șterge și marca taskuri
- Interfața de comentarii funcțională

## Fază 8: Interfața vocală (client-side)

**Obiectiv**: Adăugarea funcționalității de comandă vocală prin browser

### Activități:
- Implementarea Web Speech API în JavaScript pentru:
  - Recunoașterea vorbirii în limba română și engleză
  - Activarea prin buton sau wakeword ("Hey HomeTasks")
  - Conversia vorbirii în text
- Adăugarea indicatorului vizual de stată microfonului (activ/inactiv)
- Implementarea trimiterii comenzilor vocale spre backend prin endpoint-ul `/api/voice-command`
- Crearea logicii de prelucrare a comenzilor vocale în backend:
  - Detectarea dacă este comandă de sistem sau interogare pentru AI
  - Routing către funcții corespunzătoare (adăugare task, interogare AI etc.)
- Implementarea text-to-speech opțional pentru răspunsuri (folosind Web Speech API)
- Adăugarea setărilor pentru sensibilitàa microfonului și limba de recunoaștere

**Livrabile**:
- Butonul de activare vocală funcțional în footer
- Capacitatea de adăuga taskuri prin comenzi vocale
- Capacitatea de pune întrebări AI prin voce

## Fază 9: Interfața de chat cu AI

**Obiectiv**: Implementarea interfeței de conversație cu modelul de AI

### Activități:
- Crearea componentei UI pentru chat:
  - Fereastra de mesaje
  - Câmpul de introducere text
  - Butonul de trimitere
- Implementarea logicii JavaScript pentru:
  - Trimiterea mesajelor la endpoint-ul `/api/ai/chat`
  - Afișarea răspunsurilor în fereastra de chat
  - Menținerea istoricului conversației în sesiunea curentă
- Adăugarea indicatorului de "scriere..." în timp ce se așteaptă răspunsul de la AI
- Implementarea scrollării automate la mesajele noi
- Adăugarea opțiunii de ștergere istoric conversație
- Optimizarea prompt-urilor pentru răspunsuri relevante și scurte

**Livrabile**:
- Fereastra de chat funcțională care poate comunica cu Ollama
- Capacitatea de pune întrebări despre taskuri, vreme etc. și să primiți răspunsuri utile

## Fază 10: Setări și personalizare

**Obiectiv**: Permiterea utilizatorilor să configureze aplicația conform preferințelor lor

### Activități:
- Crearea paginii de setări accesibile prin iconița de setări
- Implementarea setărilor pentru:
  - Preferințe generale (limbă aplicației, format dată etc.)
  - Management utilizatori (adăugare/editară/ștergere utilizatori)
  - Configurare meteorologie (oraș, unități de temperatură, frecvență de actualizare)
  - Setări AI/Ollama (adresa serverului, modelul, temperatura etc.)
  - Setări vocale (limbă de activare, sensibilitate microfonului, TTS)
- Salvarea setărilor în baza de date în tabela de preferințe
- Încărcarea setărilor la pornirea aplicației
- Implementarea validării și feedback-ului vizual pentru modificările de setări

**Livrabile**:
- Pagina de setări complet funcțională
- Capacitatea de personaliza aplicația și de a păstra configurările între sesiuni

## Fază 11: Testare, optimizare și pregătire pentru deploy

**Obiectiv**: Asigurarea calității, performantei și pregătirea pentru mediul de producere

### Activități:
- Testarea aplicației pe diferite browsere (Chrome, Firefox, Safari) și dispozitive (desktop, tablet, mobil)
- Testarea funcționalității vocale în diferite condiții de lumină și zgomot
- Optimizarea performantei:
  - Minimizarea fișierelor CSS și JS
  - Implementarea cache-ingului pentru predicțiile meteo
  - Optimizarea interogărilor de bază de date
  - Reducerea numărului de cereri API inutile
- Implementarea gestionării erorilor îmbunătățită
- Adăugarea mesajelor de loading și feedback vizual
- Pregătirea pentru deploy:
  - Crearea fișierului `.env` de exemplu pentru producere
  - Documentarea pasilor pentru configurarea Gunicorn sau Alt server WSGI
  - Scrierea instrucțiunilor pentru configurarea ca serviciu systemd
- Scrierea de teste de integrare pentru fluxuri critice

**Livrabile**:
- Aplicație stabilă și performantă
- Documentație de deploy completă
- Toate funcționalitățile testate și funcționând corect

## Cadran de timp sugerat

Faza | Durată estimată | Observații
-----|----------------|------------
1    | 1-2 zile       | Pregătire esențială
2    | 2-3 zile       | Baza de date este fundamentala
3    | 2-3 zile       | API-ul permite dezvoltarea paralelă a frontend-ului
4    | 1-2 zile       | Depinde de API-ul extern
5    | 1-2 zile       | Depinde de serverul Ollama local
6    | 2-3 zile       | Frontend de bază necesar pentru continuare
7    | 3-5 zile       | Fază substantive - core aplicației
8    | 2-3 zile       | Implementare client-side relatively simplă
9    | 2-3 zile       | Integrare cu AI deja construită în faza 5
10   | 1-2 zile       | Setări importante pentru experiența utilizatorului
11   | 2-3 zile       | Asigură calitatea și pregătește pentru producere

**Total estimat**: 19-28 de zile lucratoare pentru o versiune MVP (Minimum Viable Product)

## Sfaturi pentru implementare

1. **Implementă incremental**: Livrezi fiecare fază complet înainte de a trece la următoarea
2. **Testă continuu**: Verifică funcționalitatea la finalul fiecărei faze
3. **Refactorizează când e necesar**: Nu ezita să îmbunătățești codul după ce ai o funcționalitate de bază
4. **Pastrează documentația actualizată**: Actualizează fișierele README și alte docs pe măsură ce progresezi
5. **Folosește ramificații git**: Lucra pe ramificații dedicated pentru fiecare fază majoră
6. **Solicită feedback**: Arată fazele completate unor utilizatori pentru feedback timpurie

Această planificare oferă un drum clar spre o aplicație complet funcțională, flexibilă și ușor de întreținut. Poți adapta ritmul și ordinea fuzelor în funcție de resursele disponibile și prioritățile specifice echipei tale.