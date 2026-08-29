from pathlib import Path
from dotenv import load_dotenv
import os


ROOT_DIR = Path(__file__).resolve().parents[5]

load_dotenv(ROOT_DIR / ".env")


YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")