# CLAUDE.md - Slop Factory Guidelines

## Project Overview
**Slop Factory** is an AI-powered YouTube content research and video generation pipeline. It enables searching videos, ingesting direct URLs, calculating trend velocity/engagement rankings, downloading media, transcribing audio with WhisperX, and processing clips using local/cloud LLMs.

---

## Architecture & File Structure
```
├── backend/
│   ├── src/backend/app/
│   │   ├── api/
│   │   │   ├── config.py           # LLM and search configuration routes (/api/config)
│   │   │   ├── search.py           # Search YouTube and ingest jobs (/api/search)
│   │   │   ├── jobs.py             # Direct URL ingestion & Job queue (/api/jobs, /ws/jobs)
│   │   │   └── trend.py            # Trend calculation for unranked videos (/api/trend)
│   │   ├── core/config.py          # API keys (YOUTUBE_API_KEY, GEMINI_API_KEY)
│   │   ├── pipeline/youtube/
│   │   │   ├── scraper.py          # YouTube search scraper (metadata.json generation)
│   │   │   ├── trendCalculator.py  # Trend rank calculation (views, age, likes, comments, subs)
│   │   │   ├── downloader.py       # Video downloader (yt-dlp)
│   │   │   ├── transcript.py       # Audio transcription & alignment (WhisperX)
│   │   │   └── processor.py        # Video clip generation and formatting
│   │   ├── database.py             # SQLite connection (storage/youtube/database/job.db)
│   │   ├── init_db.py              # Schema definition & job DB operations
│   │   └── main.py                 # FastAPI application entrypoint with CORS & WS
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── components/             # React UI components (Tailwind v4)
│   │   ├── services/api.ts         # Axios API client & WebSocket definitions
│   │   ├── App.tsx                 # Main application dashboard
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── storage/
    └── youtube/
        ├── content/{video_id}/     # Video artifacts & metadata.json
        ├── database/job.db         # SQLite jobs database
        └── config/config.json      # Current YouTube & LLM config
```

---

## Development Commands

### Backend (FastAPI)
```bash
cd backend
# Run server with hot reload
.venv\Scripts\uvicorn.exe src.backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Vite + React + Tailwind v4)
```bash
cd frontend
npm run dev      # Starts Vite dev server on http://localhost:5173
npm run build    # TypeScript check & production bundle build
npm run lint     # ESLint checks
```

---

## Backend API Specification
- `GET /api/health` - Server health check
- `GET /api/config` - Full configuration
- `POST /api/search` - Search YouTube and queue jobs (`source="search"`, `trend_score=NULL`)
- `POST /api/jobs` / `POST /api/jobs/url` - Ingest direct YouTube URL (`source="direct_url"`)
- `GET /api/jobs` - List all queued/processing jobs
- `GET /api/jobs/{video_id}` - Get individual job metadata
- `WS /ws/jobs` - WebSocket live streaming job queue updates
- `GET /api/trend/uncalculated` - Get count and list of unranked videos
- `POST /api/trend/calculate` - Compute trend scores from `metadata.json` and sync with `job.db`

---

## Coding Conventions
1. **Python**: Strict type hints, modular pipeline functions, preserve all comments, use `get_db()` context manager / connection helpers.
2. **TypeScript / React**: Modern functional components, Tailwind v4 styling with utility classes, typed API contracts.
3. **Database**: SQLite `jobs` table is the single source of truth for job progression.
