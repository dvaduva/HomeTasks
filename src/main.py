from flask import Flask, jsonify, request, render_template
import logging
import os

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
from task_manager.database import create_tables, engine
from task_manager.models import Base, User, Task, Comment, Preferences, TaskStatus, RecurrencePattern
from task_manager.repository import UserRepository, TaskRepository, CommentRepository, PreferencesRepository
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import json
from weather.service import WeatherService
from ollama.client import ollama_client
from voice.service import voice_service

# Load environment variables
load_dotenv()

app = Flask(__name__, 
            template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates'),
            static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static'))
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

# Initialize database on startup
with app.app_context():
    initialize_database()

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

# Routes
@app.route('/')
def index():
    return render_template('base.html')

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
        # Get city from query params or use default
        city = request.args.get('city', 'București')  # Default to București
        weather_data = weather_service.get_current_weather(city)
        
        # Get icon URL
        icon_url = weather_service.get_weather_icon_url(weather_data['icon'])
        
        return jsonify({
            'city': weather_data['city'],
            'country': weather_data['country'],
            'temperature': weather_data['temperature'],
            'feels_like': weather_data['feels_like'],
            'humidity': weather_data['humidity'],
            'pressure': weather_data['pressure'],
            'description': weather_data['description'],
            'icon': weather_data['icon'],
            'icon_url': icon_url,
            'wind_speed': weather_data['wind_speed'],
            'wind_direction': weather_data['wind_direction'],
            'sunrise': weather_data['sunrise'].isoformat() if weather_data['sunrise'] else None,
            'sunset': weather_data['sunset'].isoformat() if weather_data['sunset'] else None,
            'timestamp': weather_data['timestamp'].isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    try:
        # Get parameters
        city = request.args.get('city', 'București')  # Default to București
        days = request.args.get('days', 7, type=int)
        
        # Validate days
        if days < 1 or days > 7:
            return jsonify({'error': 'Days must be between 1 and 7'}), 400
        
        forecast_data = weather_service.get_forecast(city, days)
        
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

# Ollama AI endpoints
@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        message = data['message']
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 500)
        
        # Check if Ollama server is running
        if not ollama_client.is_server_running():
            return jsonify({'error': 'Ollama server is not running or not accessible'}), 503
        
        # Get response from Ollama
        result = ollama_client.chat(message, temperature=temperature, max_tokens=max_tokens)
        
        # Extract the response content
        assistant_message = result.get("message", {}).get("content", "")
        
        return jsonify({
            'response': assistant_message,
            'model': result.get('model', ''),
            'created_at': result.get('created_at', ''),
            'done': result.get('done', False)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/models', methods=['GET'])
def get_available_models():
    try:
        # Check if Ollama server is running
        if not ollama_client.is_server_running():
            return jsonify({'error': 'Ollama server is not running or not accessible'}), 503
        
        models = ollama_client.get_models()
        return jsonify({
            'models': [{'name': model['name'], 'size': model.get('size', 0)} for model in models]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    try:
        is_running = ollama_client.is_server_running()
        model_info = {}
        if is_running:
            try:
                models = ollama_client.get_models()
                model_info = {
                    'current_model': ollama_client.model,
                    'available_models': [m['name'] for m in models]
                }
            except:
                model_info = {'error': 'Could not fetch model info'}
        
        return jsonify({
            'server_running': is_running,
            'current_model': ollama_client.model,
            'base_url': ollama_client.base_url,
            **model_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
            'created_at': u.created_at.isoformat() if u.created_at else None
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
        
        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None
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
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None
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
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None
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
        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None
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
        return jsonify([{
            'id': t.id,
            'description': t.description,
            'user_id': t.user_id,
            'status': t.status.value if t.status else None,
            'scheduled_date': t.scheduled_date.isoformat() if t.scheduled_date else None,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'recurrence_pattern': t.recurrence_pattern.value if t.recurrence_pattern != None else None,
            'recurrence_end_date': t.recurrence_end_date.isoformat() if t.recurrence_end_date else None
        } for t in tasks])
    finally:
        db.close()

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)