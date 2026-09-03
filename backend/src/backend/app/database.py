import sqlite3
from pathlib import Path

from app.utils.storage import youtube_database_dir


DB_PATH = str(youtube_database_dir() / "job.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn