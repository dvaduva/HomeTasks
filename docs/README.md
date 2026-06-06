# HomeTasks - Family task management application

> **English** · [Română](README.ro.md)

HomeTasks is a web application designed to run on a Raspberry Pi, accessible through a browser on localhost and on devices on the same network. The application helps families organize and track daily tasks, display weather information, and interact with an AI model through voice commands in Romanian and English.

## Key features

- Display tasks for family members for the current day and the next 7 days
- Real-time weather display
- Add tasks for various users
- Add comments, ability to close a task and refuse it
- Integration with an AI model on an Ollama server
- Conversation with the AI model through voice recognition (Romanian and English)
- Responsive web interface, accessible from any browser (including on the Raspberry Pi)
- Support for recurring tasks (fixed weekdays, fixed days of the month)

## Technologies used

- **Programming language**: Python
- **Web framework**: Flask
- **Hardware platform**: Raspberry Pi (any device capable of running Python)
- **Database**: SQLite for storing tasks and users
- **AI integration**: Ollama server for large language models
- **Voice recognition**: SpeechRecognition library with support for Romanian and English (used through the browser API or through Python on the server)
- **Weather service**: OpenWeatherMap API or similar
- **Frontend**: Vue 3 + Vite + Pinia + Vue Router SPA (see [SPA_MIGRATION.md](SPA_MIGRATION.md))

## Project structure

```
HomeTasks/
├── docs/                # Project documentation
├── frontend/            # Vue 3 + Vite SPA (built into frontend/dist/)
├── src/                 # Application source (backend)
│   ├── main.py          # entry point (Flask app: REST API + SPA serving)
│   ├── task_manager/    # task management (models, business logic)
│   │   ├── models.py
│   │   ├── database.py
│   │   └── repository.py
│   ├── weather/         # weather service integration
│   │   └── service.py
│   ├── ollama/          # communication with the Ollama server
│   │   └── client.py
│   ├── voice/           # voice recognition module (optional, server-side STT)
│   │   └── service.py
│   ├── tuya/            # Tuya IoT integration (temperature sensors)
│   │   └── service.py
│   └── cast/            # Google Cast control (radio casting)
│       └── service.py
├── data/                # SQLite database and other data files
│   └── hometasks.db
├── tests/               # unit and integration tests
└── README.md            # this file
```

## Quick start

1. Make sure you have a Raspberry Pi with an operating system installed (Raspberry Pi OS recommended) or any other computer with Python
2. Install the required dependencies: `pip install -r requirements.txt`
3. Set up the local Ollama server and download a suitable model (e.g. llama3)
4. Get an API key for the chosen weather service
5. Build the SPA frontend: `cd frontend && npm install && npm run build`
6. Run the application: `python src/main.py`
7. Open the browser and navigate to: `http://localhost:5000` (or the Raspberry Pi's IP address to access from other devices: `http://<raspberry-pi-ip>:5000`)

## Contributing

Contributions are welcome! Please open an issue to discuss major changes before submitting a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
