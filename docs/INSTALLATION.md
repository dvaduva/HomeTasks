# Installation guide - HomeTasks (Web)

> **English** · [Română](INSTALLATION.ro.md)

## Hardware prerequisites

### Server device (Raspberry Pi or any other computer)
- Recommended model: Raspberry Pi 4 Model B with 4GB RAM or more
- Acceptable alternative: Raspberry Pi 3 Model B+ (reduced performance)
- Any modern computer/device capable of running Python 3.9+
- Minimum storage space: 16GB (32GB+ recommended for updates and logs)
- Stable power supply (for Raspberry Pi: 5V/3A for Pi 4, 5V/2.5A for Pi 3)

### For local access on the device (optional)
- Compatible touchscreen (only if you want to access the application directly on the Raspberry Pi screen)
  - Minimum resolution: 800x480 px (WVGA)
  - Recommended resolution: 1024x600 px or 1280x720 px
- USB microphone with noise reduction (for good voice recognition on the local device, only if STT is implemented on the server)
- Protective case for the Raspberry Pi (optional but recommended)

### Other equipment (optional)
- USB keyboard and mouse (for initial setup)
- HDMI cable (if the screen connects via HDMI)
- Internet connection (Wi-Fi or Ethernet)

## Preparing the operating system

### Choosing the operating system
- Any operating system capable of running Python 3.9+:
  - Raspberry Pi OS (formerly Raspbian) 64-bit version 2023-05 or newer (recommended for Raspberry Pi)
  - Ubuntu Server for Raspberry Pi 64-bit (alternative)
  - Other Linux distributions compatible with ARM v8
  - Windows 10/11 or macOS (for development or use on other devices)

### Downloading and installing the operating system (for Raspberry Pi)
1. Go to the official site: https://www.raspberrypi.com/software/
2. Download Raspberry Pi OS Lite (64-bit) or Raspberry Pi OS Desktop (64-bit)
   - For this project, both variants work because the interface is web-based
   - The Lite version is sufficient and uses fewer resources
3. Verify the integrity of the downloaded file using SHA-256 (optional but recommended)

### Writing the image to a microSD card (for Raspberry Pi)
#### On Windows
1. Download and install Balena Etcher: https://www.balena.io/etcher/
2. Insert the microSD card into the computer's card reader
3. Launch Balena Etcher
4. Select the downloaded .zip or .img image file
5. Select the microSD card drive
6. Click "Flash!" and wait for the process to finish

#### On macOS or Linux
1. Open the Terminal
2. Identify the microSD card drive with `lsblk` (Linux) or `diskutil list` (macOS)
3. Unmount the partitions: `sudo umount /dev/sdX1` (replace with the correct drive)
4. Write the image:
   ```bash
   sudo dd if=raspios.img of=/dev/sdX bs=4M status=progress conv=fdatasync
   ```
   (replace `raspios.img` with the path to the image and `/dev/sdX` with the microSD card drive)
5. Wait for the process to finish

### First boot and basic configuration (for Raspberry Pi)
1. Insert the microSD card into the Raspberry Pi
2. Connect the screen (only for initial setup), keyboard, mouse and power supply
3. The Raspberry Pi will boot automatically and display the initial setup wizard
4. Follow the steps:
   - Select the language, time zone and keyboard layout
   - Change the default password for the `pi` user (recommended for security)
   - Connect to the Wi-Fi network or plug in the Ethernet cable
   - Update the system when prompted (recommended)
   - Reboot the system when prompted
5. After setup, you can disconnect the screen, keyboard and mouse if you want to run headless

## Installing software dependencies

### Updating the system
Open a terminal and run:
```bash
sudo apt update
sudo apt upgrade -y
```

### Installing Python and pip
Most modern operating systems come with Python 3 installed, but let's make sure we have a recent version:
```bash
python3 --version  # Must be 3.9 or newer
```

