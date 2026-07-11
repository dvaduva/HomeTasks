from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .models import Base
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL - using SQLite for simplicity
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./data/hometasks.db')

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)
    _migrate_preferences(engine)

def _migrate_preferences(engine):
    """Add new columns to preferences table if missing (SQLite migration)."""
    new_columns = [
        ("date_format",             "VARCHAR(20) DEFAULT 'short'"),
        ("time_format",             "VARCHAR(5) DEFAULT '24'"),
        ("weather_city",            "VARCHAR(100) DEFAULT 'București'"),
        ("weather_units",           "VARCHAR(20) DEFAULT 'metric'"),
        ("weather_update_interval", "INTEGER DEFAULT 30"),
        ("ai_enabled",              "BOOLEAN DEFAULT 1"),
        ("ai_provider",             "VARCHAR(20) DEFAULT 'ollama'"),
        ("ollama_base_url",         "VARCHAR(200) DEFAULT 'http://localhost:11434'"),
        ("ai_model",                "VARCHAR(50) DEFAULT 'llama3:8b'"),
        ("ai_temperature",          "REAL DEFAULT 0.7"),
        ("ai_max_tokens",           "INTEGER DEFAULT 500"),
        ("openrouter_api_key",      "VARCHAR(200) DEFAULT ''"),
        ("groq_api_key",            "VARCHAR(200) DEFAULT ''"),
        ("gemini_api_key",          "VARCHAR(200) DEFAULT ''"),
        ("mistral_api_key",         "VARCHAR(200) DEFAULT ''"),
        ("voice_sensitivity",       "REAL DEFAULT 0.5"),
        ("voice_auto_start",        "BOOLEAN DEFAULT 0"),
        ("voice_mic_device",        "VARCHAR(100) DEFAULT ''"),
        ("tuya_enabled",            "BOOLEAN DEFAULT 1"),
        ("tuya_access_id",          "VARCHAR(100) DEFAULT ''"),
        ("tuya_access_secret",      "VARCHAR(100) DEFAULT ''"),
        ("tuya_api_region",         "VARCHAR(10) DEFAULT 'eu'"),
        ("standby_enabled",         "BOOLEAN DEFAULT 1"),
        ("standby_timeout_minutes", "INTEGER DEFAULT 5"),
    ]
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(preferences)"))}
        for col, definition in new_columns:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE preferences ADD COLUMN {col} {definition}"))
        conn.commit()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()