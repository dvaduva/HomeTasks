# Ghid de utilizare - HomeTasks (Web)

> [English](USAGE.md) · **Română**

## Deschiderea și navigarea de bază

### Pornierea aplicației
1. Asigurați-vă că serverul Ollama rulează în fond (`ollama serve`)
2. Navigați în directorul aplicației: `cd HomeTasks/src`
3. Rulează aplicația: `python main.py`
4. Deschide browserul și navighează la: `http://localhost:5000`
   - Pentru acces de pe alte dispozitive în rețea locală: `http://<raspberry-pi-ip>:5000`
   - Exemplu: `http://192.168.1.100:5000`

### Structura paginii principale
Pagina este împărțită în principali secțiuni:
- **Header (zona de sus)**: Data curentă, informații meteorologice și buton de setări
- **Sidebar (zona stânga)**: Lista de utilizatori familiari (fiecare cu culoare distinctă)
- **Main content (zona centrală)**: Lista de taskuri pentru ziua selectată
- **Footer (zona de jos)**: Butoane de acțiune rapide și indicator de comandă vocală

## Vizualizarea taskurilor

### Selectarea zilei
- Pentru a vedea taskurile pentru o zi specifică, faceți clic pe data din header
- Folosiți săgețile ← → pentru a naviga între zilele precedente și următoare
- Aplicația afișează automat taskurile pentru ziua curentă și cele 7 zile următoare la pornire

### Vizualizarea taskurilor per utilizator
- Faceți clic pe numele unui utilizator din sidebar pentru a vedea doar taskurile sale
- Pentru a vedea taskurile tuturor utilizatorilor, faceți clic pe "Toți" sau pe spațiul liber din sidebar
- Taskurile sunt colorate în funcție de utilizatorul asignat (aceeași culoare ca în lista de utilizatori)

### Detalii task
- Pasați cu mouse-ul peste un task sau faceți tap pe el (pe dispozitive tactile) pentru a vedea detalii suplimentare:
  - Descrierea completă
  - Data și ora programată
  - Utilizatorul asignat
  - Comentarii atasate
  - Butoane de acțiune (Închidere, Refuzare, Editare)

## Adăugarea taskurilor

### Prin interfața web
1. Faceți clic pe butonul "+" din footer sau pe iconița "+" lângă data din header
2. Selectați utilizatorul căruia îi atribuiți taskul (opțional - lasați gol pentru a atribui mai multor utilizatori)
3. Introduceți descrierea taskului în câmpul de text
4. Selectați data și ora (opțional - implicit este azi)
5. Faceți clic pe "Salvează" pentru a confirma

### Prin comandă vocală (browser)
1. Asigurați-vă că sunteți pe `localhost` sau pe o conexiune HTTPS (necesar pentru Web Speech API din motive de securitate)
2. Faceți clic pe iconița microfonului din footer
3. După ce auziti bip-ul de confirmare, spuneți cererea dvs.:
   - În română: "Adaugă un task pentru [nume]: [descriere] pe [data] la [ora]"
   - În engleză: "Add a task for [name]: [description] on [date] at [time]"
4. Exemple:
   - "Adaugă un task pentru Maria: Cumpără lângă și pâine mâine la 10:00"
   - "Add a task for John: Fix the leaky faucet tomorrow at 2pm"
5. Sistemul va confirma taskul adăugat prin mesaj vizual (toast notification)
6. Opțional: Dacă este activat, veți auzi și un mesaj vocal de confirmare prin sintetizarea vorbirii browserului

## Adăugarea comentariilor la taskuri

### Prin interfața web
1. Pasați cu mouse-ul peste taskul la care vreţi să adăugaţi un comentariu sau faceți tap pe el (pe dispozitive tactile)
2. Selectaţi opţiunea "Adaugă comentariu"
3. Introduceţi textul comentariului în câmpul care apare
4. Faceţi tap pe "Trimite" pentru a salva comentariul

### Prin comandă vocală
1. Activează modulul vocal prin iconița microfonului din footer
2. Spuneţi: "Adaugă un comentariu la taskul [descriere scă/task ID]: [textul comentariului]"
3. Exemplu: "Adaugă un comentariu la taskul Cumpără lângă: Am gasit lângă la magazinul de la colț"
4. Sistemul va căuta taskul potrivit și va atașa comentariul
5. Veți primi o notificare de succes

