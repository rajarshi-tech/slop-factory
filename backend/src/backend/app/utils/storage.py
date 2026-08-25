# app/utils/storage.py

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[5]

STORAGE = PROJECT_ROOT / "storage"


def youtube_processed_dir(video_id: str):
    path = STORAGE / "youtube" / "processed" / video_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def youtube_links_dir():
    path = STORAGE / "youtube" / "links"
    path.mkdir(parents=True, exist_ok=True)
    return path


def youtube_raw_dir(video_id: str):
    path = STORAGE / "youtube" / "raw" / video_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def youtube_params_dir():
    path = STORAGE / "youtube" / "params"
    path.mkdir(parents=True, exist_ok=True)
    return path




def reddit_raw_dir(post_id: str):
    path = STORAGE / "reddit" / "raw" / post_id
    path.mkdir(parents=True, exist_ok=True)
    return path
