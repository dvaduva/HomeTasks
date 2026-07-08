from flask import Flask, jsonify, request, send_file, send_from_directory, Response, stream_with_context
import logging
import os
import re
import socket
from urllib.parse import urlparse
from sqlalchemy import func, and_, or_

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
from task_manager.database import create_tables, engine
from task_manager.models import Base, User, Task, Comment, Preferences, RadioStation, TaskStatus, RecurrencePattern
from task_manager.repository import UserRepository, TaskRepository, CommentRepository, PreferencesRepository, RadioStationRepository, expand_recurring_tasks
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import json
from weather.service import WeatherService
from ai.registry import get_provider, get_models_for, active_provider_id, configured_providers
from ai.history import conversation_history
from voice.service import voice_service
from tuya.service import tuya_service
from cast.service import cast_service
from bt.service import bluetooth_service
from wifi.service import wifi_service
import logbuf

# Load environment variables
load_dotenv()

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# Built SPA bundle (frontend/dist) — produced by `npm run build` in frontend/.
FRONTEND_DIST = os.path.join(BASE_DIR, 'frontend', 'dist')

# Start capturing logs to daily files (viewable at /logs on the kiosk, which has
# no terminal). Done at import so gunicorn workers install it too, not just the
# dev server's __main__.
logbuf.install(os.path.join(BASE_DIR, 'logs'))

# Flask serves only the SPA bundle now (frontend/dist) and the JSON API. The
# legacy Jinja templates and vanilla-JS assets have been archived under legacy/.
app = Flask(__name__, static_folder=None)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# Initialize services
weather_service = WeatherService()

# Initialize database
def initialize_database():
    create_tables()
    # Optionally create some initial data for testing
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        # Check if we already have data
        if session.query(User).count() == 0:
            # Create a default user
            user_repo = UserRepository(session)
            user = user_repo.create("Test User", "#e74c3c")
            
            # Create preferences if not exist
            prefs_repo = PreferencesRepository(session)
            prefs = prefs_repo.get_or_create()
            
            # Create a sample task
            task_repo = TaskRepository(session)
            task = task_repo.create(
                description="Sample task: Buy groceries",
                user_id=user.id,
                scheduled_date=datetime.now() + timedelta(hours=2)
            )
            
            # Add a sample comment
            comment_repo = CommentRepository(session)
            comment = comment_repo.create(
                text="Don't forget the milk!",
                task_id=task.id,
                user_id=user.id
            )
            
            session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error initializing data: {e}")
    finally:
        session.close()

    # Seed radio stations from the bundled JSON the first time (idempotent).
    _seed_radio_stations()


def _stations_json_path():
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'radio', 'stations.json'
    )


def _seed_radio_stations():
    """Import data/radio/stations.json into the DB once, if the table is empty.

    The JSON file remains the seed source; after this runs the DB is the source
    of truth and the editor writes to it. Order is preserved via `position`.
    """
    session = sessionmaker(bind=engine)()
    try:
        repo = RadioStationRepository(session)
        if repo.count() > 0:
            return
        with open(_stations_json_path(), 'r', encoding='utf-8') as f:
            stations = json.load(f).get('stations', [])
        for pos, s in enumerate(stations):
            slug = (s.get('id') or '').strip() or repo._unique_slug(s.get('name', 'station'))
            session.add(RadioStation(
                slug=slug,
                name=s.get('name', ''),
                description=s.get('description', '') or '',
                genre=s.get('genre', '') or '',
                url=s.get('url', ''),
                logo=s.get('logo'),
                content_type=s.get('content_type'),
                proxy=bool(s.get('proxy', False)),
                position=pos,
            ))
        session.commit()
        logger.info("Seeded %d radio stations from stations.json", len(stations))
    except FileNotFoundError:
        pass
    except Exception as e:
        session.rollback()
        logger.warning("Radio station seed failed: %s", e)
    finally:
        session.close()

# Initialize database on startup
with app.app_context():
    initialize_database()
    # Apply Tuya credentials from DB preferences (override env defaults if set)
    try:
        _db = get_db()
        _prefs = PreferencesRepository(_db).get_or_create()
        if _prefs.tuya_access_id:
            tuya_service.access_id = _prefs.tuya_access_id
        if _prefs.tuya_access_secret:
            tuya_service.access_secret = _prefs.tuya_access_secret
        if _prefs.tuya_api_region:
            tuya_service.api_region = _prefs.tuya_api_region
        _db.close()
    except Exception:
        pass

# Helper function to get database session
def get_db():
    Session = sessionmaker(bind=engine)
    return Session()

