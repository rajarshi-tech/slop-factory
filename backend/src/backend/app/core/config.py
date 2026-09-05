from pathlib import Path
from dotenv import load_dotenv
import os


ROOT_DIR = Path(__file__).resolve().parents[5]

load_dotenv(ROOT_DIR / ".env")


YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
YOUTUBE_OAUTH_CLIENT_ID = os.getenv("YOUTUBE_OAUTH_CLIENT_ID")
YOUTUBE_OAUTH_CLIENT_SECRET = os.getenv("YOUTUBE_OAUTH_CLIENT_SECRET")
YOUTUBE_OAUTH_REDIRECT_URI = os.getenv("YOUTUBE_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/youtube/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
