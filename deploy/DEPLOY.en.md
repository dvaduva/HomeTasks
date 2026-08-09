# Deploy HomeTasks on Raspberry Pi

> **English** · [Română](DEPLOY.md)

## Requirements

- Raspberry Pi running Raspberry Pi OS (or Debian/Ubuntu)
- Python 3.9+
- Node.js 18+ and npm (for the SPA build — `sudo apt install nodejs npm`)
- Internet access to install packages

## Deploy steps

### 1. Clone/copy the project

```bash
git clone <repo-url> /home/pi/HomeTasks
cd /home/pi/HomeTasks
```

> ⚠️ The path is **case-sensitive** and must be exactly `/home/pi/HomeTasks` — it
> is the one used by `deploy/hometasks.service` (`WorkingDirectory`, `ExecStart`,
> `EnvironmentFile`). Cloning with different casing (e.g. `hometasks`) stops the
> service from starting ("gunicorn / .env not found"). The log directory stays
> `/var/log/hometasks`.

### 2. Create the virtualenv and install dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

### 3. Configure environment variables

```bash
cp .env.example .env
nano .env   # edit with real values
```

Required fields:
- `SECRET_KEY` — a unique secret key (generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`)
- `WEATHER_API_KEY` — the OpenWeatherMap API key (free at openweathermap.org)

### 4. Build the SPA bundle

Flask serves the frontend from `frontend/dist/`. It must be generated before
startup (and on every change to the code under `frontend/`):

```bash
cd frontend
npm install
npm run build
cd ..
```

The output (`frontend/dist/`) is not versioned in git — it is rebuilt on every
deploy.

### 5. Create the data and log directories

```bash
mkdir -p /home/pi/HomeTasks/data
sudo mkdir -p /var/log/hometasks
sudo chown pi:pi /var/log/hometasks
```

> Note: the unit declares `LogsDirectory=hometasks`, so systemd recreates
> `/var/log/hometasks` on each start. The `mkdir` here is only needed for the
> manual test in step 6 (gunicorn run directly, not via systemd).

### 6. Test that the app starts

```bash
source venv/bin/activate
gunicorn --config deploy/gunicorn.conf.py wsgi:app
# Check in a browser: http://<RASPBERRY_IP>:5000
# Ctrl+C to stop
```

### 7. Install as a systemd service

```bash
sudo cp deploy/hometasks.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hometasks
sudo systemctl start hometasks
```

### 8. Check the service status

```bash
sudo systemctl status hometasks
sudo journalctl -u hometasks -f   # follow live logs
```

## Touchscreen / kiosk tweaks (RPi only)

### 1. Remove the “Unlock keyring” popup

If the “Unlock keyring” window appears, it is usually the desktop keyring service (`gnome-keyring` / `seahorse`) asking for access. For a kiosk station that does not store passwords and does not need this service, the cleanest fix is to disable it:

```bash
sudo apt remove --purge gnome-keyring seahorse
sudo reboot
```

If you want to keep the package, you can also try:

```bash
rm -f ~/.local/share/keyrings/default.keyring ~/.local/share/keyrings/login.keyring
sudo reboot
```

On a Raspberry Pi dedicated to the app, removing the package is usually the most reliable option.

### 2. Hide the mouse cursor

On Raspberry Pi OS Desktop, you can hide the cursor automatically:

```bash
sudo apt install unclutter -y
mkdir -p ~/.config/lxsession/LXDE-pi
printf '@unclutter -idle 0.1 -root\n@xsetroot -cursor_name none\n' >> ~/.config/lxsession/LXDE-pi/autostart
sudo reboot
```

If you start the browser automatically at boot, launch it in kiosk mode for a better touchscreen experience:

```bash
chromium-browser --kiosk --start-fullscreen http://127.0.0.1:5000
```

## Wi-Fi configuration from the UI (RPi only)

The **Settings → Network** tab lets you scan and connect to a Wi-Fi network
straight from the UI. It works on the RPi only, via `nmcli` (NetworkManager), and
appears automatically only where `nmcli` exists (on Windows/dev the tab is hidden).

### 1. Make sure NetworkManager manages Wi-Fi

Raspberry Pi OS Bookworm uses NetworkManager by default. Verify:

```bash
nmcli general status        # must respond (NetworkManager active)
nmcli device wifi list      # must list networks
```

On older images (with `dhcpcd`/`wpa_supplicant`), enable NetworkManager:

```bash
sudo raspi-config   # Advanced Options → Network Config → NetworkManager
sudo reboot
```

### 2. Let the service user (`pi`) manage the network

The app runs as user `pi` via systemd, **without a graphical session** (see
`hometasks.service`), and `nmcli connect` / `disconnect` need rights via polkit.
The process must be in the `netdev` group — the unit already declares it
explicitly (`SupplementaryGroups=... netdev`), so it's enough for the group to
exist. For safety, add it to the user as well (used for the manual steps /
`sudo -u pi`):

```bash
sudo usermod -aG netdev pi
sudo systemctl restart hometasks   # reload the process's groups
```

Check which polkit version you have — the steps differ:

```bash
pkaction --version
```

#### Polkit ≥ 0.106 (Raspberry Pi OS Bookworm and newer) — JavaScript rules

```bash
sudo tee /etc/polkit-1/rules.d/50-hometasks-nm.rules > /dev/null <<'EOF'
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0 &&
        subject.isInGroup("netdev")) {
        return polkit.Result.YES;
    }
});
EOF
sudo systemctl restart polkit
```

#### Polkit 0.105 (Bullseye and older images) — `.pkla` files

Here `/etc/polkit-1/rules.d/` does **not** exist (JS rules aren't supported). You
use `.pkla` files. Beware: on Debian the `network-manager` package ships a vendor
rule that requires an **active session** to save system connections, which blocks
a sessionless systemd service:

```
# /var/lib/polkit-1/localauthority/10-vendor.d/org.freedesktop.NetworkManager.pkla
Action=org.freedesktop.NetworkManager.settings.modify.system
ResultAny=no          # ← blocks sessionless processes (our service)
ResultInactive=no
ResultActive=yes
```

A custom rule in `50-local.d/` does **not** reliably override this vendor rule on
0.105, so you must relax the vendor rule itself (with a backup):

```bash
sudo cp /var/lib/polkit-1/localauthority/10-vendor.d/org.freedesktop.NetworkManager.pkla \
        /root/nm-vendor.pkla.orig
