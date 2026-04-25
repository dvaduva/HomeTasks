from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import calendar as _calendar
from .models import User, Task, Comment, Preferences, TaskStatus, RecurrencePattern
from .database import SessionLocal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_


def _add_months(dt: datetime, months: int) -> datetime:
    total = (dt.year * 12 + (dt.month - 1)) + months
    year, month = total // 12, total % 12 + 1
    last_day = _calendar.monthrange(year, month)[1]
    return dt.replace(year=year, month=month, day=min(dt.day, last_day))


def _advance(dt: datetime, pattern: RecurrencePattern) -> Optional[datetime]:
    if pattern == RecurrencePattern.DAILY:
        return dt + timedelta(days=1)
    if pattern == RecurrencePattern.WEEKLY:
        return dt + timedelta(days=7)
    if pattern == RecurrencePattern.MONTHLY:
        return _add_months(dt, 1)
    if pattern == RecurrencePattern.YEARLY:
        return _add_months(dt, 12)
    return None


def expand_recurring_tasks(tasks: List[Task],
                           start_date: datetime,
                           end_date: datetime) -> List[Dict[str, Any]]:
    """Expand recurring tasks into virtual occurrences within [start_date, end_date].

    Returns a list of dicts (not ORM objects) so callers can serialize them
    directly without confusing recurring instances with the underlying row.
    Non-recurring tasks produce a single occurrence if their scheduled_date
    falls in range. Each dict includes `is_recurring_instance=True` for
    generated occurrences after the original date.
    """
    MAX_ITERATIONS = 1000  # hard cap protects against bad data
    results: List[Dict[str, Any]] = []

    for task in tasks:
        if not task.scheduled_date:
            continue

        is_recurring = (
            task.recurrence_pattern is not None
            and task.recurrence_pattern != RecurrencePattern.NONE
        )

        if not is_recurring:
            if start_date <= task.scheduled_date <= end_date:
                results.append(_occurrence(task, task.scheduled_date, False))
            continue

        max_date = end_date
        if task.recurrence_end_date is not None:
            max_date = min(max_date, task.recurrence_end_date)

        current = task.scheduled_date
        is_first = True
        for _ in range(MAX_ITERATIONS):
            if current is None or current > max_date:
                break
            if current >= start_date:
                results.append(_occurrence(task, current, not is_first))
            is_first = False
            current = _advance(current, task.recurrence_pattern)

    results.sort(key=lambda r: r['scheduled_date'])
    return results


def _occurrence(task: Task, occurrence_date: datetime, is_recurring_instance: bool) -> Dict[str, Any]:
    return {
        'task_id': task.id,
        'description': task.description,
        'user_id': task.user_id,
        'user_name': task.user.name if task.user else None,
        'user_color': task.user.color if task.user else None,
        'status': task.status.value if task.status else None,
        'scheduled_date': occurrence_date,
        'recurrence_pattern': task.recurrence_pattern.value if task.recurrence_pattern else None,
        'is_recurring_instance': is_recurring_instance,
    }

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