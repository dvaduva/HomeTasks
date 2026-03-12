from typing import List, Optional
from datetime import datetime, timedelta
from .models import User, Task, Comment, Preferences, TaskStatus, RecurrencePattern
from .database import SessionLocal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, name: str, color: str = '#3498db') -> User:
        user = User(name=name, color=color)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_all(self) -> List[User]:
        return self.db.query(User).all()
    
    def update(self, user_id: int, **kwargs) -> Optional[User]:
        user = self.get_by_id(user_id)
        if user:
            for key, value in kwargs.items():
                setattr(user, key, value)
            self.db.commit()
            self.db.refresh(user)
        return user
    
    def delete(self, user_id: int) -> bool:
        user = self.get_by_id(user_id)
        if user:
            self.db.delete(user)
            self.db.commit()
            return True
        return False

class TaskRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, description: str, user_id: int, scheduled_date: datetime,
               recurrence_pattern: RecurrencePattern = RecurrencePattern.NONE,
               recurrence_end_date: Optional[datetime] = None) -> Task:
        task = Task(
            description=description,
            user_id=user_id,
            scheduled_date=scheduled_date,
            recurrence_pattern=recurrence_pattern,
            recurrence_end_date=recurrence_end_date
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def get_by_id(self, task_id: int) -> Optional[Task]:
        return self.db.query(Task).filter(Task.id == task_id).first()
    
    def get_all(self, user_id: Optional[int] = None, 
                status: Optional[TaskStatus] = None,
                start_date: Optional[datetime] = None,
                end_date: Optional[datetime] = None) -> List[Task]:
        query = self.db.query(Task)
        
        if user_id:
            query = query.filter(Task.user_id == user_id)
        if status:
            query = query.filter(Task.status == status)
        if start_date:
            query = query.filter(Task.scheduled_date >= start_date)
        if end_date:
            query = query.filter(Task.scheduled_date <= end_date)
            
        return query.order_by(Task.scheduled_date).all()
    
    def get_today_tasks(self) -> List[Task]:
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        start_datetime = datetime.combine(today, datetime.min.time())
        end_datetime = datetime.combine(tomorrow, datetime.min.time())
        return self.get_all(start_date=start_datetime, end_date=end_datetime)
    
    def get_upcoming_tasks(self, days: int = 7) -> List[Task]:
        start_date = datetime.now()
        end_date = start_date + timedelta(days=days)
        return self.get_all(start_date=start_date, end_date=end_date)
    
    def update(self, task_id: int, **kwargs) -> Optional[Task]:
        task = self.get_by_id(task_id)
        if task:
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            task.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(task)
        return task
    
    def delete(self, task_id: int) -> bool:
        task = self.get_by_id(task_id)
        if task:
            # Delete associated comments first to avoid FK constraint
            self.db.query(Comment).filter(Comment.task_id == task_id).delete()
            self.db.delete(task)
            self.db.commit()
            return True
        return False

class CommentRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, text: str, task_id: int, user_id: int) -> Comment:
        comment = Comment(text=text, task_id=task_id, user_id=user_id)
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment
    
    def get_by_task_id(self, task_id: int) -> List[Comment]:
        return self.db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.desc()).all()
    
    def delete(self, comment_id: int) -> bool:
        comment = self.db.query(Comment).filter(Comment.id == comment_id).first()
        if comment:
            self.db.delete(comment)
            self.db.commit()
            return True
        return False

class PreferencesRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create(self) -> Preferences:
        prefs = self.db.query(Preferences).first()
        if not prefs:
            prefs = Preferences()
            self.db.add(prefs)
            self.db.commit()
            self.db.refresh(prefs)
        return prefs
    
    def update(self, **kwargs) -> Preferences:
        prefs = self.get_or_create()
        for key, value in kwargs.items():
            if hasattr(prefs, key):
                setattr(prefs, key, value)
        prefs.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(prefs)
        return prefs