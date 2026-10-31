import sqlite3

from app.utils.storage import reddit_database_dir, youtube_database_dir


DB_PATH = str(youtube_database_dir() / "job.db")
REDDIT_DB_PATH = str(reddit_database_dir() / "job.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_reddit_db():
    conn = sqlite3.connect(REDDIT_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn