from pathlib import Path
from dotenv import load_dotenv
import os


ROOT_DIR = Path(__file__).resolve().parents[5]

DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI = "http://localhost:8000/auth/youtube/callback"
DEFAULT_FRONTEND_URL = "http://localhost:5173"

load_dotenv(ROOT_DIR / ".env")


YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
YOUTUBE_OAUTH_CLIENT_ID = os.getenv("YOUTUBE_OAUTH_CLIENT_ID")
YOUTUBE_OAUTH_CLIENT_SECRET = os.getenv("YOUTUBE_OAUTH_CLIENT_SECRET")
YOUTUBE_OAUTH_REDIRECT_URI = os.getenv("YOUTUBE_OAUTH_REDIRECT_URI", DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI)
FRONTEND_URL = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)


def get_gemini_api_key() -> str | None:
    """Read the key at request time so keys saved through the UI apply immediately."""
    return os.getenv("GEMINI_API_KEY")


def get_youtube_oauth_client_id() -> str | None:
    return os.getenv("YOUTUBE_OAUTH_CLIENT_ID")


def get_youtube_oauth_client_secret() -> str | None:
    return os.getenv("YOUTUBE_OAUTH_CLIENT_SECRET")


def get_youtube_oauth_redirect_uri() -> str:
    return os.getenv("YOUTUBE_OAUTH_REDIRECT_URI", DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI)


def get_frontend_url() -> str:
    return os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)