## Modificarea statusului taskurilor

### Închidere task
1. Pasați cu mouse-ul peste taskul completat sau faceți tap pe el
2. Selectaţi opţiunea " Marchează ca terminat"
3. Taskul va apărea cu o linie prin intermediul textului și va fi mutat în secțiunea "Taskuri terminate" (dacă este activată)

### Refuzare task
1. Pasați cu mouse-ul peste taskul pe care îl refuzţi sau faceți tap pe el
2. Selectaţi opţiunea " Refuzează taskul"
3. Introduceţi un motiv de refuz (opțional dar recomandat)
4. Taskul va fi marcat ca refuzat și va apărea gri

### Re deschidere task
1. Accesaţi sectiunea "Taskuri terminate/refuzate" prin butonul corespunzător din footer
2. Faceţi pe lung pe taskul pe care vreţi să-l re deschideţi
3. Selectaţi "Re deschidere task"
4. Taskul va reveni în lista activă cu statusul anterior

## Interacțiunea cu modelul AI

### Prin interfața web
1. Faceţi clic pe iconița robotului din footer
2. Introduceţi întrebarea dvs. în câmpul de text care apare
3. Faceţi clic pe "Trimite" pentru a primi răspunsul de la AI
4. Răspunsul va apărea în fereastra de conversație

### Prin comandă vocală
1. Activează modulul vocal prin iconița microfonului din footer
2. Puneţi întrebarea dvs. direct (fără a specifica că este pentru AI - sistemul va detecta automat):
   - "Ce vreme va fi mâine?"
   - "Sugerează-mi o rețea pentru cină cu ingredientele din frigider"
   - "Ce taskuri are Maria pentru săptămâna viitoare?"
3. Sistemul va trimite întrebarea către modelul Ollama și va returna răspunsul
4. Răspunsul va fi afișat vizual în fereastra de conversație
5. Opțional: Dacă este activat, veți auzi și un mesaj vocal cu răspunsul prin sintetizarea vorbirii browserului

## Personalizarea aplicației

### Accesarea setărilor
1. Faceţi clic pe iconița de setări (rulă dinţi) din colţul dreapta sus al headerului
2. Meniul de setări conţine:
   - Preferinţe generale
   - Setări utilizatori
   - Configurare meteorologie
   - Setări AI/Ollama
   - Setări vocale
   - Informații despre aplicație

### Management utilizatori
1. În meniul Setări → Utilizatori
2. Pentru a adăuga un utilizator nou:
   - Faceţi clic pe "+ Adaugă utilizator"
   - Introduceţi numele și selectaţi o culoare
   - (Opțional) Adăugaţi o fotografie sau avatar
3. Pentru a modifica un utilizator existent:
   - Faceţi clic pe numele utilizatorului
   - Modificaţi datele dorite
4. Pentru a şterge un utilizator:
   - Faceţi pe lung pe numele utilizatorului (pe desktop) sau Faceți o lungă apăsare (pe mobil) și selectaţi "Șterge"

### Setări meteorologie
1. În meniul Setări → Meteorologie
2. Introduceţi:
   - Orașul pentru care doriţi prognoza (implicit detectat prin IP sau GPS pe dispozitive mobile)
   - Unitatea de temperatură (°C sau °F)
   - Frecvenţa de actualizare (15, 30, 60 minute)
   - Cheia API pentru serviciul meteorologic ales (OpenWeatherMap, etc.)

