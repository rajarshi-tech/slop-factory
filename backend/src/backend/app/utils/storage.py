# app/utils/storage.py

import json
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[5]

STORAGE = PROJECT_ROOT / "storage"

_config_lock = threading.RLock()

DEFAULT_CONFIG = {
    "details": {
        "llm": {
            "provider": {
                "ollama": {
                    "models": [
                        "qwen3:8b"
                    ]
                },
                "gemini": {
                    "models": [
                        "models/gemini-2.5-flash",
                        "models/gemini-2.5-pro",
                        "models/gemini-2.5-flash-preview-tts",
                        "models/gemini-2.5-pro-preview-tts",
                        "models/gemma-4-26b-a4b-it",
                        "models/gemma-4-31b-it",
                        "models/gemini-flash-latest",
                        "models/gemini-flash-lite-latest",
                        "models/gemini-pro-latest",
                        "models/gemini-2.5-flash-lite",
                        "models/gemini-2.5-flash-image",
                        "models/gemini-3-flash-preview",
                        "models/gemini-3.1-pro-preview",
                        "models/gemini-3.1-pro-preview-customtools",
                        "models/gemini-3.1-flash-lite-preview",
                        "models/gemini-3.1-flash-lite",
                        "models/gemini-3-pro-image-preview",
                        "models/gemini-3-pro-image",
                        "models/nano-banana-pro-preview",
                        "models/gemini-3.1-flash-image-preview",
                        "models/gemini-3.1-flash-image",
                        "models/gemini-3.1-flash-lite-image",
                        "models/gemini-3.5-flash",
                        "models/gemini-3.5-flash-lite",
                        "models/gemini-omni-flash-preview",
                        "models/gemini-omni-1.1-flash",
                        "models/gemini-3.5-transcribe",
                        "models/gemini-3.6-flash",
                        "models/gemini-3.7-flash",
                        "models/lyria-3-clip-preview",
                        "models/lyria-3-pro-preview",
                        "models/gemini-3.1-flash-tts-preview",
                        "models/gemini-robotics-er-2-preview",
                        "models/gemini-2.5-computer-use-preview-10-2025",
                        "models/antigravity-preview-05-2026",
                        "models/deep-research-max-preview-04-2026",
                        "models/deep-research-preview-04-2026",
                        "models/deep-research-pro-preview-12-2025"
                    ]
                }
            }
        },
        "params": {
            "order": [
                "date",
                "rating",
                "relevance",
                "title",
                "videoCount",
                "viewCount"
            ],
            "maxResults": {
                "min": 1,
                "max": 50,
                "default": 10
            },
            "videoCaption": [
                "any",
                "closedCaption",
                "none"
            ],
            "videoCategoryId": [
                { "id": "1", "name": "Film & Animation" },
                { "id": "2", "name": "Autos & Vehicles" },
                { "id": "10", "name": "Music" },
                { "id": "15", "name": "Pets & Animals" },
                { "id": "17", "name": "Sports" },
                { "id": "18", "name": "Short Movies" },
                { "id": "19", "name": "Travel & Events" },
                { "id": "20", "name": "Gaming" },
                { "id": "21", "name": "Videoblogging" },
                { "id": "22", "name": "People & Blogs" },
                { "id": "23", "name": "Comedy" },
                { "id": "24", "name": "Entertainment" },
                { "id": "25", "name": "News & Politics" },
                { "id": "26", "name": "Howto & Style" },
                { "id": "27", "name": "Education" },
                { "id": "28", "name": "Science & Technology" },
                { "id": "29", "name": "Nonprofits & Activism" },
                { "id": "30", "name": "Movies" },
                { "id": "31", "name": "Anime/Animation" },
                { "id": "32", "name": "Action/Adventure" },
                { "id": "33", "name": "Classics" },
                { "id": "34", "name": "Comedy" },
                { "id": "35", "name": "Documentary" },
                { "id": "36", "name": "Drama" },
                { "id": "37", "name": "Family" },
                { "id": "38", "name": "Foreign" },
                { "id": "39", "name": "Horror" },
                { "id": "40", "name": "Sci-Fi/Fantasy" },
                { "id": "41", "name": "Thriller" },
                { "id": "42", "name": "Shorts" },
                { "id": "43", "name": "Shows" },
                { "id": "44", "name": "Trailers" }
            ],
            "videoDefinition": [
                "any",
                "high",
                "standard"
            ],
            "videoDimension": [
                "2d",
                "3d",
                "any"
            ],
            "videoDuration": [
                "any",
                "long",
                "medium",
                "short"
            ],
            "videoEmbeddable": [
                "any",
                "true"
            ],
            "videoLicense": [
                "any",
                "creativeCommon",
                "youtube"
            ],
            "videoSyndicated": [
                "any",
                "true"
            ],
            "videoType": [
                "any",
                "episode",
                "movie"
            ],
            "safeSearch": [
                "moderate",
                "none",
                "strict"
            ]
        }
    },
    "llm": {
        "provider": "gemini",
        "model": "models/gemini-2.5-flash"
    },
    "params": {
        "q": "life without the internet",
        "order": "viewCount",
        "publishedAfter": None,
        "publishedBefore": None,
        "maxResults": 10,
        "videoCaption": "closedCaption",
        "videoCategoryId": None,
        "videoDefinition": "any",
        "videoDimension": "any",
        "videoDuration": "medium",
        "videoEmbeddable": "any",
        "videoLicense": "any",
        "videoSyndicated": "any",
        "videoType": "any",
        "safeSearch": "moderate"
    }
}


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


def save_config(config: dict):
    """Atomically save configuration to config.json with thread locking."""
    config_dir = youtube_config_dir()
    config_file = config_dir / "config.json"
    temp_file = config_dir / "config.json.tmp"

    with _config_lock:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        temp_file.replace(config_file)


def load_config() -> dict:
    """Load configuration with thread safety, corruption recovery, and schema validation."""
    config_dir = youtube_config_dir()
    config_file = config_dir / "config.json"

    with _config_lock:
        data = None
        if config_file.exists():
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"Corrupted or unreadable config.json ({e}). Recovering with defaults.")
                data = None

        if not isinstance(data, dict):
            data = json.loads(json.dumps(DEFAULT_CONFIG))
            save_config(data)
            return data

        repaired = False
        if "details" not in data or not isinstance(data["details"], dict):
            data["details"] = json.loads(json.dumps(DEFAULT_CONFIG["details"]))
            repaired = True
        if "llm" not in data or not isinstance(data["llm"], dict):
            data["llm"] = json.loads(json.dumps(DEFAULT_CONFIG["llm"]))
            repaired = True
        if "params" not in data or not isinstance(data["params"], dict):
            data["params"] = json.loads(json.dumps(DEFAULT_CONFIG["params"]))
            repaired = True

        if repaired:
            save_config(data)

        return data