# Helper function to parse datetime from string
def parse_datetime(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        return None

# AI Intent Detection Helpers

def parse_date_from_text(text: str):
    """Parse date/time from natural language (Romanian + English)."""
    from datetime import time as dt_time
    text_lower = text.lower()
    now = datetime.now()

    base_date = None
    if any(kw in text_lower for kw in ['azi', 'today', 'astăzi', 'astazi']):
        base_date = now.date()
    elif any(kw in text_lower for kw in ['mâine', 'maine', 'tomorrow']):
        base_date = (now + timedelta(days=1)).date()
    elif any(kw in text_lower for kw in ['poimâine', 'poimaine', 'day after tomorrow']):
        base_date = (now + timedelta(days=2)).date()

    if base_date is None:
        return None

    time_match = re.search(r'(\d{1,2})[:\.](\d{2})', text)
    if time_match:
        hour, minute = int(time_match.group(1)), int(time_match.group(2))
        return datetime.combine(base_date, dt_time(hour=hour, minute=minute))

    return datetime.combine(base_date, dt_time(hour=12, minute=0))


def handle_add_task_intent(message: str, db):
    """Parse user message and create task. Returns (task_or_None, status_message)."""
    user_name = None
    for pattern in [
        r'(?:to user|pentru utilizatoru[l]?|pentru user[ul]?|user[ul]?)\s*[,:]?\s*([A-Za-zÀ-ÿ\-]+(?:[\s\-][A-Za-zÀ-ÿ\-]+)?)',
        r'(?:for|pentru)\s+([A-Za-zÀ-ÿ\-]+(?:[\s\-][A-Za-zÀ-ÿ\-]+)?)\s*[,:]',
    ]:
        m = re.search(pattern, message, re.IGNORECASE)
        if m:
            user_name = m.group(1).strip().rstrip(',').strip()
            break

    title = None
    for pattern in [
        r'title[:\s]+([^,\n]+?)(?:\s*,|\s*for\s|\s*azi|\s*today|\s*mâine|\s*tomorrow|$)',
        r'titlu[l]?[:\s]+([^,\n]+?)(?:\s*,|\s*for\s|\s*azi|\s*today|\s*mâine|\s*tomorrow|$)',
    ]:
        m = re.search(pattern, message, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            break

    scheduled_date = parse_date_from_text(message)

    if not user_name:
        return None, "Nu am putut identifica utilizatorul din mesaj. Specifică 'to user <Nume>'."
    if not title:
        return None, "Nu am putut identifica titlul taskului. Specifică 'title: <titlu>'."

    user_repo = UserRepository(db)
    users = user_repo.get_all()
    user = next(
        (u for u in users if user_name.lower() in u.name.lower() or u.name.lower() in user_name.lower()),
        None
    )
    if not user:
        available = ', '.join(u.name for u in users)
        return None, f"Utilizatorul '{user_name}' nu a fost găsit. Utilizatori disponibili: {available}"

    if not scheduled_date:
        scheduled_date = datetime.now().replace(second=0, microsecond=0) + timedelta(hours=1)

    task_repo = TaskRepository(db)
    task = task_repo.create(
        description=title,
        user_id=user.id,
        scheduled_date=scheduled_date
    )
    return task, f"Task '{task.description}' creat pentru {user.name} la {scheduled_date.strftime('%d.%m.%Y %H:%M')}."


# ── Radio voice/AI control ────────────────────────────────────────────────────
# These power "pune Radio ZU", "oprește radioul", "pune Kiss FM pe boxa din living"
# etc. The handler only *resolves* the command (which station, which Cast device,
# which verb); the actual playback runs in the browser, so we return a structured
# ``action_data`` that the frontend executes against the radio Pinia store.

_RADIO_DIACRITICS = str.maketrans({
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
})


def _radio_normalize(text: str) -> str:
    return (text or '').lower().translate(_RADIO_DIACRITICS)


def _match_radio_station(message: str, stations):
    """Best station whose name is mentioned in the message, or None.

    Prefers a full normalized-name match (longest wins); falls back to the most
    distinctive single word of a station name. Generic words like 'radio' or 'fm'
    never win on their own, so 'pune zu' resolves 'Radio ZU' but 'pune radio'
    does not pick an arbitrary station."""
    norm_msg = _radio_normalize(message)
    generic = {'radio', 'fm', 'post', 'postul', 'muzica', 'music', 'station'}

    best, best_score = None, 0
    for st in stations:
        name_norm = _radio_normalize(st.name)
        if name_norm and name_norm in norm_msg:
            if len(name_norm) > best_score:
                best, best_score = st, len(name_norm)
            continue
        for tok in re.findall(r'[a-z0-9]+', name_norm):
            if tok in generic or len(tok) < 3:
                continue
            if re.search(r'\b' + re.escape(tok) + r'\b', norm_msg) and len(tok) > best_score:
                best, best_score = st, len(tok)
    return best


def _match_cast_device(message: str):
    """Resolve a Google Cast device by friendly name mentioned in the message.
    Returns (device_id, device_name) or (None, None)."""
    norm_msg = _radio_normalize(message)
    try:
        devices = cast_service.get_devices().get('devices', [])
    except Exception:
        return None, None
    for d in devices:
        name_norm = _radio_normalize(d.get('name', ''))
        if not name_norm:
            continue
        if name_norm in norm_msg:
            return d.get('id'), d.get('name')
        for tok in re.findall(r'[a-z0-9]+', name_norm):
            if len(tok) >= 3 and re.search(r'\b' + re.escape(tok) + r'\b', norm_msg):
                return d.get('id'), d.get('name')
    return None, None


def handle_radio_intent(message: str, db):
    """Parse a radio-control command. Returns (action_data | None, context_string).

    A None action_data with empty context means "not a radio command" — the caller
    falls through to a normal chat. The action_data shape consumed by the frontend
    (frontend/src/stores/ai.ts):
        {'verb': 'play'|'stop'|'pause'|'next'|'prev'|'volume',
         'station_id': <slug>?, 'station_name': str?,
         'cast_target': <device_id>?, 'cast_name': str?, 'volume': int?}
    """
    msg = _radio_normalize(message)

    stop_kw = ['opreste radio', 'opreste muzica', 'opreste postul', 'inchide radio',
               'opreste', 'stop', 'taci']
    pause_kw = ['pauza', 'pause']
    next_kw = ['urmatorul post', 'urmatorul', 'schimba postul', 'alt post', 'next']
    prev_kw = ['postul anterior', 'postul precedent', 'inapoi', 'precedent', 'previous']
    play_kw = ['pune', 'porneste', 'reda', 'da drumul', 'asculta', 'play', 'deschide radio']

    vol_m = re.search(r'volum(?:ul)?\s*(?:la\s*)?(\d{1,3})', msg)
    if vol_m:
        v = max(0, min(100, int(vol_m.group(1))))
        return {'verb': 'volume', 'volume': v}, f"Setez volumul la {v}%."

    if any(k in msg for k in stop_kw):
        return {'verb': 'stop'}, "Am oprit radioul."
    if any(k in msg for k in pause_kw):
        return {'verb': 'pause'}, "Am pus radioul pe pauză."
    if any(k in msg for k in next_kw):
        return {'verb': 'next'}, "Trec la postul următor."
    if any(k in msg for k in prev_kw):
        return {'verb': 'prev'}, "Revin la postul anterior."

    if any(k in msg for k in play_kw):
        stations = RadioStationRepository(db).get_all()
        station = _match_radio_station(message, stations)
        has_radio_word = any(w in msg for w in ('radio', 'muzica', 'post'))
        # Guard against hijacking unrelated "pune ..." commands: only treat as a
        # radio play when a station matched or the user clearly said radio/music.
        if not station and not has_radio_word:
            return None, ""
        cast_id, cast_name = _match_cast_device(message)
        action = {'verb': 'play'}
        if station:
            action['station_id'] = station.slug
            action['station_name'] = station.name
        if cast_id:
            action['cast_target'] = cast_id
            action['cast_name'] = cast_name
        if not station:
            available = ', '.join(s.name for s in stations[:8])
            return action, f"Nu am identificat postul radio cerut. Posturi disponibile: {available}."
        where = f" pe {cast_name}" if cast_name else ""
        return action, f"Pornesc {station.name}{where}."

    return None, ""


def _detect_forecast_day(text: str):
    """
    Return how many days ahead the user is asking about, or None for today/current.
    Supports up to 4 days ahead (matching the 5-day display: today + 4).
    """
    text_lower = text.lower()
    if any(kw in text_lower for kw in ['poimâine', 'poimaine', 'day after tomorrow']):
        return 2
    if any(kw in text_lower for kw in ['mâine', 'maine', 'tomorrow']):
        return 1
    # "peste 3 zile" / "in 3 days"
    m = re.search(r'peste\s+(\d)\s+zile|in\s+(\d)\s+days?', text_lower)
    if m:
        n = int(m.group(1) or m.group(2))
        if 1 <= n <= 4:
            return n
    return None  # today / current


def handle_tuya_intent():
    """Read Tuya temperatures and return a formatted context string for Ollama."""
    try:
        data = tuya_service.get_temperatures()
        devices = data.get('devices', [])
        generated_at = data.get('generated_at', '')

        if not devices:
            return "Nu există date de temperatură disponibile din dispozitivele Tuya."

        lines = []
        for d in devices:
            name = d.get('name', 'Dispozitiv necunoscut')
            online = d.get('online', False)
            temp_current = d.get('temp_current')
            temp_set = d.get('temp_set')

            if temp_current is not None:
                status = f"{temp_current}°C"
                if temp_set is not None:
                    status += f" (setată: {temp_set}°C)"
                status += ", online" if online else ", offline"
            else:
                status = "offline" if not online else "fără senzor de temperatură"

            lines.append(f"- {name}: {status}")

        ts = ''
        if generated_at:
            try:
                dt = datetime.fromisoformat(generated_at)
                ts = f" (date actualizate la {dt.strftime('%d.%m.%Y %H:%M')})"
            except Exception:
                pass

        return "Temperaturi în locuință" + ts + ":\n" + "\n".join(lines)
    except Exception as e:
        return f"Nu am putut citi datele Tuya: {str(e)}"


def handle_weather_intent(message: str, db):
    """Fetch real weather data (current or forecast) and return context string for Ollama."""
    city_match = re.search(
        r'(?:în|in|la|pentru|from|at)\s+([A-Za-zÀ-ÿ\s\-]+?)(?:\s*[?\n,]|$)',
        message, re.IGNORECASE
    )
    city = city_match.group(1).strip() if city_match else None

    if not city:
        prefs_repo = PreferencesRepository(db)
        prefs = prefs_repo.get_or_create()
        city = prefs.weather_city or 'București'
    else:
        prefs_repo = PreferencesRepository(db)
        prefs = prefs_repo.get_or_create()

    lang = prefs.language or 'ro'

    days_ahead = _detect_forecast_day(message)

    try:
        if days_ahead is None:
            # Current weather
            d = weather_service.get_current_weather(city, lang=lang)
            return (
                f"Vremea actuală în {d['city']}, {d['country']}: "
                f"Temperatură: {d['temperature']}°C (se simte ca {d['feels_like']}°C), "
                f"Umiditate: {d['humidity']}%, Descriere: {d['description']}, "
                f"Vânt: {d['wind_speed']} m/s."
            )
        else:
            # Forecast — fetch enough days to cover the target day
            forecast = weather_service.get_forecast(city, days=days_ahead + 1, lang=lang)
            from datetime import date as dt_date
            target_date = (datetime.now() + timedelta(days=days_ahead)).date()
            day_data = next(
                (d for d in forecast['daily'] if d['date'] == target_date),
                None
            )
            if not day_data:
                return f"Nu am găsit prognoza pentru ziua solicitată în {forecast['city']}."
            label = {1: 'Mâine', 2: 'Poimâine'}.get(days_ahead, f'Peste {days_ahead} zile')
            return (
                f"Prognoza pentru {label} ({target_date.strftime('%d.%m.%Y')}) în {forecast['city']}, {forecast['country']}: "
                f"Temperatură min: {day_data['temp_min']}°C, max: {day_data['temp_max']}°C, medie: {day_data['temp_avg']}°C, "
                f"Umiditate: {day_data['humidity_avg']}%, Descriere: {day_data['description']}, "
                f"Vânt mediu: {day_data['wind_speed_avg']} m/s, Probabilitate precipitații: {round(day_data['pop_avg'] * 100)}%."
            )
    except Exception as e:
        return f"Nu am putut obține datele meteo: {str(e)}"


# ── SPA ──────────────────────────────────────────────────────────────────────
# Flask serves the built Vite bundle from frontend/dist. The bundle only needs
# its hashed assets (/assets/*) plus index.html; every other non-API path falls
# back to index.html so the client-side router (vue-router) can take over —
# including /calendar, /radio, /transport, /history and direct refreshes.

def _serve_spa_index():
    """Serve index.html with no-cache so a rebuilt bundle is never masked by a
    stale shell still pointing at chunk hashes that no longer exist."""
    resp = send_from_directory(FRONTEND_DIST, 'index.html')
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp


@app.route('/')
def index():
    return _serve_spa_index()


_ASSETS_DIR = os.path.join(FRONTEND_DIST, 'assets')


@app.route('/assets/<path:filename>')
def spa_assets(filename):
    # Asset filenames are content-hashed by Vite, so they can cache forever.
    # When Vite emitted precompressed siblings (.br / .gz via vite-plugin-compression)
    # and the client advertises support, serve those so RPi kiosk pays less bandwidth.
    accept = request.headers.get('Accept-Encoding', '')
    for ext, enc in (('.br', 'br'), ('.gz', 'gzip')):
        if enc in accept and os.path.isfile(os.path.join(_ASSETS_DIR, filename + ext)):
            resp = send_from_directory(_ASSETS_DIR, filename + ext)
            # Preserve the underlying content-type (JS/CSS) — Flask would otherwise
            # report it as application/gzip / application/octet-stream.
            if filename.endswith('.js'):
                resp.headers['Content-Type'] = 'application/javascript'
            elif filename.endswith('.css'):
                resp.headers['Content-Type'] = 'text/css'
            elif filename.endswith('.svg'):
                resp.headers['Content-Type'] = 'image/svg+xml'
            resp.headers['Content-Encoding'] = enc
            resp.headers['Vary'] = 'Accept-Encoding'
            return resp
    return send_from_directory(_ASSETS_DIR, filename)


@app.errorhandler(404)
def spa_fallback(err):
    """Serve index.html for unknown non-API paths so vue-router can handle them.

    Real /api/* paths still get a genuine 404 instead of the SPA shell.
    """
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return _serve_spa_index()


@app.route('/api/test')
def test():
    db = get_db()
    try:
        user_repo = UserRepository(db)
        users = user_repo.get_all()
        return jsonify({
            'message': 'HomeTasks API is running',
            'users_count': len(users),
            'users': [{'id': u.id, 'name': u.name, 'color': u.color} for u in users]
        })
    finally:
        db.close()

# Weather endpoints
@app.route('/api/weather/current', methods=['GET'])
def get_current_weather():
    try:
        city = request.args.get('city')
        db = get_db()
        try:
            prefs_repo = PreferencesRepository(db)
            prefs = prefs_repo.get_or_create()
            if not city:
                city = prefs.weather_city or 'București'
            lang = prefs.language or 'ro'
        finally:
            db.close()

        weather_data = weather_service.get_current_weather(city, lang=lang)

        return jsonify({
            'city': weather_data['city'],
            'country': weather_data['country'],
            'temperature': weather_data['temperature'],
            'feels_like': weather_data['feels_like'],
            'humidity': weather_data['humidity'],
            'description': weather_data['description'],
            'icon': weather_data['icon'],
            'wind_speed': weather_data['wind_speed'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    try:
        # Get city from query params, preferences, or use default
        city = request.args.get('city')
        db = get_db()
        try:
            prefs_repo = PreferencesRepository(db)
            prefs = prefs_repo.get_or_create()
            if not city:
                city = prefs.weather_city or 'București'
            lang = prefs.language or 'ro'
        finally:
            db.close()

        days = request.args.get('days', 7, type=int)

        # Validate days
        if days < 1 or days > 7:
            return jsonify({'error': 'Days must be between 1 and 7'}), 400

        forecast_data = weather_service.get_forecast(city, days, lang=lang)
        
        return jsonify({
            'city': forecast_data['city'],
            'country': forecast_data['country'],
            'daily': [{
                'date': day['date'].isoformat(),
                'temp_min': day['temp_min'],
                'temp_max': day['temp_max'],
                'temp_avg': day['temp_avg'],
                'humidity_avg': day['humidity_avg'],
                'description': day['description'],
                'icon': day['icon'],
                'icon_url': weather_service.get_weather_icon_url(day['icon']),
                'wind_speed_avg': day['wind_speed_avg'],
                'pop_avg': day['pop_avg']
            } for day in forecast_data['daily']],
            'hourly': [{
                'datetime': hour['datetime'].isoformat(),
                'temperature': hour['temperature'],
                'feels_like': hour['feels_like'],
                'humidity': hour['humidity'],
                'pressure': hour['pressure'],
                'description': hour['description'],
                'icon': hour['icon'],
                'icon_url': weather_service.get_weather_icon_url(hour['icon']),
                'wind_speed': hour['wind_speed'],
                'wind_direction': hour['wind_direction'],
                'pop': hour['pop']
            } for hour in forecast_data['hourly']],
            'timestamp': forecast_data['timestamp'].isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# AI assistant endpoints (provider-agnostic, resolved per request via the factory)
def _build_system_prompt(action_context: str = None) -> str:
    """Build the HomeTasks assistant system prompt, mirroring the prior client.

    ``action_context`` (the result of an executed intent) is appended the same
    way the old OllamaClient did, so model behavior is unchanged.
    """
    system_content = (
        "You are a helpful assistant for HomeTasks, a family task management application. "
        "You help users manage tasks, get weather information, and answer questions. "
        "Keep your responses concise, helpful, and in the same language as the user's message."
    )
    if action_context:
        system_content += (
            f"\n\nContext from executed action: {action_context}. "
            "Use this information to formulate your response."
        )
    return system_content


def _as_float(value, default: float) -> float:
    """Best-effort float coercion, falling back to ``default`` on bad input."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value, default: int) -> int:
    """Best-effort int coercion (tolerates ``\"500\"`` and ``500.0``)."""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _coerce_history(raw, limit: int = 5):
    """Normalize a client-supplied chat history into provider turns.

    The frontend sends its recent messages so context survives even when the
    server runs multiple workers or restarts between turns (the in-memory
    singleton can't be shared across processes). Accepts a list of
    ``{role, content|text}`` dicts, maps the UI's ``'ai'`` role to
    ``'assistant'``, keeps only non-empty user/assistant turns, and returns at
    most the last ``limit``. Anything malformed is dropped so a bad payload
    can't break the chat route.
    """
    if not isinstance(raw, list):
        return []
    turns = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = 'assistant' if item.get('role') == 'ai' else item.get('role')
        content = item.get('content') or item.get('text')
        if role in ('user', 'assistant') and content:
            turns.append({'role': role, 'content': str(content)})
    return turns[-limit:]


@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400

        message = data['message']
        temperature = data.get('temperature')
        max_tokens = data.get('max_tokens')
        # Recent turns supplied by the client (robust to multi-worker / restarts).
        recent_history = _coerce_history(data.get('history'))

        action_result = None
        action_context = None
        action_data = None

        db = get_db()
        try:
            prefs_repo = PreferencesRepository(db)
            prefs = prefs_repo.get_or_create()
            if temperature is None:
                temperature = prefs.ai_temperature or 0.7
            if max_tokens is None:
                max_tokens = prefs.ai_max_tokens or 500
            # Coerce to real numbers: the request body / prefs may carry strings
            # (HTML inputs serialize as text), but strict cloud providers reject a
            # string temperature/max_tokens (Ollama tolerated it).
            temperature = _as_float(temperature, 0.7)
            max_tokens = _as_int(max_tokens, 500)

            # Resolve the provider while prefs is loaded; it captures the
            # base_url/model now and needs no DB access afterwards.
            provider = get_provider(prefs)

            message_lower = message.lower()

            # Detect add-task intent
            task_keywords = ['add task', 'adaugă task', 'adauga task', 'add new task',
                             'adaugă un task', 'adauga un task', 'create task', 'nou task']
            if any(kw in message_lower for kw in task_keywords):
                task, action_context = handle_add_task_intent(message, db)
                if task:
                    db.commit()
                    action_result = 'task_created'
                else:
                    action_result = 'task_error'

            # Detect Tuya/home temperature intent (before weather to take priority)
            elif any(kw in message_lower for kw in [
                'termostat', 'termostatul', 'incalzire', 'încălzire', 'incalzit', 'încălzit',
                'temperatura acas', 'temperatura in casa', 'temperatura din casa',
                'temperatura camera', 'temperatura camerei', 'temperatura din',
                'temp acas', 'tuya', 'dispozitive', 'senzori', 'dormitor', 'living',
                'bucatarie', 'bucătărie', 'birou', 'irigati', 'caldura', 'căldură'
            ]):
                action_context = handle_tuya_intent()
                action_result = 'tuya_data'

            # Detect weather intent
            elif any(kw in message_lower for kw in
                     ['vreme', 'weather', 'temperatura', 'temperature', 'meteo', 'forecast', 'prognoza', 'prognoză']):
                action_context = handle_weather_intent(message, db)
                action_result = 'weather_data'

            # Detect radio-control intent ("pune Radio ZU", "oprește radioul", …).
            # handle_radio_intent self-guards and returns (None, "") for non-radio
            # phrases, so a broad trigger here is safe.
            elif any(kw in message_lower for kw in [
                'radio', 'muzica', 'muzică', 'post', 'asculta', 'ascultă', 'pune',
                'pornește', 'porneste', 'oprește', 'opreste', 'reda', 'redă',
                'pauză', 'pauza', 'volum', 'play', 'stop', 'urmatorul', 'următorul'
            ]):
                action_data, action_context = handle_radio_intent(message, db)
                if action_data is not None or action_context:
                    action_result = 'radio_control'
                else:
                    action_context = None  # not actually a radio command

        except Exception as e:
            db.rollback()
            action_context = f"Acțiunea a eșuat: {str(e)}"
            action_result = 'error'
        finally:
            db.close()

        # If the AI provider is unavailable, return the action result directly
        if not provider.is_available():
            if action_context or action_data:
                return jsonify({'response': action_context or '', 'action': action_result,
                                'action_data': action_data, 'model': 'none', 'done': True})
            return jsonify({'error': 'AI provider is not running or not accessible'}), 503

        # Providers are stateless: context comes from the client's recent turns
        # when supplied, otherwise from the shared in-memory history manager.
        messages = [{'role': 'system', 'content': _build_system_prompt(action_context)}]
        if recent_history:
            messages.extend(recent_history)
            messages.append({'role': 'user', 'content': message})
        else:
            conversation_history.add('user', message)
            messages.extend(conversation_history.messages())

        result = provider.chat(messages, temperature=temperature, max_tokens=max_tokens)

        assistant_message = result.get("message", {}).get("content", "")
        if not recent_history:
            conversation_history.add('assistant', assistant_message)

        return jsonify({
            'response': assistant_message,
            'model': result.get('model', ''),
            'created_at': result.get('created_at', ''),
            'done': result.get('done', False),
            'action': action_result,
            'action_data': action_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/models', methods=['GET'])
def get_available_models():
    db = get_db()
    try:
        prefs = PreferencesRepository(db).get_or_create()
        provider_id = request.args.get('provider') or active_provider_id(prefs)
        # Dynamic fetch with curated static fallback (never 503s on a down backend).
        models = get_models_for(provider_id, prefs)
        return jsonify({
            'provider': provider_id,
            'models': [{'name': m['name'], 'size': m.get('size', 0)} for m in models]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    db = get_db()
    try:
        prefs = PreferencesRepository(db).get_or_create()
        provider_id = active_provider_id(prefs)
        provider = get_provider(prefs)
        is_running = provider.is_available()
        model_info = {}
        if is_running:
            try:
                models = provider.get_models()
                model_info = {'available_models': [m['name'] for m in models]}
            except Exception:
                model_info = {'error': 'Could not fetch model info'}

        return jsonify({
            'server_running': is_running,
            'active_provider': provider_id,
            'current_model': getattr(provider, 'model', getattr(prefs, 'ai_model', '')),
            'base_url': getattr(provider, 'base_url', ''),
            'configured_providers': configured_providers(prefs),
            **model_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# User endpoints
@app.route('/api/users', methods=['GET'])
def get_users():
    db = get_db()
    try:
        user_repo = UserRepository(db)
        users = user_repo.get_all()
        return jsonify([{
            'id': u.id,
            'name': u.name,
            'color': u.color,
            'created_at': u.created_at.isoformat() if u.created_at else None
        } for u in users])
    finally:
        db.close()

@app.route('/api/users', methods=['POST'])
def create_user():
    db = get_db()
    try:
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({'error': 'Name is required'}), 400
        
        user_repo = UserRepository(db)
        user = user_repo.create(
            name=data['name'],
            color=data.get('color', '#3498db')
        )
        return jsonify({
            'id': user.id,
            'name': user.name,
            'color': user.color,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    db = get_db()
    try:
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'id': user.id,
            'name': user.name,
            'color': user.color,
            'created_at': user.created_at.isoformat() if user.created_at else None
        })
    finally:
        db.close()

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    db = get_db()
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user_repo = UserRepository(db)
        user = user_repo.update(user_id, **data)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'id': user.id,
            'name': user.name,
            'color': user.color,
            'created_at': user.created_at.isoformat() if user.created_at else None
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    db = get_db()
    try:
        user_repo = UserRepository(db)
        success = user_repo.delete(user_id)
        if not success:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# Task endpoints
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    db = get_db()
    try:
        # Get query parameters
        user_id = request.args.get('user_id', type=int)
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates
        parsed_start_date = parse_datetime(start_date) if start_date else None
        parsed_end_date = parse_datetime(end_date) if end_date else None
        
        # Parse status if provided
        parsed_status = None
        if status:
            try:
                parsed_status = TaskStatus(status)
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        task_repo = TaskRepository(db)
        tasks = task_repo.get_all(
            user_id=user_id,
            status=parsed_status,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )

        task_ids = [t.id for t in tasks]
        comment_counts = {
            row.task_id: row.count
            for row in db.query(Comment.task_id, func.count(Comment.id).label('count'))
                         .filter(Comment.task_id.in_(task_ids))
                         .group_by(Comment.task_id).all()
        } if task_ids else {}

        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'user_name': t.user.name if t.user else None,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None,
            'comment_count': comment_counts.get(t.id, 0)
        } for t in tasks])
    finally:
        db.close()

@app.route('/api/tasks', methods=['POST'])
def create_task():
    db = get_db()
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        if 'description' not in data:
            return jsonify({'error': 'Description is required'}), 400
        if 'user_id' not in data:
            return jsonify({'error': 'User ID is required'}), 400
        if 'scheduled_date' not in data:
            return jsonify({'error': 'Scheduled date is required'}), 400
        
        # Parse scheduled date
        scheduled_date = parse_datetime(data['scheduled_date'])
        if not scheduled_date:
            return jsonify({'error': 'Invalid scheduled date format'}), 400
        
        # Parse recurrence if provided
        recurrence_pattern = RecurrencePattern.NONE
        if 'recurrence_pattern' in data:
            try:
                recurrence_pattern = RecurrencePattern(data['recurrence_pattern'])
            except ValueError:
                return jsonify({'error': 'Invalid recurrence pattern'}), 400
        
        recurrence_end_date = None
        if 'recurrence_end_date' in data and data['recurrence_end_date']:
            recurrence_end_date = parse_datetime(data['recurrence_end_date'])
        
        task_repo = TaskRepository(db)
        task = task_repo.create(
            description=data['description'],
            user_id=data['user_id'],
            scheduled_date=scheduled_date,
            recurrence_pattern=recurrence_pattern,
            recurrence_end_date=recurrence_end_date
        )
        
        return jsonify({
            'id': task.id,
            'description': task.description,
            'user_id': task.user_id,
            'status': task.status.value if task.status else None,
            'scheduled_date': task.scheduled_date.isoformat() if task.scheduled_date else None,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None,
            'recurrence_pattern': task.recurrence_pattern.value if task.recurrence_pattern else None,
            'recurrence_end_date': task.recurrence_end_date.isoformat() if task.recurrence_end_date else None
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    db = get_db()
    try:
        task_repo = TaskRepository(db)
        task = task_repo.get_by_id(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify({
            'id': task.id,
            'description': task.description,
            'user_id': task.user_id,
            'status': task.status.value if task.status else None,
            'scheduled_date': task.scheduled_date.isoformat() if task.scheduled_date else None,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None,
            'recurrence_pattern': task.recurrence_pattern.value if task.recurrence_pattern else None,
            'recurrence_end_date': task.recurrence_end_date.isoformat() if task.recurrence_end_date else None
        })
    finally:
        db.close()

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    db = get_db()
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Handle status conversion if provided
        if 'status' in data:
            try:
                data['status'] = TaskStatus(data['status'])
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        # Handle recurrence_pattern conversion if provided
        if 'recurrence_pattern' in data:
            try:
                data['recurrence_pattern'] = RecurrencePattern(data['recurrence_pattern'])
            except ValueError:
                return jsonify({'error': 'Invalid recurrence pattern'}), 400
        
        # Handle date conversions
        if 'scheduled_date' in data and data['scheduled_date']:
            data['scheduled_date'] = parse_datetime(data['scheduled_date'])
            if not data['scheduled_date']:
                return jsonify({'error': 'Invalid scheduled date format'}), 400
        
        if 'recurrence_end_date' in data and data['recurrence_end_date']:
            data['recurrence_end_date'] = parse_datetime(data['recurrence_end_date'])
        
        task_repo = TaskRepository(db)
        task = task_repo.update(task_id, **data)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        return jsonify({
            'id': task.id,
            'description': task.description,
            'user_id': task.user_id,
            'status': task.status.value if task.status else None,
            'scheduled_date': task.scheduled_date.isoformat() if task.scheduled_date else None,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None,
            'recurrence_pattern': task.recurrence_pattern.value if task.recurrence_pattern else None,
            'recurrence_end_date': task.recurrence_end_date.isoformat() if task.recurrence_end_date else None
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    db = get_db()
    try:
        task_repo = TaskRepository(db)
        success = task_repo.delete(task_id)
        if not success:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify({'message': 'Task deleted successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# Special task endpoints
@app.route('/api/tasks/today', methods=['GET'])
def get_today_tasks():
    db = get_db()
    try:
        task_repo = TaskRepository(db)
        tasks = task_repo.get_today_tasks()

        task_ids = [t.id for t in tasks]
        comment_counts = {
            row.task_id: row.count
            for row in db.query(Comment.task_id, func.count(Comment.id).label('count'))
                         .filter(Comment.task_id.in_(task_ids))
                         .group_by(Comment.task_id).all()
        } if task_ids else {}

        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'user_name': t.user.name if t.user else None,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None,
            'comment_count': comment_counts.get(t.id, 0)
        } for t in tasks])
    finally:
        db.close()

@app.route('/api/tasks/upcoming', methods=['GET'])
def get_upcoming_tasks():
    db = get_db()
    try:
        days = request.args.get('days', 7, type=int)
        task_repo = TaskRepository(db)
        tasks = task_repo.get_upcoming_tasks(days=days)

        task_ids = [t.id for t in tasks]
        comment_counts = {
            row.task_id: row.count
            for row in db.query(Comment.task_id, func.count(Comment.id).label('count'))
                         .filter(Comment.task_id.in_(task_ids))
                         .group_by(Comment.task_id).all()
        } if task_ids else {}

        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern != None else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None,
            'comment_count': comment_counts.get(t.id, 0)
        } for t in tasks])
    finally:
        db.close()

# Preferences endpoints
@app.route('/api/preferences', methods=['GET'])
def get_preferences():
    db = get_db()
    try:
        prefs_repo = PreferencesRepository(db)
        prefs = prefs_repo.get_or_create()
        return jsonify({
            'id': prefs.id,
            'language': prefs.language,
            'date_format': prefs.date_format,
            'time_format': prefs.time_format,
            'weather_city': prefs.weather_city,
            'weather_units': prefs.weather_units,
            'weather_update_interval': prefs.weather_update_interval,
            'ai_enabled': bool(prefs.ai_enabled),
            'ai_provider': prefs.ai_provider or os.getenv('AI_PROVIDER', 'ollama'),
            'ollama_base_url': prefs.ollama_base_url,
            'ai_model': prefs.ai_model,
            'ai_temperature': prefs.ai_temperature,
            'ai_max_tokens': prefs.ai_max_tokens,
            'openrouter_api_key': prefs.openrouter_api_key or os.getenv('OPENROUTER_API_KEY', ''),
            'groq_api_key': prefs.groq_api_key or os.getenv('GROQ_API_KEY', ''),
            'gemini_api_key': prefs.gemini_api_key or os.getenv('GEMINI_API_KEY', ''),
            'mistral_api_key': prefs.mistral_api_key or os.getenv('MISTRAL_API_KEY', ''),
            'voice_language': prefs.voice_language,
            'voice_sensitivity': prefs.voice_sensitivity,
            'voice_auto_start': prefs.voice_auto_start,
            'voice_mic_device': prefs.voice_mic_device or '',
            'voice_activation_word': os.getenv('VOICE_ACTIVATION_WORD', 'Hey HomeTasks').strip() or 'Hey HomeTasks',
            'voice_debug_log': os.getenv('VOICE_DEBUG_LOG', '').strip().lower() in ('1', 'true', 'yes'),
            'tuya_enabled': bool(prefs.tuya_enabled),
            'tuya_access_id': prefs.tuya_access_id or os.getenv('TUYA_ACCESS_ID', ''),
            'tuya_access_secret': prefs.tuya_access_secret or os.getenv('TUYA_ACCESS_SECRET', ''),
            'tuya_api_region': prefs.tuya_api_region or os.getenv('TUYA_API_REGION', 'eu'),
        })
    finally:
        db.close()

@app.route('/api/preferences', methods=['PUT'])
def update_preferences():
    db = get_db()
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        prefs_repo = PreferencesRepository(db)
        prefs = prefs_repo.get_or_create()
        
        # Update only the fields that were provided
        for key, value in data.items():
            if hasattr(prefs, key):
                setattr(prefs, key, value)
        
        db.commit()

        # Apply dynamic settings to live services. AI provider settings need no
        # live mutation: get_provider(prefs) reads them fresh on every request.
        if 'language' in data or 'weather_city' in data:
            weather_service.cache.clear()
        if any(k in data for k in ('tuya_access_id', 'tuya_access_secret', 'tuya_api_region')):
            tuya_service.access_id = prefs.tuya_access_id or tuya_service.access_id
            tuya_service.access_secret = prefs.tuya_access_secret or tuya_service.access_secret
            tuya_service.api_region = prefs.tuya_api_region or tuya_service.api_region

        return jsonify({
            'id': prefs.id,
            'language': prefs.language,
            'date_format': prefs.date_format,
            'time_format': prefs.time_format,
            'weather_city': prefs.weather_city,
            'weather_units': prefs.weather_units,
            'weather_update_interval': prefs.weather_update_interval,
            'ai_enabled': bool(prefs.ai_enabled),
            'ai_provider': prefs.ai_provider or os.getenv('AI_PROVIDER', 'ollama'),
            'ollama_base_url': prefs.ollama_base_url,
            'ai_model': prefs.ai_model,
            'ai_temperature': prefs.ai_temperature,
            'ai_max_tokens': prefs.ai_max_tokens,
            'openrouter_api_key': prefs.openrouter_api_key or os.getenv('OPENROUTER_API_KEY', ''),
            'groq_api_key': prefs.groq_api_key or os.getenv('GROQ_API_KEY', ''),
            'gemini_api_key': prefs.gemini_api_key or os.getenv('GEMINI_API_KEY', ''),
            'mistral_api_key': prefs.mistral_api_key or os.getenv('MISTRAL_API_KEY', ''),
            'voice_language': prefs.voice_language,
            'voice_sensitivity': prefs.voice_sensitivity,
            'voice_auto_start': prefs.voice_auto_start,
            'voice_mic_device': prefs.voice_mic_device or '',
            'voice_activation_word': os.getenv('VOICE_ACTIVATION_WORD', 'Hey HomeTasks').strip() or 'Hey HomeTasks',
            'voice_debug_log': os.getenv('VOICE_DEBUG_LOG', '').strip().lower() in ('1', 'true', 'yes'),
            'tuya_enabled': bool(prefs.tuya_enabled),
            'tuya_access_id': prefs.tuya_access_id or os.getenv('TUYA_ACCESS_ID', ''),
            'tuya_access_secret': prefs.tuya_access_secret or os.getenv('TUYA_ACCESS_SECRET', ''),
            'tuya_api_region': prefs.tuya_api_region or os.getenv('TUYA_API_REGION', 'eu'),
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# Comment endpoints
@app.route('/api/tasks/<int:task_id>/comments', methods=['GET'])
def get_comments(task_id):
    db = get_db()
    try:
        comment_repo = CommentRepository(db)
        comments = comment_repo.get_by_task_id(task_id)
        return jsonify([{
            'id': c.id,
            'text': c.text,
            'task_id': c.task_id,
            'user_id': c.user_id,
            'created_at': c.created_at.isoformat() if c.created_at else None
        } for c in comments])
    finally:
        db.close()

@app.route('/api/tasks/<int:task_id>/comments', methods=['POST'])
def add_comment(task_id):
    db = get_db()
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        if 'user_id' not in data:
            return jsonify({'error': 'User ID is required'}), 400

        comment_repo = CommentRepository(db)
        comment = comment_repo.create(
            text=data['text'],
            task_id=task_id,
            user_id=data['user_id']
        )
        return jsonify({
            'id': comment.id,
            'text': comment.text,
            'task_id': comment.task_id,
            'user_id': comment.user_id,
            'created_at': comment.created_at.isoformat() if comment.created_at else None
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# Voice debug log (for kiosk debugging when console is not visible)
@app.route('/api/voice-debug-log', methods=['POST'])
def voice_debug_log():
    """Append a voice debug message to logs/voice-debug.log. Enabled when VOICE_DEBUG_LOG=1 in .env."""
    if not os.getenv('VOICE_DEBUG_LOG', '').strip().lower() in ('1', 'true', 'yes'):
        return jsonify({'ok': False, 'reason': 'disabled'}), 200
    try:
        data = request.get_json() or {}
        msg = data.get('message', '').strip()
        if not msg:
            return jsonify({'ok': False}), 400
        log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, 'voice-debug.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.now().isoformat()} {msg}\n")
        return jsonify({'ok': True}), 200
    except Exception as e:
        logger.warning("Voice debug log write failed: %s", e)
        return jsonify({'ok': False}), 500

# Server-side microphone: record on this machine and return transcript (for RPi kiosk when browser STT fails)
@app.route('/api/voice/listen', methods=['POST'])
def voice_listen():
    """Record from server microphone and return recognized text. Blocking for a few seconds."""
    try:
        if not getattr(voice_service, 'speech_recognition_available', False):
            return jsonify({'available': False, 'text': None, 'error': 'Server speech recognition not available (install SpeechRecognition and PyAudio)'}), 200
        data = request.get_json() or {}
        language = (data.get('language') or '').strip() or None
        # The mic device always comes from saved preferences (kiosk has no .env access).
        db = get_db()
        try:
            prefs = PreferencesRepository(db).get_or_create()
            if not language:
                language = (prefs.voice_language or 'ro-RO').strip() or 'ro-RO'
            device = (prefs.voice_mic_device or '').strip() or None
        finally:
            db.close()
        text, err = voice_service.record_and_recognize_once(language=language, timeout_seconds=6, phrase_time_limit=8, device=device)
        return jsonify({'available': True, 'text': text, 'error': err})
    except Exception as e:
        logger.exception("voice/listen failed")
        return jsonify({'available': True, 'text': None, 'error': str(e)}), 200

def _server_tts_available():
    """Check if server can generate TTS audio (for kiosk playback via HTML5 Audio)."""
    try:
        import gtts  # noqa: F401
        return True
    except ImportError:
        return False


@app.route('/api/voice/server-available', methods=['GET'])
def voice_server_available():
    """Check if server-side microphone recognition and TTS are available."""
    mic_avail = getattr(voice_service, 'speech_recognition_available', False)
    tts_avail = _server_tts_available()
    return jsonify({'available': mic_avail, 'tts_available': tts_avail})


@app.route('/api/voice/microphones', methods=['GET'])
def voice_microphones():
    """List capture devices so the kiosk can pick the mic from Settings (no .env)."""
    available = getattr(voice_service, 'speech_recognition_available', False)
    devices = voice_service.list_microphones() if available else []
    db = get_db()
    try:
        selected = (PreferencesRepository(db).get_or_create().voice_mic_device or '').strip()
    finally:
        db.close()
    return jsonify({'available': available, 'devices': devices, 'selected': selected})


@app.route('/api/voice/speak', methods=['POST'])
def voice_speak():
    """Generate TTS audio and return as MP3. Used in kiosk so playback goes through ALSA (same as YouTube)."""
    if not _server_tts_available():
        return jsonify({'error': 'Server TTS not available (install gtts)'}), 503
    try:
        data = request.get_json() or {}
        text = (data.get('text') or '').strip()
        if not text:
            return jsonify({'error': 'text is required'}), 400
        lang = (data.get('lang') or 'ro-RO').strip()
        # gTTS: ro-RO -> ro, en-US -> en, en-GB -> en
        if lang.startswith('ro'):
            gtts_lang = 'ro'
        elif lang.startswith('en'):
            gtts_lang = 'en'
        else:
            gtts_lang = lang.split('-')[0] if '-' in lang else lang
        from gtts import gTTS
        import io
        buf = io.BytesIO()
        tts = gTTS(text=text, lang=gtts_lang)
        tts.write_to_fp(buf)
        buf.seek(0)
        return send_file(buf, mimetype='audio/mpeg', as_attachment=False, download_name='tts.mp3')
    except Exception as e:
        logger.exception("voice/speak failed")
        return jsonify({'error': str(e)}), 500

# Voice command endpoint
@app.route('/api/voice-command', methods=['POST'])
def voice_command():
    try:
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({'error': 'Command is required'}), 400
        
        command = data['command'].lower().strip()
        logger.info(f"Received voice command: {command}")
        
        # Process the command
        response = process_voice_command(command)
        
        return jsonify({
            'command': command,
            'response': response,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        return jsonify({'error': str(e)}), 500

def process_voice_command(command: str) -> str:
    """
    Process voice commands and route to appropriate actions.
    
    Args:
        command: The voice command text
        
    Returns:
        Response message
    """
    # Check for task-related commands
    if 'adaugă task' in command or 'add task' in command:
        # Extract task description (simple implementation)
        description = command.replace('adaugă task', '').replace('add task', '').strip()
        if description:
            # In a real implementation, we would parse date/time etc.
            # For now, we'll create a task for today
            return f"Am înțeles că vrei să adaugi taskul: '{description}'. Această funcționalitate va fi completă în curând."
        else:
            return "Nu am înțeles ce task vrei să adaugi. Poți repeta și specifica descrierea taskului?"
    
    # Check for weather queries
    elif 'vreme' in command or 'weather' in command:
        if 'azi' in command or 'today' in command:
            return "Vremea astăzi este soarelui cu 25°C. Vorbeste cu ma assistant pentru prognoza detaliată."
        else:
            return "Pentru informații despre vreme, te rog să întrebi: 'Care e vremea astăzi?'"
    
    # Check for AI queries
    elif 'ai' in command or 'inteligență artificială' in command or 'chat' in command:
        query = command.replace('ai', '').replace('inteligență artificială', '').replace('chat', '').strip()
        if query:
            return f"Am trimis întrebarea ta către AI: '{query}'. Răspunsul va apărea în fereastra de chat."
        else:
            return "Ce vrei să întrebi AI-ul?"
    
    # Check for task list queries
    elif 'taskuri' in command or 'tasks' in command:
        if 'azi' in command or 'today' in command:
            return "Ai 3 taskuri pentru astăzi: Cumpără pâine, După dușman, Pregătește cină."
        else:
            return "Poți să întrebi: 'Care sunt taskurile de astăzi?'"
    
    # Default response for unrecognized commands
    else:
        return f"Nu am înțeles comanda: '{command}'. Încearcă să spui ceva precum 'adaugă task cumpără pâine' sau 'care e vremea astăzi?'."


# ── Tuya ─────────────────────────────────────────────────────────────────────

@app.route('/api/tuya/temperatures')
def get_tuya_temperatures():
    """Return current temperatures from cached tuya_devices.json."""
    try:
        data = tuya_service.get_temperatures()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error reading Tuya temperatures: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/tuya/refresh', methods=['POST'])
def refresh_tuya():
    """Fetch fresh data from Tuya Cloud and update tuya_devices.json."""
    try:
        result = tuya_service.refresh_from_cloud()
        if 'error' in result:
            return jsonify(result), 502
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error refreshing Tuya data: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/radio/stations')
def get_radio_stations():
    db = get_db()
    try:
        stations = [s.to_dict() for s in RadioStationRepository(db).get_all()]
        return jsonify({'stations': stations})
    except Exception as e:
        logger.error(f"Error loading radio stations: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


def _validate_station_payload(data, *, partial=False):
    """Return (cleaned_dict, error_msg). On create, name and url are required."""
    if not isinstance(data, dict):
        return None, 'corp invalid'
    cleaned = {}
    for key in RadioStationRepository.EDITABLE:
        if key in data:
            cleaned[key] = data[key]
    if not partial:
        if not (cleaned.get('name') or '').strip():
            return None, 'name este obligatoriu'
        if not (cleaned.get('url') or '').strip():
            return None, 'url este obligatoriu'
    if 'proxy' in cleaned:
        cleaned['proxy'] = bool(cleaned['proxy'])
    # Normalize optional strings: blank content_type/logo become NULL.
    for key in ('logo', 'content_type'):
        if key in cleaned and not (cleaned[key] or '').strip():
            cleaned[key] = None
    return cleaned, None


@app.route('/api/radio/stations', methods=['POST'])
def create_radio_station():
    db = get_db()
    try:
        cleaned, err = _validate_station_payload(request.get_json(silent=True))
        if err:
            return jsonify({'error': err}), 400
        station = RadioStationRepository(db).create(cleaned)
        return jsonify(station.to_dict()), 201
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating radio station: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/radio/stations/reorder', methods=['POST'])
def reorder_radio_stations():
    db = get_db()
    try:
        data = request.get_json(silent=True) or {}
        order = data.get('order')
        if not isinstance(order, list):
            return jsonify({'error': 'order trebuie să fie o listă de id-uri'}), 400
        stations = RadioStationRepository(db).reorder([str(s) for s in order])
        return jsonify({'stations': [s.to_dict() for s in stations]})
    except Exception as e:
        db.rollback()
        logger.error(f"Error reordering radio stations: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/radio/stations/<station_id>', methods=['PUT'])
def update_radio_station(station_id):
    db = get_db()
    try:
        cleaned, err = _validate_station_payload(request.get_json(silent=True), partial=True)
        if err:
            return jsonify({'error': err}), 400
        station = RadioStationRepository(db).update(station_id, cleaned)
        if not station:
            return jsonify({'error': 'station not found'}), 404
        return jsonify(station.to_dict())
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating radio station: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/radio/stations/<station_id>', methods=['DELETE'])
def delete_radio_station(station_id):
    db = get_db()
    try:
        if not RadioStationRepository(db).delete(station_id):
            return jsonify({'error': 'station not found'}), 404
        return jsonify({'message': 'deleted'}), 200
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting radio station: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# In-memory cache for ICY metadata: { url: (timestamp, title_or_None) }
_icy_cache = {}
_ICY_CACHE_TTL = 15  # seconds

# In-memory cache for probed Cast content types: { station_id: (timestamp, mime) }
_cast_ct_cache = {}
_CAST_CT_TTL = 3600  # seconds — stream codec rarely changes


def _fetch_icy_metadata(stream_url: str, timeout: float = 5.0):
    """Fetch ICY StreamTitle from a Shoutcast/Icecast audio stream.

    Returns the current title string, or None if not available.
    """
    import requests as _requests
    try:
        resp = _requests.get(
            stream_url,
            headers={'Icy-MetaData': '1', 'User-Agent': 'HomeTasks/1.0'},
            stream=True,
            timeout=timeout,
        )
        metaint = resp.headers.get('icy-metaint') or resp.headers.get('Icy-Metaint')
        if not metaint:
            resp.close()
            return None
        metaint = int(metaint)
        # Skip metaint bytes of audio, then read 1-byte length prefix + metadata.
        raw = resp.raw
        audio = raw.read(metaint)
        if len(audio) < metaint:
            resp.close()
            return None
        length_byte = raw.read(1)
        if not length_byte:
            resp.close()
            return None
        meta_len = length_byte[0] * 16
        if meta_len <= 0:
            resp.close()
            return None
        meta_bytes = raw.read(meta_len)
        resp.close()
        meta = meta_bytes.rstrip(b'\x00').decode('utf-8', errors='replace')
        m = re.search(r"StreamTitle='([^']*)'", meta)
        if not m:
            return None
        title = m.group(1).strip()
        return title or None
    except Exception as e:
        logger.debug(f"ICY metadata fetch failed for {stream_url}: {e}")
        return None


@app.route('/api/radio/proxy/<station_id>')
def radio_proxy(station_id):
    """Server-side proxy for stations that browsers can't reach directly
    (CORS, non-standard ports, mixed-content, SSL quirks). Pipes the upstream
    audio bytes to the client."""
    import requests as _requests

    db = get_db()
    try:
        station_row = RadioStationRepository(db).get_by_slug(station_id)
        station = station_row.to_dict() if station_row else None
    finally:
        db.close()

    if not station or not station.get('url'):
        return jsonify({'error': 'station not found'}), 404

    upstream_url = station['url']
    try:
        upstream = _requests.get(
            upstream_url,
            stream=True,
            timeout=10,
            headers={'User-Agent': 'HomeTasks/1.0', 'Icy-MetaData': '0'},
        )
    except Exception as e:
        logger.error(f"Radio proxy upstream failed for {station_id}: {e}")
        return jsonify({'error': 'upstream unreachable'}), 502

    # Hand the Cast receiver a MIME it understands: Shoutcast's audio/aacp would
    # otherwise make it error and recover only after a long retry.
    content_type = _normalize_audio_mime(upstream.headers.get('Content-Type')) or 'audio/mpeg'

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        except GeneratorExit:
            pass
        except Exception as e:
            logger.debug(f"Radio proxy stream interrupted for {station_id}: {e}")
        finally:
            upstream.close()

    headers = {
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
    }
    return Response(stream_with_context(generate()), mimetype=content_type, headers=headers)


@app.route('/api/radio/now-playing')
def get_radio_now_playing():
    """Return current track title (ICY StreamTitle) for a given station id."""
    station_id = request.args.get('id', '').strip()
    if not station_id:
        return jsonify({'error': 'id is required'}), 400

    db = get_db()
    try:
        station = RadioStationRepository(db).get_by_slug(station_id)
        url = station.url if station else None
        found = station is not None
    finally:
        db.close()

    if not found:
        return jsonify({'error': 'station not found'}), 404

    if not url:
        return jsonify({'title': None})

    now = datetime.now().timestamp()
    cached = _icy_cache.get(url)
    if cached and (now - cached[0]) < _ICY_CACHE_TTL:
        return jsonify({'title': cached[1]})

    title = _fetch_icy_metadata(url)
    _icy_cache[url] = (now, title)
    return jsonify({'title': title})


# ── Cast (Google Cast / Mi Smart Speaker) ─────────────────────────────────────

@app.route('/api/cast/devices')
def get_cast_devices():
    """Return cached Google Cast devices discovered on the LAN.

    Discovery is started lazily here (idempotent) so the background thread runs
    inside the gunicorn worker that serves requests — not the preloaded master,
    where a thread would not survive the fork. The first call may return an
    empty list while the initial scan window (~5s) completes.
    """
    cast_service.start()
    return jsonify(cast_service.get_devices())


def _load_radio_stations():
    """Return all stations (ordered) as plain dicts in the public shape."""
    db = get_db()
    try:
        return [s.to_dict() for s in RadioStationRepository(db).get_all()]
    finally:
        db.close()


def _guess_audio_content_type(url):
    """Best-effort MIME for a radio stream URL. Cast wants a concrete type."""
    u = (url or '').lower()
    if u.endswith('.m3u8'):
        return 'application/vnd.apple.mpegurl'
    if u.endswith('.ogg') or u.endswith('.oga'):
        return 'audio/ogg'
    if 'aac' in u:  # .aac / .aacp / ...aacp?…
        return 'audio/aac'
    return 'audio/mpeg'  # mp3 and the safe default


def _normalize_audio_mime(ct):
    """Map Shoutcast/ICY content types onto the MIME the Cast receiver expects.
    Returns None for unknown/opaque types so the caller can fall back to a
    URL-based guess. ``audio/aacp`` in particular is a Shoutcast-ism the Cast
    media player rejects — it wants plain ``audio/aac``."""
    if not ct:
        return None
    ct = ct.split(';')[0].strip().lower()
    if ct in ('audio/aacp', 'audio/x-aac', 'audio/aac'):
        return 'audio/aac'
    if ct in ('audio/mpeg', 'audio/mp3', 'audio/mpg'):
        return 'audio/mpeg'
    if ct in ('', 'application/octet-stream', 'text/html'):
        return None  # opaque — let the caller guess from the URL instead
    return ct


def _cast_content_type(station):
    """Concrete MIME to announce to the Cast device on LOAD.

    Announcing the wrong type (e.g. ``audio/mpeg`` for an AAC stream like Radio
    România Actualități or Radio ZU, whose URLs give no hint) makes the receiver
    error out and recover only after a long retry. Order of preference:

    1. explicit ``content_type`` in stations.json — authoritative, no network;
    2. a guess from the URL extension;
    3. for proxied stations only, a short cached upstream probe as last resort."""
    explicit = _normalize_audio_mime(station.get('content_type'))
    if explicit:
        return explicit

    guess = _guess_audio_content_type(station.get('url'))
    if not station.get('proxy'):
        return guess

    now = datetime.now().timestamp()
    cached = _cast_ct_cache.get(station['id'])
    if cached and (now - cached[0]) < _CAST_CT_TTL:
        return cached[1]

    import requests as _requests
    try:
        r = _requests.get(
            station['url'], stream=True, timeout=4,
            headers={'User-Agent': 'HomeTasks/1.0', 'Icy-MetaData': '0'},
        )
        try:
            ct = _normalize_audio_mime(r.headers.get('Content-Type')) or guess
        finally:
            r.close()
    except Exception as e:
        logger.debug("Cast content-type probe failed for %s: %s", station.get('id'), e)
        ct = guess
    _cast_ct_cache[station['id']] = (now, ct)
    return ct


def _detect_lan_ip():
    """Best-effort: the LAN IP this machine routes out on (no packets sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def _cast_base_url():
    """LAN-reachable base URL for HomeTasks, used to build proxy stream URLs the
    Cast device fetches. CAST_PUBLIC_BASE_URL if set; otherwise the request host,
    except a loopback host (localhost/127.0.0.1) is replaced with the machine's
    real LAN IP — the speaker would never reach a loopback address."""
    env = os.getenv('CAST_PUBLIC_BASE_URL', '').strip()
    if env:
        return env.rstrip('/')

    parsed = urlparse(request.host_url)
    host = parsed.hostname or ''
    if host in ('localhost', '127.0.0.1', '0.0.0.0', '::1'):
        ip = _detect_lan_ip()
        if ip:
            scheme = parsed.scheme or 'http'
            port = parsed.port or 5000
            return f'{scheme}://{ip}:{port}'
    return request.host_url.rstrip('/')


def _proxy_url_for(station_id):
    return _cast_base_url() + '/api/radio/proxy/' + station_id


@app.route('/api/cast/play', methods=['POST'])
def cast_play():
    """Tell a Cast device to play a radio station. Body: {device_id, station_id}.

    Tries the station's direct URL first, then falls back to our LAN proxy if
    the device can't play it (odd TLS/port/codec). Stations flagged ``proxy``
    skip straight to the proxy."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    station_id = (data.get('station_id') or '').strip()
    if not device_id or not station_id:
        return jsonify({'error': 'device_id și station_id sunt obligatorii'}), 400

    try:
        stations = _load_radio_stations()
    except Exception as e:
        return jsonify({'error': f'Nu pot citi stațiile: {e}'}), 500

    station = next((s for s in stations if s.get('id') == station_id), None)
    if not station or not station.get('url'):
        return jsonify({'error': 'Stația nu a fost găsită'}), 404

    content_type = _cast_content_type(station)
    if station.get('proxy'):
        attempts = [('proxy', _proxy_url_for(station_id))]
    else:
        attempts = [('direct', station['url']), ('proxy', _proxy_url_for(station_id))]

    last_err = None
    for route, url in attempts:
        try:
            # Direct attempt fails fast on a receiver error so we fall back to the
            # proxy in ~1s; the proxy attempt gets the tolerant flap window.
            cast_service.play_url(
                device_id, url, content_type, title=station.get('name'),
                tolerate_flap=(route != 'direct'),
            )
            return jsonify({
                'ok': True, 'device_id': device_id, 'station_id': station_id,
                'url': url, 'route': route,
            })
        except Exception as e:
            last_err = e
            logger.warning("Cast play via %s failed for %s: %s", route, station_id, e)

    return jsonify({'error': str(last_err) if last_err else 'cast a eșuat'}), 502


@app.route('/api/cast/stop', methods=['POST'])
def cast_stop():
    """Stop playback on a Cast device. Body: {device_id}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    if not device_id:
        return jsonify({'error': 'device_id este obligatoriu'}), 400
    try:
        cast_service.stop(device_id)
        return jsonify({'ok': True, 'device_id': device_id})
    except Exception as e:
        logger.warning("Cast stop failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/cast/volume', methods=['POST'])
def cast_volume():
    """Set a Cast device's volume. Body: {device_id, volume: 0.0-1.0}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    volume = data.get('volume')
    if not device_id or volume is None:
        return jsonify({'error': 'device_id și volume sunt obligatorii'}), 400
    try:
        volume = float(volume)
    except (TypeError, ValueError):
        return jsonify({'error': 'volume trebuie să fie un număr între 0.0 și 1.0'}), 400
    try:
        applied = cast_service.set_volume(device_id, volume)
        return jsonify({'ok': True, 'device_id': device_id, 'volume': applied})
    except Exception as e:
        logger.warning("Cast volume failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/cast/status')
def cast_status():
    """Return current playback/volume state for a device. Query: ?device_id=..."""
    device_id = (request.args.get('device_id') or '').strip()
    if not device_id:
        return jsonify({'error': 'device_id este obligatoriu'}), 400
    try:
        return jsonify(cast_service.status(device_id))
    except Exception as e:
        logger.warning("Cast status failed: %s", e)
        return jsonify({'error': str(e)}), 502


# ── Bluetooth A2DP output (RPi is the player) ────────────────────────────────────
# Inverse of Cast: here the RPi fetches + decodes the stream and pushes it into a
# BlueZ A2DP sink (see src/bt/service.py and docs/audio-streaming.ro.md). The
# `station['url']` is consumed locally by mpv, so the LAN-proxy / CAST_PUBLIC_BASE_URL
# machinery the Cast path needs does not apply.

@app.route('/api/output/bt/devices')
def bt_devices():
    """Return paired Bluetooth speakers ({id, name, connected}). Linux/RPi only —
    degrades to an empty list + friendly error elsewhere."""
    return jsonify(bluetooth_service.get_devices())


@app.route('/api/output/bt/play', methods=['POST'])
def bt_play():
    """Play a radio station on a Bluetooth speaker. Body: {device_id, station_id}.

    mpv decodes any codec, so we hand it the station's direct URL — the `proxy`
    flag exists only for browser CORS/mixed-content limits, which don't apply to a
    local player on the RPi."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    station_id = (data.get('station_id') or '').strip()
    if not device_id or not station_id:
        return jsonify({'error': 'device_id și station_id sunt obligatorii'}), 400

    try:
        stations = _load_radio_stations()
    except Exception as e:
        return jsonify({'error': f'Nu pot citi stațiile: {e}'}), 500

    station = next((s for s in stations if s.get('id') == station_id), None)
    if not station or not station.get('url'):
        return jsonify({'error': 'Stația nu a fost găsită'}), 404

    try:
        bluetooth_service.play(
            device_id, station['url'], title=station.get('name'), station_id=station_id,
        )
        return jsonify({
            'ok': True, 'device_id': device_id, 'station_id': station_id,
            'url': station['url'],
        })
    except Exception as e:
        logger.warning("BT play failed for %s: %s", station_id, e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/output/bt/stop', methods=['POST'])
def bt_stop():
    """Stop the Bluetooth player subprocess. Body: {device_id}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    if not device_id:
        return jsonify({'error': 'device_id este obligatoriu'}), 400
    try:
        bluetooth_service.stop(device_id)
        return jsonify({'ok': True, 'device_id': device_id})
    except Exception as e:
        logger.warning("BT stop failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/output/bt/volume', methods=['POST'])
def bt_volume():
    """Set the Bluetooth sink volume. Body: {device_id, volume: 0.0-1.0}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    volume = data.get('volume')
    if not device_id or volume is None:
        return jsonify({'error': 'device_id și volume sunt obligatorii'}), 400
    try:
        volume = float(volume)
    except (TypeError, ValueError):
        return jsonify({'error': 'volume trebuie să fie un număr între 0.0 și 1.0'}), 400
    try:
        applied = bluetooth_service.set_volume(device_id, volume)
        return jsonify({'ok': True, 'device_id': device_id, 'volume': applied})
    except Exception as e:
        logger.warning("BT volume failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/output/bt/status')
def bt_status():
    """Player state + ICY now-playing title. Query: ?device_id=..."""
    device_id = (request.args.get('device_id') or '').strip()
    try:
        st = bluetooth_service.status(device_id)
    except Exception as e:
        logger.warning("BT status failed: %s", e)
        return jsonify({'error': str(e)}), 502

    # Merge the now-playing title from the same ICY source the local path uses.
    title = None
    station_id = st.get('station_id')
    if st.get('state') == 'playing' and station_id:
        db = get_db()
        try:
            station = RadioStationRepository(db).get_by_slug(station_id)
            url = station.url if station else None
        finally:
            db.close()
        if url:
            title = _fetch_icy_metadata(url)
    st['title'] = title
    return jsonify(st)


@app.route('/api/output/bt/scan', methods=['POST'])
def bt_scan():
    """Run a bounded discovery window and return known + discovered devices for
    the pairing UI. Body: {timeout?: seconds}. RPi only."""
    data = request.get_json(silent=True) or {}
    timeout = data.get('timeout', 10)
    try:
        return jsonify(bluetooth_service.scan(timeout))
    except Exception as e:
        logger.warning("BT scan failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/output/bt/pair', methods=['POST'])
def bt_pair():
    """Pair + trust + connect a speaker. Body: {device_id}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    if not device_id:
        return jsonify({'error': 'device_id este obligatoriu'}), 400
    try:
        return jsonify({'ok': True, **bluetooth_service.pair(device_id)})
    except Exception as e:
        logger.warning("BT pair failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/output/bt/remove', methods=['POST'])
def bt_remove():
    """Forget (unpair) a speaker. Body: {device_id}."""
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    if not device_id:
        return jsonify({'error': 'device_id este obligatoriu'}), 400
    try:
        return jsonify({'ok': True, **bluetooth_service.remove(device_id)})
    except Exception as e:
        logger.warning("BT remove failed: %s", e)
        return jsonify({'error': str(e)}), 502


# ── Wi-Fi (RPi self-configuration via NetworkManager) ────────────────────────────
# Lets the kiosk join a Wi-Fi network from the Settings UI without a shell. Thin
# wrapper over `nmcli` (see src/wifi/service.py). Linux/RPi only — degrades to a
# friendly "unavailable" elsewhere so the frontend can hide the option.

@app.route('/api/wifi/status')
def wifi_status():
    """Return {available, connected, ssid, ip} for the RPi's Wi-Fi."""
    try:
        return jsonify(wifi_service.status())
    except Exception as e:
        logger.warning("Wi-Fi status failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/wifi/scan', methods=['POST'])
def wifi_scan():
    """Scan for nearby networks. Returns {networks, available, error}. RPi only."""
    return jsonify(wifi_service.scan())


@app.route('/api/wifi/connect', methods=['POST'])
def wifi_connect():
    """Join a network. Body: {ssid, password?, hidden?}."""
    data = request.get_json(silent=True) or {}
    ssid = (data.get('ssid') or '').strip()
    password = data.get('password') or None
    hidden = bool(data.get('hidden', False))
    if not ssid:
        return jsonify({'error': 'ssid este obligatoriu'}), 400
    try:
        return jsonify({'ok': True, **wifi_service.connect(ssid, password, hidden)})
    except Exception as e:
        logger.warning("Wi-Fi connect failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/wifi/disconnect', methods=['POST'])
def wifi_disconnect():
    """Disconnect the active Wi-Fi device (saved profile kept)."""
    try:
        return jsonify({'ok': True, **wifi_service.disconnect()})
    except Exception as e:
        logger.warning("Wi-Fi disconnect failed: %s", e)
        return jsonify({'error': str(e)}), 502


@app.route('/api/transport/routes')
def get_transport_routes():
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'autobus')
    routes = []
    for filename in sorted(os.listdir(data_dir)):
        if filename.endswith('.json'):
            filepath = os.path.join(data_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                routes.append(json.load(f))
    return jsonify(routes)


@app.route('/api/transport/chat', methods=['POST'])
def transport_chat():
    try:
        data = request.get_json()
        message = data.get('message', '')
        route_dir = data.get('route', '')
        station = data.get('station', '')
        day_type = data.get('dayType', 'Lucru')
        current_time = data.get('currentTime', '')
        # Recent turns supplied by the client give the conversation context.
        recent_history = _coerce_history(data.get('history'))

        context_parts = [
            "Ești asistentul oficial pentru transportul public din zona Popești-Leordeni - București.",
            f"Ora curentă: {current_time}. Tip de zi: {day_type}.",
            f"Context din interfață - rută selectată: {route_dir or '(niciuna)'}, stație selectată: {station or '(niciuna)'}.",
            "AI ACCES COMPLET la programul de plecări de mai jos, extras din baza de date a aplicației. "
            "Răspunde DIRECT folosind aceste date - NU trimite utilizatorul către programul oficial, alte surse sau site-uri externe; tu ești sursa oficială. "
            "Dacă întrebarea nu menționează explicit linia sau stația, presupune că se referă la ruta și stația selectate din interfață (de mai sus). "
            "Pentru «primul autobuz» folosește prima oră din program, pentru «ultimul» pe ultima. Afișează orele în format HH:MM. "
            "Dacă pentru stația/linia cerută nu apar ore mai jos, spune clar că nu ai datele pentru acea stație și cere o stație din liste. "
            "Răspunde concis, în română.",
        ]

        # Schedules are per-station, so include the selected station plus any
        # station the user named in the message — otherwise a question about a
        # station other than the one selected in the UI has no times in context
        # and the model wrongly deflects to "consult the official schedule".
        msg_upper = message.upper()

        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'autobus')
        for filename in sorted(os.listdir(data_dir)):
            if not filename.endswith('.json'):
                continue
            with open(os.path.join(data_dir, filename), 'r', encoding='utf-8') as f:
                rd = json.load(f)
            context_parts.append(
                f"Linia {rd['route']} ({rd['direction']}): stații: {', '.join(rd['stations_order'])}."
            )
            deps = rd.get('departures', {})
            relevant = [s for s in rd['stations_order']
                        if s in deps and (s == station or s in msg_upper)]
            for st_name in relevant:
                st_sched = deps[st_name].get(day_type, {})
                for key, hours in st_sched.items():
                    if key in ('first_checkpoint', 'second_checkpoint') or not isinstance(hours, dict):
                        continue
                    times = [f"{int(h):02d}:{','.join(mins)}"
                             for h, mins in sorted(hours.items(), key=lambda x: int(x[0]))]
                    if not times:
                        continue
                    label = 'sosiri' if key == 'arrival_times' else f"plecări spre {key}"
                    context_parts.append(
                        f"Linia {rd['route']} - {label} din stația {st_name} ({day_type}): {'; '.join(times[:40])}"
                    )

        transport_context = "\n".join(context_parts)

        db = get_db()
        try:
            prefs = PreferencesRepository(db).get_or_create()
            provider = get_provider(prefs)
        finally:
            db.close()

        if not provider.is_available():
            return jsonify({
                'response': 'Serviciul AI nu este disponibil momentan. Verificați programul direct în interfață.',
                'done': True
            })

        # Use the transport context directly as the system prompt: wrapping it in
        # the generic HomeTasks prompt framed the schedule as secondary "action
        # context", which made the model deflect instead of answering from it.
        # Conversation context comes from the client's recent turns (providers
        # are stateless).
        messages = [{'role': 'system', 'content': transport_context}]
        messages.extend(recent_history)
        messages.append({'role': 'user', 'content': message})
        result = provider.chat(messages, temperature=0.3, max_tokens=500)

        return jsonify({
            'response': result.get('message', {}).get('content', ''),
            'done': result.get('done', False)
        })
    except Exception as e:
        logger.error(f"Transport chat error: {e}")
        return jsonify({'error': str(e)}), 500


# ── Calendar ─────────────────────────────────────────────────────────────────

def _parse_user_ids(raw: str):
    if not raw:
        return None
    ids = []
    for piece in raw.split(','):
        piece = piece.strip()
        if not piece:
            continue
        try:
            ids.append(int(piece))
        except ValueError:
            continue
    return ids or None


def _candidate_tasks_for_range(db, start_date, end_date, user_ids):
    """Fetch tasks that could have an occurrence inside [start_date, end_date].

    Recurring tasks count if they started before/at end_date and either have
    no recurrence_end_date or end at/after start_date. Non-recurring tasks
    count only if scheduled_date is inside the range.
    """
    from task_manager.models import RecurrencePattern as RP

    is_recurring = and_(
        Task.recurrence_pattern.isnot(None),
        Task.recurrence_pattern != RP.NONE,
    )
    is_non_recurring = or_(
        Task.recurrence_pattern.is_(None),
        Task.recurrence_pattern == RP.NONE,
    )

    query = db.query(Task).filter(
        Task.scheduled_date <= end_date,
        or_(
            and_(is_non_recurring, Task.scheduled_date >= start_date),
            and_(
                is_recurring,
                or_(
                    Task.recurrence_end_date.is_(None),
                    Task.recurrence_end_date >= start_date,
                ),
            ),
        ),
    )
    if user_ids:
        query = query.filter(Task.user_id.in_(user_ids))
    return query.all()


@app.route('/api/calendar/month', methods=['GET'])
def calendar_month():
    try:
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid year/month'}), 400

    if not (1 <= month <= 12):
        return jsonify({'error': 'Month out of range'}), 400

    user_ids = _parse_user_ids(request.args.get('user_ids', ''))

    import calendar as _cal
    start_date = datetime(year, month, 1)
    last_day = _cal.monthrange(year, month)[1]
    end_date = datetime(year, month, last_day, 23, 59, 59)

    db = get_db()
    try:
        tasks = _candidate_tasks_for_range(db, start_date, end_date, user_ids)
        occurrences = expand_recurring_tasks(tasks, start_date, end_date)

        users = UserRepository(db).get_all()
        users_payload = [{'id': u.id, 'name': u.name, 'color': u.color} for u in users]

        days = {}
        for occ in occurrences:
            key = occ['scheduled_date'].date().isoformat()
            days.setdefault(key, []).append({
                'task_id': occ['task_id'],
                'description': occ['description'],
                'user_id': occ['user_id'],
                'user_name': occ['user_name'],
                'user_color': occ['user_color'],
                'status': occ['status'],
                'scheduled_date': occ['scheduled_date'].isoformat(),
                'recurrence_pattern': occ['recurrence_pattern'],
                'is_recurring_instance': occ['is_recurring_instance'],
            })

        return jsonify({
            'year': year,
            'month': month,
            'users': users_payload,
            'days': days,
        })
    finally:
        db.close()


@app.route('/api/calendar/year', methods=['GET'])
def calendar_year():
    try:
        year = int(request.args.get('year', datetime.now().year))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid year'}), 400

    user_ids = _parse_user_ids(request.args.get('user_ids', ''))

    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    db = get_db()
    try:
        tasks = _candidate_tasks_for_range(db, start_date, end_date, user_ids)
        occurrences = expand_recurring_tasks(tasks, start_date, end_date)

        users = UserRepository(db).get_all()
        user_map = {u.id: {'id': u.id, 'name': u.name, 'color': u.color} for u in users}

        # date_key -> {user_id -> count}
        days_user_counts = {}
        days_total = {}
        for occ in occurrences:
            key = occ['scheduled_date'].date().isoformat()
            uid = occ['user_id']
            days_user_counts.setdefault(key, {})
            days_user_counts[key][uid] = days_user_counts[key].get(uid, 0) + 1
            days_total[key] = days_total.get(key, 0) + 1

        days_payload = {}
        for key, user_counts in days_user_counts.items():
            days_payload[key] = {
                'total': days_total[key],
                'users': [
                    {
                        'user_id': uid,
                        'user_color': (user_map.get(uid) or {}).get('color', '#64748b'),
                        'user_name': (user_map.get(uid) or {}).get('name', ''),
                        'count': cnt,
                    }
                    for uid, cnt in user_counts.items()
                ],
            }

        return jsonify({
            'year': year,
            'users': list(user_map.values()),
            'days': days_payload,
        })
    finally:
        db.close()


# ── In-app logs (kiosk has no terminal) ─────────────────────────────────────────

@app.route('/api/logs')
def api_logs():
    """Return one day's server log records as JSON. Query: date=YYYY-MM-DD
    (default today), level=WARNING|INFO|... (default all), limit (default 500)."""
    import logging as _logging
    date = (request.args.get('date') or '').strip() or None
    level_name = (request.args.get('level') or '').strip().upper()
    level = _logging.getLevelName(level_name) if level_name else _logging.NOTSET
    if not isinstance(level, int):
        level = _logging.NOTSET
    try:
        limit = min(max(int(request.args.get('limit', 500)), 1), 5000)
    except (TypeError, ValueError):
        limit = 500
    days = logbuf.available_days()
    return jsonify({
        'date': date or (days[0] if days else None),
        'days': days,
        'retention_days': logbuf.RETENTION_DAYS,
        'records': logbuf.read_records(date, level=level, limit=limit),
    })


@app.route('/logs')
def logs_page():
    """Plain, self-contained log viewer served directly by Flask (no SPA rebuild
    needed). Registered as a real route so it wins over the SPA 404 fallback."""
    return Response(_LOGS_HTML, mimetype='text/html')


_LOGS_HTML = """<!doctype html>
<html lang="ro"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HomeTasks — Loguri</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.4 -apple-system, Segoe UI, Roboto, sans-serif;
         background: #0f172a; color: #e2e8f0; }
  header { position: sticky; top: 0; background: #1e293b; padding: 10px 12px;
           display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
           border-bottom: 1px solid #334155; }
  h1 { font-size: 15px; margin: 0 8px 0 0; }
  select, button { font: inherit; padding: 8px 10px; border-radius: 8px;
                   border: 1px solid #475569; background: #334155; color: #e2e8f0; cursor: pointer; }
  button.on { background: #6d28d9; border-color: #6d28d9; }
  .lvl { display: inline-flex; gap: 4px; }
  .spacer { flex: 1; }
  main { padding: 8px 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid #1e293b;
       font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap;
       word-break: break-word; }
  td.t { color: #64748b; white-space: nowrap; }
  td.g { color: #38bdf8; white-space: nowrap; }
  tr.ERROR td.l, tr.CRITICAL td.l { color: #f87171; font-weight: 700; }
  tr.WARNING td.l { color: #fbbf24; font-weight: 700; }
  tr.INFO td.l { color: #34d399; }
  tr.DEBUG td.l { color: #94a3b8; }
  td.l { white-space: nowrap; }
  .empty { color: #64748b; padding: 24px; text-align: center; }
</style></head><body>
<header>
  <h1>Loguri</h1>
  <select id="day"></select>
  <span class="lvl">
    <button data-lvl="" class="on">Toate</button>
    <button data-lvl="INFO">Info+</button>
    <button data-lvl="WARNING">Avert+</button>
    <button data-lvl="ERROR">Erori</button>
  </span>
  <div class="spacer"></div>
  <button id="auto" class="on">Auto ⟳</button>
  <button id="refresh">Reîmprospătează</button>
</header>
<main><table id="tbl"><tbody></tbody></table><div id="empty" class="empty" hidden></div></main>
<script>
  let level = '', auto = true, timer = null;
  const daySel = document.getElementById('day');
  const tbody = document.querySelector('#tbl tbody');
  const empty = document.getElementById('empty');
  function esc(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  async function load(){
    const params = new URLSearchParams();
    if (daySel.value) params.set('date', daySel.value);
    if (level) params.set('level', level);
    let data;
    try { data = await (await fetch('/api/logs?' + params)).json(); }
    catch(e){ return; }
    if (!daySel.options.length && data.days){
      for (const d of data.days){ const o=document.createElement('option'); o.value=o.textContent=d; daySel.appendChild(o); }
    }
    const atBottom = Math.abs(window.innerHeight + window.scrollY - document.body.scrollHeight) < 40;
    tbody.innerHTML = (data.records || []).map(r =>
      `<tr class="${esc(r.level)}"><td class="t">${esc(r.time)}</td>`+
      `<td class="l">${esc(r.level)}</td><td class="g">${esc(r.logger)}</td>`+
      `<td>${esc(r.message)}</td></tr>`).join('');
    const n = (data.records || []).length;
    empty.hidden = n > 0; empty.textContent = n ? '' : 'Niciun log pentru filtrul curent.';
    if (atBottom) window.scrollTo(0, document.body.scrollHeight);
  }
  function schedule(){ clearInterval(timer); if (auto) timer = setInterval(load, 3000); }
  document.querySelectorAll('[data-lvl]').forEach(b => b.onclick = () => {
    level = b.dataset.lvl;
    document.querySelectorAll('[data-lvl]').forEach(x => x.classList.toggle('on', x === b));
    load();
  });
  daySel.onchange = load;
  document.getElementById('refresh').onclick = load;
  document.getElementById('auto').onclick = e => {
    auto = !auto; e.target.classList.toggle('on', auto); schedule();
  };
  load(); schedule();
</script>
</body></html>"""


if __name__ == '__main__':
    # threaded=True so a long-lived radio proxy stream (e.g. cast fallback) does
    # not block other requests on the single-process dev server.
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)