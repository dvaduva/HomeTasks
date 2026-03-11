# HomeTasks - Aplicație de management al taskurilor familiei

HomeTasks este o aplicatie web proiectata pentru a rula pe un Raspberry Pi, accesibil prin browser pe localhost și dispozitivele din aceeași rețea. Aplicatia ajuta familiile să organizeze și să urmărească taskurile zilnice, să afișeze informații despre vreme și să permită interacțiunea cu un model AI prin comenzi vocale în română și engleză.

## Caracteristici principale

- Afișare taskuri pentru membrii familiei pentru ziua curente și pentru următoarele 7 zile
- Afișare stare vreme în timp real
- Adăugare taskuri pentru diversi utilizatori
- Adăugare comentarii, posibilitatea de inchidere a taskului și refuzarea acestuia
- Integrare cu model AI de pe un server Ollama
- Discutie cu modelul AI prin recunoastere vocală (limba română și engleză)
- Interfață web responsiva, accesibilă de pe orice browser (incluzând pe Raspberry Pi)
- Suport pentru taskuri repetitive (zile fixe din săptămână, zile fixe din lună)

## Tehnologii utilizate

- **Limbaj de programare**: Python
- **Framework web**: Flask (sau FastAPI)
- **Platformă hardware**: Raspberry Pi (orice dispozitiv capabil să ruleze Python)
- **Baza de date**: SQLite pentru stocarea taskurilor și utilizatorilor
- **Integrare AI**: Ollama server pentru modelele de limbaj mare
- **Recunoaștere vocală**: SpeechRecognition bibliotecă cu suport pentru limba română și engleză (folosit prin API-ul browserului sau prin Python pe server)
- **Serviciu meteorologic**: OpenWeatherMap API sau similar
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla sau cu un framework mic precum HTMX pentru simplicitate)

## Structura proiectului

```
HomeTasks/
├── docs/                # Documentație proiect
├── src/                 # Sursă aplicație
│   ├── main.py          # punct de intrare (Flask app)
│   ├── requirements.txt # dependente Python
│   ├── task_manager/    # gestionare taskuri (modele, logique de business)
│   │   ├── models.py
│   │   └── repository.py
│   ├── weather/         # integrare serviciu meteorologic
│   │   └── service.py
│   ├── ollama/          # comunicare cu serverul Ollama
│   │   └── client.py
│   ├── voice/           # modul recunoaștere vocală (opțional, pentru server-side speech-to-text)
│   │   └── processor.py
│   └── static/          # fișiere statice (CSS, JS, imagini)
│       ├── css/
│       ├── js/
│       └── images/
├── templates/           # template-uri HTML (Folosit de Flask)
│   ├── base.html
│   ├── index.html
│   ├── task.html
│   └── weather.html
├── data/                # director pentru baza de date SQLite și alte fișiere de date
│   └── hometasks.db
├── tests/               # teste unitare și de integrare
└── README.md            # acest fișier
```

## început rapid

1. Asigurați-vă că aveți un Raspberry Pi cu sistem de operare instalat (Raspberry OS recomandat) sau orice alt calculator cu Python
2. Instala dependentele necesare: `pip install -r src/requirements.txt`
3. Configura serverul Ollama local și descărca un model potrivit (ex: llama3)
4. Obține o cheie API pentru serviciul meteorologic ales
5. Rulează aplicația: `python src/main.py`
6. Deschide browserul și navighează la: `http://localhost:5000` (sau adresa IP a Raspberry Pi-ului pentru a accesa de pe alte dispozitive: `http://<raspberry-pi-ip>:5000`)

## Contribuire

Contribuțiile sunt binevenite! Vă rugăm să deschideți un issue pentru discutarea modificărilor majore înainte de a face un pull request.

## Licență

Acest proiect este licențiat sub licența MIT - vezi fișierul [LICENSE](LICENSE) pentru detalii.