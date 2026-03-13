from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class TaskStatus(enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REFUSED = "refused"

class RecurrencePattern(enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), default='#3498db')  # Default blue color
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tasks = relationship("Task", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.name}>"

class Task(Base):
    __tablename__ = 'tasks'
    
    id = Column(Integer, primary_key=True)
    description = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    scheduled_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Recurrence fields
    recurrence_pattern = Column(Enum(RecurrencePattern), default=RecurrencePattern.NONE)
    recurrence_end_date = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="tasks")
    comments = relationship("Comment", back_populates="task")
    
    def __repr__(self):
        return f"<Task {self.description[:50]}...>"

class Comment(Base):
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    task = relationship("Task", back_populates="comments")
    user = relationship("User", back_populates="comments")
    
    def __repr__(self):
        return f"<Comment {self.text[:30]}...>"

class Preferences(Base):
    __tablename__ = 'preferences'

    id = Column(Integer, primary_key=True)
    # Application preferences
    language = Column(String(10), default='ro')  # ro, en
    date_format = Column(String(20), default='short')
    time_format = Column(String(5), default='24')
    # Weather settings
    weather_city = Column(String(100), default='București')
    weather_units = Column(String(20), default='metric')  # metric, imperial
    weather_update_interval = Column(Integer, default=30)
    # AI settings
    ollama_base_url = Column(String(200), default='http://localhost:11434')
    ai_model = Column(String(50), default='llama3:8b')
    ai_temperature = Column(Float, default=0.7)
    ai_max_tokens = Column(Integer, default=500)
    # Voice settings
    voice_language = Column(String(10), default='ro-RO')  # ro-RO, en-US, en-GB
    voice_sensitivity = Column(Float, default=0.5)
    voice_auto_start = Column(Boolean, default=False)
    # Updated timestamp
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return "<Preferences>"