### Setări AI/Ollama
1. În meniul Setări → AI/Ollama
2. Configureazăţi:
   - Adresa serverului Ollama (implicit: http://localhost:11434)
   - Modelul de utilizat (llama3:8b, phi3:medium, etc.)
   - Temperatura modelului (0.0-1.0, unde 0.0 este mai deterministic)
   - Lungimea maxima a răspunsului (în tokeni)
   - Timeout-ul pentru cereri (în secunde)

### Setări vocale
1. În meniul Setări → Vocale
2. Configureazăţi:
   - Limba de activare (română/engleză/ambele) - pentru indicarea limbei preferate
   - Sensibilitatea microfonului (doar pentru implementări server-side opționale)
   - Limba pentru recunoaştere vocală (ro-RO, en-US, en-GB) - indicare pentru browser
   - Activare/dezactivare sinteteza vorbirii pentru răspunsurile AI și notificări
   - Volumul de ieșire audio (doar pentru sintetizarea vorbirii)

## Soluționarea problemelor comune

### Aplicația nu pornește
- Verificaţi că Python 3.9+ este instalat: `python --version`
- Asiguraţi-vă că toate dependenţele sunt instalate: `pip install -r src/requirements.txt`
- Verificaţi că serverul Ollama rulează: `curl http://localhost:11434/api/version`

### Nu functionează comanda vocală în browser
- Asiguraţi-vă că sunteți pe `http://localhost:5000` sau pe o conexiune HTTPS (Web Speech API necesită acest lucru din motive de securitate)
- Verificaţi setările de confidențialitate ale browserului pentru a permite accesul la microfon
- Testaţi microfonul cu o aplicaţie web de testare a microfonului (ex: https://mictester.com/)
- În setări vocale, verificăţi că aţi selectat limba corectă pentru recunoaştere
- Asiguraţi-vă că nu există aplicaţii blocațitoare care folosesc microfonul

### Nu puteti accesa informaţiile meteo
- Verificaţi conexiunea la internet
- Asiguraţi-vă că cheia API este corectă și activă
- Verificaţi limita zilna de cereri pentru serviciul meteorologic ales
- În setări meteorologie, selectaţi un alt serviciu sau reîncărcaţi cheia API

### Modelul AI nu răspunde sau e lent
- Asiguraţi-vă că serverul Ollama rulează: `ollama list`
- Verificaţi că modelul selectat este descărcat: `ollama show llama3:8b`
- Dacă utilizati un model mare, asiguraţi-vă că aveţi suficientă RAM liberă
- Reduceţi temperatura modelului pentru răspunsuri mai rapide și deterministe

### Taskurile nu se salvează
- Verificaţi permisiunile de scriere în directorul aplicației
- Asiguraţi-vă că spaţiul de stocare pe disc nu este epuizat
- Verificaţi că baza de date SQLite nu este coruptă (fișierul `data/hometask.db`)

## Sfaturi pentru utilizare eficientă

### Organizaţia taskurilor
- Folosiţi prefixe clare în descrieri: [COMPRĂ], [REPARĂ], [TELEFONEAZĂ], etc.
- Atribuiţi ore specifice taskurilor pentru a evita conflictele de programare
- Revizuiţi taskurile la începutul fiecărei săptămâni și actualizaţi priorităţile

### Utilizarea comenilor vocale
- Vorbite clar și la un ritm moderat pentru cele mai bune rezultate de recunoaştere
- În medii zgomotioase, încercaţi să réduiti zgomotul de fundal sau să apropiţi microfonul de gură
- Folosiţi fraze de activare consistente pentru a reduce probabilitatea de activări accidente
- Dacă utilizaţi comenii vocale frecvente, folosiţi microfonul extern pentru mai bună calitate

### Întreținerea sistemului
- Ruleazăţi o verificare lunară a spaţiului de stocare disponibil
- Actualizeazăţi regulat modelul Ollama pentru a beneficia de îmbunătățiri
- Curăţiţi periodică memoria cache a aplicației prin opţiunea din setări
- Faceţi copias de siguranţă a fişierului de bază de date lunară

## Accesarea ajutorului și suportului

### Documentaţie internă
- Accesaţi secţiunea "Ajutor" din meniul de setări pentru ghiduri rapide
- Vizualizaţi videoclipurile tutorial integrate prin linkuri în meniul Ajutor

### Resurse online
- Wiki proiect: https://github.com/utilizator/HomeTasks/wiki
- Forum de discuţii: https://community.hometask.app
- Raportare probleme: https://github.com/utilizator/HomeTasks/issues

### Contact
- Pentru probleme critice: suport@hometask.app
- Pentru întrebări generale: info@hometask.app