# app/utils/storage.py

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[5]

STORAGE = PROJECT_ROOT / "storage"


def youtube_video_dir(video_id: str):
    """Storage directory for a specific video: storage/youtube/content/{video_id}/"""
    path = STORAGE / "youtube" / "content" / video_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def youtube_config_dir():
    """Storage directory for YouTube configuration: storage/youtube/config/"""
    path = STORAGE / "youtube" / "config"
    path.mkdir(parents=True, exist_ok=True)
    return path


def youtube_database_dir():
    """Storage directory for SQLite database: storage/youtube/database/"""
    path = STORAGE / "youtube" / "database"
    path.mkdir(parents=True, exist_ok=True)
    return path