sudo sed -i 's/^ResultInactive=no/ResultInactive=yes/; s/^ResultAny=no/ResultAny=yes/' \
        /var/lib/polkit-1/localauthority/10-vendor.d/org.freedesktop.NetworkManager.pkla
sudo systemctl restart polkit
```

> ⚠️ The file is owned by the `network-manager` package; **a package upgrade can
> overwrite it** and the sed above must be reapplied (the backup stays in
> `/root/nm-vendor.pkla.orig`).

### 3. Test

```bash
# check the real service process's authorization (must be exit=0):
GPID=$(systemctl show -p MainPID --value hometasks)
sudo pkcheck --action-id org.freedesktop.NetworkManager.settings.modify.system --process "$GPID"; echo "exit=$?"

# as user pi, no sudo — must work:
sudo -u pi nmcli device wifi connect "<SSID>" password "<password>"
```

If `pkcheck` returns `exit=0` and the command succeeds without `sudo`, the
"Connect" button in the UI will work. The exposed endpoints are `/api/wifi/status`,
`/api/wifi/scan`, `/api/wifi/connect`, `/api/wifi/disconnect`.

## Bluetooth speakers / audio (RPi only)

Playing the radio to a Bluetooth speaker requires a separate system setup (BlueZ +
D-Bus access for `pi`, PulseAudio in system mode, `mpv` with the VideoCore
libraries). The full procedure, with every pitfall, is in
[docs/audio-streaming.md](../docs/audio-streaming.md) → "RPi runbook".

## Useful commands

```bash
# Start/stop/restart
sudo systemctl start hometasks
sudo systemctl stop hometasks
sudo systemctl restart hometasks

# Logs
tail -f /var/log/hometasks/access.log
tail -f /var/log/hometasks/error.log
```

## Updating the app

```bash
cd /home/pi/HomeTasks
git pull
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart hometasks
```

## Running tests

```bash
source venv/bin/activate
pip install pytest pytest-cov
pytest tests/ -v
pytest tests/ --cov=src --cov-report=term-missing
```
