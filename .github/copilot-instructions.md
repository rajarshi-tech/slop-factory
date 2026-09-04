# GitHub Copilot & Copilot Chat Instructions - Slop Factory

## Tech Stack
- **Backend**: Python 3.12+, FastAPI, Uvicorn, SQLite3, WhisperX, PyTorch, Google API Client (YouTube v3 API), yt-dlp.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Axios.

## Core Rules & Architecture
1. **Separation of Ingestion & Trend Calculation**:
   - `search.py` (`POST /api/search`) scrapes YouTube videos and adds them to `job.db` with `trend_score = None`.
   - `jobs.py` (`POST /api/jobs`) ingests individual YouTube URLs and adds them to `job.db` with `source = 'direct_url'`.
   - `trend.py` (`POST /api/trend/calculate`) calls `trendCalculator.py` to calculate scores for unranked videos, updates `metadata.json`, and updates `job.db`.
2. **Database Management**:
   - `init_db.py` contains `create_tables()`, `insert_job()`, `update_job()`, `get_job()`, `get_all_jobs()`, and `get_uncalculated_jobs()`.
   - Database file is located at `storage/youtube/database/job.db`.
3. **Frontend Rules**:
   - Use Tailwind CSS v4 classes for styling.
   - Centralize API requests in `frontend/src/services/api.ts`.
   - Support both REST endpoints and live WebSocket updates from `/ws/jobs`.