If you don't have Python 3.9+:
```bash
# On Raspberry Pi OS / Ubuntu/Debian
sudo apt install python3 python3-pip python3-dev -y

# System libraries required to build PyAudio (microphone / voice commands).
# Without them, `pip install` fails with "fatal error: portaudio.h: No such file or directory",
# because on the RPi (aarch64) PyAudio is compiled from source.
sudo apt install portaudio19-dev -y

# On macOS (using Homebrew)
# brew install python3

# On Windows: download and install from https://www.python.org/downloads/
```

### Creating a virtual environment (recommended)
```bash
# Navigate to the directory where you want to install the application
# Example for Raspberry Pi:
cd /home/pi
mkdir HomeTasks
cd HomeTasks

# Create the virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Verify that you are working inside the virtual environment
which python  # Must point to venv/bin/python
```

### Installing the Python dependencies
In the activated virtual environment:
```bash
# Make sure pip is up to date
pip install --upgrade pip

# Install all dependencies in a single command
pip install -r requirements.txt
```

The dependencies include: Flask, SQLAlchemy, requests, python-dotenv, tinytuya (for Tuya IoT integration), gunicorn (production server), pytest, gTTS (server-side TTS for the RPi kiosk).

> **Note (Raspberry Pi):** PyAudio has no prebuilt wheel for `aarch64`, so it is
> compiled from source and needs the PortAudio headers. If `pip install` fails with
> `fatal error: portaudio.h: No such file or directory`, first install the system
> packages `python3-dev` and `portaudio19-dev` (see above), then re-run
> `pip install -r requirements.txt`.

## Downloading and configuring the HomeTasks application

### Getting the application source
```bash
# In the activated virtual environment
git clone https://github.com/dvaduva/HomeTasks.git
cd HomeTasks
```

### Creating the environment variables file
Create a `.env` file in the application's root directory:
```bash
cp .env.example .env
```
Edit the `.env` file and fill in:
```env
# Flask settings
FLASK_APP=wsgi.py
FLASK_ENV=production  # change to development for local development
# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=secret_key_for_sessions

# Database (default: SQLite in the data/ folder)
# For PostgreSQL: DATABASE_URL=postgresql://user:password@localhost/hometasks
DATABASE_URL=sqlite:///./data/hometasks.db

# Weather API (free key from openweathermap.org)
WEATHER_API_KEY=your_openweathermap_key

# Ollama AI settings
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b
OLLAMA_TIMEOUT=120

# Application settings
DEFAULT_LANGUAGE=ro  # or en for English
TEMPERATURE_UNIT=C  # or F
UPDATE_INTERVAL_MINUTES=30
VOICE_ACTIVATION_WORD=Hey HomeTasks
VOICE_DEBUG_LOG=false

# Tuya Cloud (eu.platform.tuya.com) - for temperatures from IoT sensors
TUYA_ACCESS_ID=your_access_id
TUYA_ACCESS_SECRET=your_access_secret
TUYA_API_REGION=eu
```

### Configuring the Ollama server
**Important for Raspberry Pi:** Ollama only supports **64-bit (arm64) systems**. If you have Raspberry Pi OS 32-bit (armv7l), the official script will show `ERROR: Unsupported architecture: armv7l`. You must use **Raspberry Pi OS 64-bit** (see the "Choosing the operating system" section) or run Ollama on another computer on the network and set in `.env`: `OLLAMA_HOST=http://<that-pc-ip>:11434`.

1. Install Ollama on your device (Raspberry Pi 64-bit or any other Linux x86_64/arm64):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Start the Ollama service:
   ```bash
   ollama serve &
   ```
   To run it permanently in the background, consider configuring it as a systemd service (see below).
3. Download a suitable model (example: llama3:8b):
   ```bash
   ollama pull llama3:8b
   ```
4. Verify that the model is available:
   ```bash
   ollama list
   ```

### Configuring Ollama as a systemd service (optional but recommended)
1. Create the service file:
   ```bash
   sudo nano /etc/systemd/system/ollama.service
   ```
