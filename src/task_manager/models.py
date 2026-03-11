from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
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
    temperature_unit = Column(String(1), default='C')  # C, F
    update_interval_minutes = Column(Integer, default=30)
    # Location for weather
    city = Column(String(100), default='București')
    # Voice settings
    voice_activation_word = Column(String(50), default='Hey HomeTasks')
    voice_language = Column(String(10), default='ro-RO')  # ro-RO, en-US, en-GB
    voice_enabled = Column(Boolean, default=True)
    text_to_speech_enabled = Column(Boolean, default=False)
    # Updated timestamp
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return "<Preferences>"