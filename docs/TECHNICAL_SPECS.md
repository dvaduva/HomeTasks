# Technical specifications - HomeTasks

> **English** · [Română](TECHNICAL_SPECS.ro.md)

## Minimum hardware requirements

### Raspberry Pi (or any other device)
- Recommended model: Raspberry Pi 4 Model B with 4GB RAM or more
- Acceptable alternative: Raspberry Pi 3 Model B+ (reduced performance)
- Any modern computer/device capable of running Python 3.9+
- Minimum storage space: 16GB (32GB+ recommended for updates and logs)

### For access on local devices (optional)
- Capacitive touchscreen (for the local Raspberry Pi)
- Minimum resolution: 800x480 px (WVGA)
- Recommended resolution: 1024x600 px or 1280x720 px
- Physical size: 7-10 inch diagonal
- Interface: HDMI or DSI (depending on the Raspberry Pi model)

### Other hardware components (for local voice recognition)
- External microphone with noise reduction (for good voice recognition on the local device)
- Protective case for the Raspberry Pi (optional but recommended)
- Stable power supply, 5V/3A minimum (for the Raspberry Pi)

## Software dependencies

### Operating system
- Any operating system capable of running Python 3.9+ (Linux, Windows, macOS)
- Raspberry Pi OS (formerly Raspbian) 64-bit version 2023-05 or newer (recommended for Raspberry Pi)
- Ubuntu Server for Raspberry Pi 64-bit (alternative)
- Other Linux distributions compatible with ARM v8

### Programming language and runtime

**Backend:**
- Python 3.9 or newer
- Pip 21.0 or newer
- Virtual environment recommended (venv/virtualenv)

**SPA Frontend:**
- Node.js 18+ and npm (build-time only — `npm run build` produces
  `frontend/dist/`; Python does not depend on Node at runtime)
- TypeScript 5.5+ (managed by `frontend/package.json`)

### Required Python libraries

#### Web framework
```bash
pip install flask
```

#### Task and data management
```bash
pip install sqlalchemy  # ORM for databases
pip install python-dateutil
```

#### Weather service integration
```bash
pip install requests
```

#### Ollama integration
```bash
pip install requests  # for HTTP requests to the Ollama API
```

#### Voice recognition (optional - server-side)
```bash
pip install SpeechRecognition
pip install pyaudio   # for microphone access (only on the server if STT is done server-side)
# On the operating system it may be necessary:
# sudo apt-get install portaudio19-dev python3-pyaudio
```

#### Other utilities
```bash
pip install python-dotenv  # for managing environment variables
pip install loguru         # for advanced logging (optional)
```

## Network configuration

### Internet connection
- Wi-Fi 802.11ac or Gigabit Ethernet (for updates and access to external services)
- Recommended minimum bandwidth: 5 Mbps download for weather services and communication with Ollama

### Access to the Ollama server
- The Ollama server must run on the same Raspberry Pi device or on another device on the same local network
- The default Ollama port: 11434
- Make sure the firewall allows traffic on this port (if active)

### Weather service
- Requires internet access to query the chosen weather service's API (e.g. OpenWeatherMap, WeatherAPI, etc.)
- Recommended update frequency: every 30-60 minutes to avoid rate limits

### Accessing the application
- The application runs on port 5000 (Flask default) on the host device
- For local access on the Raspberry Pi: `http://localhost:5000`
- For access from other devices on the network: `http://<raspberry-pi-ip>:5000`
- For access from the internet (requires port forwarding configuration and additional security)

## Voice recognition specifications

### Implementation options
1. **Client-side voice recognition** (recommended):
   - Uses the browser's SpeechRecognition API (Web Speech API)
   - Requires no additional dependencies on the server
   - Native support for Romanian and English in modern browsers
   - Works only over HTTPS or localhost (for security)

2. **Server-side voice recognition** (optional):
   - Uses the Python SpeechRecognition library on the server
   - Requires a microphone connected to the server device
   - More latency but can also work on browsers without Web Speech API support

### Recognition settings (client-side)
- Supported languages: Romanian (ro-RO) and English (en-US and en-GB) - through the browser
- Wait time for a voice command: 3-5 seconds of silence after speech ends
- Activation word (wakeword): implemented in client-side JavaScript

### Voice recognition libraries (only for optional server-side)
- **SpeechRecognition** with recognition engines:
  - Google Speech Recognition (requires an internet connection)
  - Vosk (works offline, models available for Romanian and English)
  - CMU Sphinx (works offline, lower accuracy)

## Ollama configuration

### Recommended models
- For natural language understanding and response generation:
  - llama3:8b (good balance between performance and quality)
  - phi3:medium (good for limited resources)
  - mistral:7b (good general quality)
- For specializing in simple tasks:
  - tinyllama:1.1b (very fast, but with limited capabilities)

### Downloading and running a model
```bash
# Install Ollama on the Raspberry Pi or on any other Linux
curl -fsSL https://ollama.com/install.sh | sh

# Download a suitable model
ollama pull llama3:8b

# Start the server (default on port 11434)
ollama serve
```

### Resource requirements for models
- llama3:8b: ~4-5GB RAM required while running
- phi3:medium: ~2-3GB RAM required
- tinyllama:1.1b: ~1-1.5GB RAM required

## Safety and privacy

### Local data storage
- Tasks and comments are stored locally in the SQLite database
- No personal data is sent to external services without explicit consent

### Communication with external services
- Only the necessary data is transmitted to the weather service (geographic coordinates)
- Interaction with Ollama happens only on the local network (if the server runs locally)
- All API keys and authentication tokens are stored in environment variables or .env files (not visible in version control)

### Web application security
- Using environment variables for secret keys is recommended
- For production, using a WSGI server such as Gunicorn instead of the Flask development server is recommended
- Implement CSRF protection and input validation
- Serve over HTTPS on public networks (using nginx as a reverse proxy with an SSL certificate)

### Security updates
- Regularly updating the operating system and dependencies is recommended
- Monitor logs for suspicious activity

## Performance and optimization

### Resource usage
- Target RAM usage: under 1GB for basic functionality (plus the memory needed for the Ollama model)
- Target CPU usage: under 30% at idle to leave room for AI processing
- Target startup time: under 10 seconds from boot to a usable interface

### Specific optimizations
- SPA with per-route code-splitting (Vite dynamic `import()`) — initial bundle
  ~88 KB gzip
- Precompressed `.br`/`.gz` assets served based on `Accept-Encoding`
- Caching of weather predictions to reduce the number of API requests
- Centralized polling for persistent widgets (Tuya, radio now-playing)
- Use of separate threads for blocking operations (network, I/O)

## Compatibility and portability

### Hardware compatibility
- The code should work on any device capable of running Python 3.9+
- Perfect for the Raspberry Pi, but works just as well on laptops, desktops or servers

### Software portability
- Modular design to allow easy replacement of components
- Use of abstractions for external services (facilitates mocking in tests and changing providers)
- Avoiding platform-specific dependencies in the application core

## Known limitations

### Hardware limitations
- Server-side voice recognition performance can be affected in very noisy environments (only if the server microphone is used)
- Large AI models may require a lot of RAM and may cause swapping on devices with limited memory
- For client-side voice recognition, it works only on browsers with Web Speech API support (most modern browsers)

### Software limitations
- Dependency on an internet connection for the weather service and (potentially) for client-side voice recognition (Google API)
- Rate limits of the free weather APIs
- The size of the Ollama model directly affects RAM usage and response speed
- Client-side voice recognition works only on localhost or HTTPS (for browser security reasons)