2. Add the following content:
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
3. Save and exit (Ctrl+O, Enter, Ctrl+X in nano)
4. Enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ollama
   sudo systemctl start ollama
   ```
5. Check the status:
   ```bash
   sudo systemctl status ollama
   ```

### Configuring the Tuya integration (optional)
If you want to display temperatures from Tuya IoT sensors (thermostats, temperature sensors):

1. Create an account on the [Tuya IoT Platform](https://eu.platform.tuya.com)
2. Create a Cloud project and obtain the `Access ID` and `Access Secret`
3. Add your devices to the project
4. Fill in `.env`:
   ```env
   TUYA_ACCESS_ID=your_access_id
   TUYA_ACCESS_SECRET=your_access_secret
   TUYA_API_REGION=eu  # eu, us, cn, in depending on region
   ```
   Alternatively, these credentials can also be configured from the web interface, under Settings → Tuya Cloud.

## Configuring Wi-Fi from the interface (RPi only)

HomeTasks can manage the Raspberry Pi's Wi-Fi connection directly from the web
interface — handy for a keyboard-less kiosk device: scan nearby networks, type the
password and connect, all from the touchscreen. The feature lives under
**Settings → Network**.

### Requirements
- **NetworkManager** (`nmcli`), the standard on **Raspberry Pi OS Bookworm**.
  The application uses `nmcli` exclusively; it never touches `wpa_supplicant.conf`.
  NetworkManager owns the saved profiles and reconnects automatically after a reboot.
- On systems without `nmcli` (Windows, older Raspberry Pi OS with `dhcpcd`), the
  feature degrades gracefully: **the "Network" tab is not even shown**, and a scan
  returns an empty list instead of an error.

Check availability on the RPi:
```bash
which nmcli                       # typically /usr/bin/nmcli
systemctl status NetworkManager   # must be "active (running)"
```
If it is missing on an older system: `sudo apt install network-manager`, then
enable it (`sudo systemctl enable --now NetworkManager`).

### How it works
The frontend talks to the `/api/wifi/*` REST API, and the backend runs `nmcli`:

| Action | Endpoint | `nmcli` command |
| --- | --- | --- |
| Availability / status detection | `GET /api/wifi/status` | `nmcli -t -f IN-USE,SSID,DEVICE device wifi` + `device show <dev>` for the IP |
| Scan networks | `POST /api/wifi/scan` | `nmcli -t -f IN-USE,SIGNAL,SECURITY,SSID device wifi list --rescan yes` |
| Connect | `POST /api/wifi/connect` | `nmcli device wifi connect <ssid> [password <password>] [hidden yes]` |
| Disconnect | `POST /api/wifi/disconnect` | `nmcli device disconnect <dev>` |

- **Showing the tab**: when Settings open, the interface calls `/api/wifi/status`;
  the "Network" tab appears **only if the response has `available: true`** (i.e.
  `nmcli` exists on the system).
- **Starting a scan**: scanning does NOT run at application startup. It is
  triggered (a) automatically when you open the "Network" tab, (b) manually with
  the "Scan" button and (c) automatically after a successful connect/disconnect.
  `--rescan yes` forces a fresh scan (20 s timeout).
- **Results**: networks are deduplicated by SSID (strongest signal wins), sorted by
  signal descending; hidden networks (empty SSID) are ignored. Each entry shows the
  signal strength, a lock 🔒 for secured networks and a marker for the current
  network.
- **Connecting**: secured networks show an inline password field; for open networks
  the connection starts immediately (45 s timeout — DHCP + authentication can take
  a while). A keyboard-less kiosk can type the password with the on-screen keyboard
  (the ⌨ button next to the password field).

> **Permissions:** the `hometasks` systemd service runs as `pi` **without a
> graphical session**, so connecting requires polkit rights to manage
> NetworkManager (membership in `netdev` plus, on polkit 0.105, a `.pkla` tweak).
> See [deploy/DEPLOY.md](../deploy/DEPLOY.md) → "Allow the service user to manage
> the network" if connecting fails with "Not authorized" / "Insufficient
> privileges".

> **Note:** implementation details are in [src/wifi/service.py](../src/wifi/service.py)
> (backend) and `frontend/src/components/WiFiManager.vue` (UI). The feature mirrors
> the Bluetooth panel (`src/bt/service.py`) — the same scan/connect pattern.

## Running the HomeTasks application

### First run
```bash
# Make sure you are in the application directory and the virtual environment is activated
cd /home/pi/HomeTasks
source venv/bin/activate  # If not already activated

# Install the application-specific dependencies
pip install -r requirements.txt

# Run the application
python src/main.py
```

The application will start at http://localhost:5000

### SPA frontend (Vue 3 + Vite)

The application is a **Single Page Application** built with Vue 3 + Vite + Pinia.
The SPA code lives in the `frontend/` directory; Flask serves the built bundle
from `frontend/dist/` and exposes only the REST API `/api/*`. See
[docs/SPA_MIGRATION.md](SPA_MIGRATION.md) for architectural details.

Additional prerequisites: **Node.js 18+ and npm**.

#### Installing Node.js 18 (on Raspberry Pi)
**Important:** Node.js from the default Raspberry Pi OS / Debian repository is
usually far too old (e.g. v10), and `vue-tsc`/Vite require **Node 18+**. With an
old Node, the build fails with errors like `SyntaxError: Unexpected token .`
(optional chaining `?.`) or warnings such as
`npm WARN EBADENGINE ... current: { node: 'v10.x' }`. Install Node 18 from
NodeSource:

```bash
# Remove the old Node from apt (if present)
sudo apt remove --purge nodejs npm -y
sudo apt autoremove -y

# Add the NodeSource 18.x repository and install
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Confirm the version (must be v18.x)
node -v
npm -v
```

> This works on 32-bit Raspberry Pi OS (armhf) too — NodeSource provides armhf
> builds for Node 18. If NodeSource doesn't work on your board, use `nvm`:
> `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`,
> reopen the terminal, then `nvm install 18 && nvm use 18`.

```bash
# Install SPA dependencies (once)
cd frontend
npm install

# Development (Vite dev server on :5173, proxy /api → Flask :5000)
# Start Flask separately in another terminal: python src/main.py
npm run dev

# Build for production (bundle in frontend/dist/)
npm run build

# Type-check only (TypeScript), without building
npm run type-check
```

In dev mode, open http://localhost:5173 — Vite proxies `/api/*` to Flask
(`http://localhost:5000`). The Vue router handles all five views (`/`,
`/calendar`, `/radio`, `/transport`, `/history`) with automatic per-route
code-splitting; Flask falls back to `index.html` for any non-API path so that
refreshing directly on client-side routes works.

The build also produces precompressed `.br` and `.gz` files (via
`vite-plugin-compression`). Flask serves them automatically to clients that
advertise `Accept-Encoding: br` / `gzip` — useful for the Chromium kiosk on the
Raspberry Pi (initial bundle ~88 KB gzip).

> **Note:** the original MPA code (Jinja templates + vanilla JS) is archived in
> [legacy/](../legacy/) for reference; it is no longer served by the application.
> It can be deleted entirely after the SPA is validated in production.

### Configuring the application to start at system boot
1. Create a systemd service file for the HomeTasks application:
   ```bash
   sudo nano /etc/systemd/system/hometasks.service
   ```
2. Add the following content:
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
3. Save and exit (Ctrl+O, Enter, Ctrl+X in nano)
4. Enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable hometasks
   sudo systemctl start hometasks
   ```
5. Check the status:
   ```bash
   sudo systemctl status hometasks
   ```

### Accessing the application
- For local access on the device running the application: `http://localhost:5000`
- For access from other devices on the local network: `http://<ip-address>:5000`
  - Find the IP address with: `hostname -I` or `ip addr show`
  - Example: `http://192.168.1.100:5000`

### Auto-launching the browser in kiosk mode (local screen on Raspberry Pi)

If you have a screen connected to the Raspberry Pi and want the application to open automatically in the browser at system boot, follow the steps below.

**Requirement**: Raspberry Pi OS with a graphical interface (Desktop), not the Lite version.

1. Install Chromium if it is not already installed:
   ```bash
   sudo apt install chromium -y
   ```
   > **The binary name differs between versions:** on Raspberry Pi OS **Bookworm/Trixie**
   > the package and command are `chromium`. On **Bullseye** (and older) they were
   > `chromium-browser`. Check what you have with `which chromium` / `which chromium-browser`
   > and use the correct name in the `Exec=` command below — if it's wrong, autostart
   > fails silently (the browser doesn't open at boot).

2. Create the autostart directory if it doesn't exist:
   ```bash
   mkdir -p ~/.config/autostart
   ```

3. Create the autostart file for the kiosk:
   ```bash
   nano ~/.config/autostart/hometasks-kiosk.desktop
   ```

4. Add the following content:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=HomeTasks Kiosk
   Exec=bash -c "sleep 5 && chromium --kiosk --start-fullscreen --touch-events=enabled --window-size=800,480 --force-device-scale-factor=1 --alsa-output-device=plughw:CARD=Headphones,DEV=0 --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble http://localhost:5000/"
   X-GNOME-Autostart-enabled=true
   ```
   > `sleep 5` ensures the `hometasks` service starts before the browser opens.
   >
   > `--touch-events=enabled` is **essential on touchscreens**: without it, Chromium
   > often fails to recognize the RPi touch panel and treats a tap as a mouse click —
   > buttons work, but you **cannot drag-scroll lists with your finger** (e.g. the radio
   > station list). The flag forces proper touch gesture handling (drag-scroll).
   >
   > For the official Raspberry Pi 7" display, use `--window-size=800,480` and add
   > `disable_overscan=1` to `/boot/config.txt` so Chromium fills the entire screen.

5. Save and exit (Ctrl+O, Enter, Ctrl+X in nano)

6. Optional — disable the screensaver and power saving for the screen:
   ```bash
   # Add to ~/.config/autostart/disable-screensaver.desktop
   nano ~/.config/autostart/disable-screensaver.desktop
   ```
   ```ini
   [Desktop Entry]
   Type=Application
   Name=Disable Screensaver
   Exec=xset s off -dpms
   X-GNOME-Autostart-enabled=true
   ```

7. Reboot the Raspberry Pi:
   ```bash
   sudo reboot
   ```

After rebooting, the browser will automatically open `http://localhost:5000` in fullscreen (kiosk) mode.

## Verifying the installation

### Checking the components
1. **Python and dependencies**:
   ```bash
   python -c "import flask, requests; print('Core dependencies available')"
   ```
2. **Microphone** (only if you use server-side STT):
   - Run `arecord -l` to see whether the microphone is detected
   - Test with `arecord -d 5 test.wav && aplay test.wav`
3. **Ollama**:
   ```bash
   curl http://localhost:11434/api/version
   ollama list
   ```

### Logs and troubleshooting
- The application writes logs to the `logs/` directory (created automatically)
- To watch the logs in real time: `tail -f logs/hometask.log`
- To view the Ollama logs (if running as a service): `journalctl -u ollama`
- In case of errors, check:
  - `logs/hometask.log` for application errors
  - `dmesg` for hardware problems

## Updating the application

### Updating the source
```bash
cd /home/pi/HomeTasks
git pull origin main  # or your development branch
```

### Updating the dependencies
```bash
source venv/bin/activate
pip install --upgrade -r requirements.txt
```

### Rebuilding the SPA frontend (after `git pull`)
If the code in `frontend/` was updated, rebuild the bundle served by Flask:
```bash
cd frontend
npm install        # update SPA dependencies if they changed
npm run build      # regenerate frontend/dist/
cd ..
sudo systemctl restart hometasks   # if running as a service
```

### Updating the Ollama model
```bash
ollama pull llama3:8b  # replace with your model
# To remove an old model:
# ollama rm llama3:8b
```

## Resolving common installation problems

### Problem: "No module named 'flask'"
**Solution**: Install Flask:
```bash
pip install flask
```

### Problem: "SyntaxError: Unexpected token ." or "vue-tsc: Permission denied" on `npm run build`
**Cause**: Node.js is too old (e.g. v10 from the Raspberry Pi OS repository). `vue-tsc`
and Vite use syntax (optional chaining `?.`) supported only by **Node 18+**.
Typical signs:
- `SyntaxError: Unexpected token .` in `@volar/typescript/.../runTsc.js`
- `npm WARN EBADENGINE ... required: { node: '^18.0.0 ...' }, current: { node: 'v10.x' }`
- `ExperimentalWarning: The fs.promises API is experimental` (Node 10/11)
- `sh: 1: vue-tsc: Permission denied` (code 126) — binaries in `node_modules/.bin/`
  without the execute bit, often after `npm install` ran with an old Node.

**Solution**:
1. Install **Node 18** (see "Installing Node.js 18 (on Raspberry Pi)"). Verify with `node -v`.
2. Reinstall the SPA dependencies cleanly with the new Node and rebuild:
   ```bash
   cd ~/HomeTasks/frontend
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```
> Do not run `npm` with `sudo` — it doesn't fix the Node version and corrupts file
> ownership. If you used `sudo` by mistake: `sudo chown -R pi:pi node_modules ~/.npm`.

### Problem: "ERROR: Unsupported architecture: armv7l" when installing Ollama
**Cause**: Ollama does not provide builds for 32-bit ARM (armv7l) processors. The official script only supports x86_64 and arm64 (64-bit).

**Solutions**:
1. **Recommended**: Use **Raspberry Pi OS 64-bit** (not Lite 32-bit). Reinstall the system with the 64-bit image from [raspberrypi.com/software](https://www.raspberrypi.com/software/), then run `curl -fsSL https://ollama.com/install.sh | sh` again.
2. **Alternative**: Run Ollama on another computer on the network (PC, Mac, or a Raspberry Pi with a 64-bit OS), start `ollama serve` there (or the Ollama service), and on the Raspberry Pi set in `.env`: `OLLAMA_HOST=http://<IP-of-the-computer-with-ollama>:11434`. The HomeTasks application will use Ollama from that host.

### Problem: "Cannot connect to Ollama server at http://localhost:11434:111 Connection refused"
**Solution**:
1. Check whether Ollama is running: `ps aux | grep ollama`
2. If it isn't running, start it manually: `ollama serve &`
3. If it runs as a service, check the status: `sudo systemctl status ollama`
4. Make sure no firewalls are blocking port 11434.

### Problem: "Error in speech recognition: audio-capture" (Raspberry Pi / Linux)
**Cause**: The browser cannot capture the microphone. At `http://<RPi-IP>:5000` from another device, the microphone used is that device's. On the RPi (Chromium at `http://localhost:5000`), the USB microphone must be the default capture device and Chromium must have microphone permission.

**Steps on the RPi:**

1. Check the microphone: `arecord -l` (note the card, e.g. card 1).
2. User in the `audio` group: `sudo usermod -a -G audio pi` → log out/log back in.
3. Default capture device:
   - **PulseAudio** (`pactl info` works): `pactl list sources short`, then `pactl set-default-source <USB_source>`.
   - **ALSA only**: in `~/.asoundrc` set `capture.pcm "plughw:1,0"` (adapting the card to `arecord -l`).
4. Test: `arecord -d 3 -f cd test.wav && aplay test.wav`.
5. In Chromium: microphone permission (lock icon → Site settings → Microphone: Allow). Open the application via `http://localhost:5000` or `http://127.0.0.1:5000`.

### Problem: "Error in speech recognition: network" / "aborted" (RPi / Chromium)
**Cause**: The Web Speech API uses Google's service; no internet or a firewall → "network" or "aborted".

**What to do:** Check the internet (`ping -c 3 8.8.8.8`, `curl -sI https://www.google.com`). Don't block Google domains (Pi-hole/firewall). If https://www.google.com/intl/en/chrome/demos/speech.html works in Chromium but not in the application, the problem is with the application/network; if it doesn't work there either, it's with Chromium/network/Google.

**Debug (without a console / kiosk):** Open `http://localhost:5000?voice_debug=1` or **Settings → Voice → Show voice debug log on screen**. In `.env`: `VOICE_DEBUG_LOG=1` also enables writing to `logs/voice-debug.log`; `VOICE_DEBUG_LOG=0` or `false` disables it and hides the "Voice debug" panel on screen (the server hides it in the frontend).

### Workaround: microphone on the server (when the browser gives "aborted" / "network")
Dependencies: `pip install -r requirements.txt`. Microphone detected: `arecord -l`; user in the `audio` group. In the application: **Settings → Voice → Use the server microphone**. The voice command is issued by pressing the microphone button; listening for the activation word is disabled when this option is checked.

If the option is greyed out: on the RPi install `sudo apt install portaudio19-dev` (or `python3-pyaudio`), then `pip install -r requirements.txt`. Check `arecord -l` and the `audio` group. If it still doesn't work: set ALSA capture in `~/.asoundrc` (as in step 3 above) and test `arecord -d 3 -f cd test.wav && aplay test.wav`. Frequent messages: "No speech heard" → speak within the ~6 s; "Recognition service error" → internet; "Microphone unavailable" → ALSA/PyAudio.

### TTS (AI response voice) on the RPi in kiosk mode
If **YouTube plays** in Chromium but **AI messages (🔊) do not**, the audio for in-app TTS must be played through the same pipeline as YouTube (HTML5 Audio). The steps that work:

1. **PulseAudio in the session**
   In `~/.config/lxsession/LXDE-pi/autostart` add the line **`@pulseaudio --start`** (before the line that starts Chromium), so PulseAudio runs in the desktop session.
   > ⚠️ **Skip this step** if you set up PulseAudio in **system mode** for Bluetooth speakers (see [audio-streaming.md](audio-streaming.md), "RPi runbook"). The two servers fight over the sound card. In system mode Chromium and the microphone use the system server anyway (`default-server` in `client.conf`), so don't `@pulseaudio --start`.

2. **Project dependencies**
   `pip install -r requirements.txt` (includes gTTS for server-side TTS).

3. **Chromium with the correct ALSA output**
   Start Chromium with the parameter for speakers/headphones, e.g.:
   `--alsa-output-device=plughw:CARD=Headphones,DEV=0`
   (you can see the device with `aplay -L`; for Headphones it's typically `plughw:CARD=Headphones,DEV=0`).

4. **raspi-config**
   **System Options → Audio → Headphones** (or HDMI, if you use a monitor with built-in speakers).

With these steps, AI voice responses (and YouTube) should be audible through the speakers. Without gTTS installed, the application falls back to browser TTS, which may not be audible in kiosk mode.

### Problem: "PortAudio error: -9996 (Invalid input device)"
**Solution** (only if you use server-side STT):
1. Check the microphone connection: `arecord -l`
2. Make sure the user has permission to access the audio devices:
   ```bash
   sudo usermod -a -G audio pi
   ```
3. Reboot the system or log out and log back in.

### Problem: "Could not find a suitable TLS CA certificate bundle"
**Cause**: The `certifi` package can't find the SSL certificates (usually after deleting and recreating the virtual environment).
**Solution**: Recreate the virtual environment and reinstall the dependencies:
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# or: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Problem: "API key invalid" for the weather service
**Solution**:
1. Check the API key in the `.env` file
2. Make sure the selected weather service accepts your key
3. Test the API key directly in the browser or with curl:
   ```bash
   curl "http://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_KEY_HERE"
   ```
4. Check the daily request limit for your account.

### Problem: The application closes immediately after starting
**Solution**:
1. Check the logs: `cat logs/hometask.log`
2. Look for missing import errors and install the respective packages
3. Make sure the `.env` file exists and contains the required variables
4. Run the application from the terminal to see errors in real time: `python src/main.py`

### Problem: I can't access the application from other devices
**Solution**:
1. Make sure the application is running and accessible on port 5000: `netstat -tuln | grep 5000`
2. Check the local firewall: `sudo ufw status` or `sudo iptables -L`
3. If you have an active firewall, allow traffic on port 5000:
   ```bash
   sudo ufw allow 5000/tcp
   ```
4. Make sure you use the correct IP address of the device (not localhost from other devices)

### Problem: The "Network" (Wi-Fi) tab doesn't appear in Settings
**Cause**: The "Network" tab is shown only if the backend responds with
`available: true` at `/api/wifi/status`, which happens **only when `nmcli`
(NetworkManager) is found on the system**.

**Diagnosis** (on the RPi, with the application running):
```bash
# 1. What does the backend report? Watch the "available" field
curl -s http://localhost:5000/api/wifi/status

# 2. Does nmcli exist and is NetworkManager running?
which nmcli
systemctl status NetworkManager
```

**Solution depending on the result**:
1. **`"available": false`** → NetworkManager is missing. It is standard on
   Raspberry Pi OS Bookworm; on older versions (Bullseye/Buster) install it:
   ```bash
   sudo apt install network-manager -y
   sudo systemctl enable --now NetworkManager
   ```
   (Note: it may conflict with `dhcpcd` on old systems — on Bookworm this is not
   an issue.) Then restart the application and reopen Settings.
2. **`"available": true` but the tab still doesn't appear** → a stale frontend
   bundle in the browser. Make sure you ran `npm run build` after `git pull` (see
   "Rebuilding the SPA frontend"), then do a **hard refresh** in Chromium
   (Ctrl+Shift+R). In kiosk mode, restart Chromium or clear the cache.
3. **`nmcli` is missing (`which nmcli` empty)** but you think it is installed →
   confirm the path; the `hometasks` service finds binaries in `/usr/bin`
   (included in the systemd unit's PATH).

### Problem: Connecting to Wi-Fi fails with "Not authorized" / "Insufficient privileges"
**Cause**: The `hometasks` service runs as `pi` through systemd, **without a
graphical session**. NetworkManager asks polkit for authorization, and the default
rules require an active session to save a system connection — so a session-less
service is denied even when `pi` is in the `netdev` group.

**Solution**: Grant the service user polkit rights to manage NetworkManager. The
exact steps depend on the polkit version (`pkaction --version`) — on polkit 0.105
the vendor `.pkla` rule has to be relaxed. The full, tested procedure is in
[deploy/DEPLOY.md](../deploy/DEPLOY.md) → "Allow the service user to manage the
network". Quick check that it worked:
```bash
GPID=$(systemctl show -p MainPID --value hometasks)
sudo pkcheck --action-id org.freedesktop.NetworkManager.settings.modify.system --process "$GPID"; echo "exit=$?"
# exit=0 means authorized → the "Connect" button will work
```

### Problem: Poor performance or frequent freezes
**Solution**:
1. Monitor resource usage: `top` or `htop`
2. If RAM usage is high, consider:
   - Using a smaller Ollama model (e.g. phi3:medium or tinyllama:1.1b)
   - Lowering the model temperature for faster responses
   - Increasing swap memory (optional, but it can affect the microSD card's lifespan)
3. If CPU usage is high:
   - Check whether there are hidden background processes
   - Reduce the weather update frequency in the settings
   - Optimize the web interface by reducing non-essential animations

## Backup and recovery

### Backing up the application and data
1. Stop the application if it is running
2. Make a backup copy of the complete directory:
   ```bash
   cd /home/pi
   tar -czvf hometask_backup_$(date +%Y%m%d_%H%M%S).tar.gz hometask/HomeTasks
   ```
3. Copy the backup file to an external device or to the cloud

### Recovering from backup
1. Copy the backup file back to your device
2. Extract it:
   ```bash
   tar -xzvf hometask_backup_YYYYMMDD_HHMMSS.tar.gz
   ```
3. Restore the virtual environment if necessary (delete the `venv` directory and recreate it)
4. Restore the dependencies: `pip install -r requirements.txt`
5. Check the `.env` file and adjust it if necessary

## Maintenance recommendations

### Weekly
- Check the activity log for unusual activity
- Clear the application cache via Settings → Advanced → Clear cache

### Monthly
- Update the operating system: `sudo apt update && sudo apt upgrade -y`
- Update the Python dependencies: `pip list --outdated` and update the necessary packages
- Check the available disk space: `df -h`
- Check the database file integrity (optional): `sqlite3 data/hometask.db "PRAGMA integrity_check;"`

### Yearly
- Replace the microSD card (for the Raspberry Pi, they tend to degrade over time)
- Review hardware needs and consider an upgrade if the application becomes too slow
- Update the Ollama model to the latest available version

---

Note: Because this is a web application, it can run on any device capable of running Python 3.9+, not only on a Raspberry Pi. Access is through the browser at http://<ip-address>:5000.
