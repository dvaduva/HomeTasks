from flask import Flask, jsonify
import os
from dotenv import load_dotenv
from task_manager.database import create_tables, engine
from task_manager.models import Base, User, Task, Comment, Preferences
from task_manager.repository import UserRepository, TaskRepository, CommentRepository, PreferencesRepository
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

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

@app.route('/')
def hello():
    return 'Hello, HomeTasks!'

@app.route('/api/test')
def test():
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        user_repo = UserRepository(session)
        users = user_repo.get_all()
        return jsonify({
            'message': 'HomeTasks API is running',
            'users_count': len(users),
            'users': [{'id': u.id, 'name': u.name, 'color': u.color} for u in users]
        })
    finally:
        session.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)