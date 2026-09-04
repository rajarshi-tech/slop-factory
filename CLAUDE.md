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
│   │   ├── llm/factory.py          # LLM provider abstraction (Ollama / Gemini)
│   │   ├── pipeline/youtube/
│   │   │   ├── scraper.py          # YouTube search scraper (metadata.json generation)
│   │   │   ├── trendCalculator.py  # Trend rank: log(velocity+1) × engagement
│   │   │   ├── downloader.py       # Video downloader (yt-dlp)
│   │   │   ├── transcript.py       # Audio transcription & alignment (WhisperX large-v3)
│   │   │   ├── processor.py        # LLM clip generation
│   │   │   └── pipeline.py         # Legacy interactive CLI runner (not API-wired)
│   │   ├── utils/storage.py        # Filesystem path helpers
│   │   ├── database.py             # SQLite connection (storage/youtube/database/job.db)
│   │   ├── init_db.py              # Schema definition & job DB operations
│   │   └── main.py                 # FastAPI application entrypoint with CORS & WS
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConfigSection.tsx       # LLM provider/model selector
│   │   │   ├── IngestionSection.tsx    # Search & direct URL ingestion UI
│   │   │   ├── JobQueueSection.tsx     # Live job queue table
│   │   │   ├── Navbar.tsx
│   │   │   ├── ParamControls.tsx       # Search parameter editor panel
│   │   │   ├── SearchBar.tsx
│   │   │   └── TrendCalculatorSection.tsx
│   │   ├── services/api.ts         # Axios API client, TypeScript types, all API calls
│   │   ├── App.tsx                 # Main application dashboard
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── storage/
    └── youtube/
        ├── content/{video_id}/     # Per-video artifacts & metadata.json
        ├── database/job.db         # SQLite jobs database
        └── config/config.json      # Current YouTube & LLM config
```

---

## Development Commands

### Backend (FastAPI)
```bash
cd backend
.venv\Scripts\activate
fastapi dev src\backend\app\main.py
# Server: http://localhost:8000  |  Swagger UI: http://localhost:8000/docs

# Alternative (explicit uvicorn):
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

### Health
- `GET /api/health` — Server liveness check

### Configuration (`/api/config`)
- `GET /api/config` — Full `config.json`
- `GET /api/config/llm/providers` — Check Ollama & Gemini availability; updates `config.json` *(call before `/llm/models`)*
- `GET /api/config/llm/models` — Fetch available models for all active providers
- `PUT /api/config/llm/configure` — Set active provider and model `{ provider, model }`
- `GET /api/config/search/params/options` — Valid values/ranges for all search parameters
- `PUT /api/config/search/params` — Persist new search param values to `config.json`

### Ingestion & Jobs
- `POST /api/search` — Keyword search → queue jobs (`source="search"`, `trend_score=NULL`). Body: `{ q, overrideParams? }`
- `POST /api/jobs` / `POST /api/jobs/url` — Direct URL ingestion (`source="direct_url"`). Body: `{ url }`
- `GET /api/jobs` — List all jobs (ordered `created_at DESC`)
- `GET /api/jobs/{video_id}` — Get single job by video ID
- `POST /api/jobs/archive` — Set video(s) state to archived. Body: `{ video_ids: ["id1", "id2"] }`
- `WS /ws/jobs` — WebSocket: sends snapshot of all jobs on each client message (pull-based)

### Trend
- `GET /api/trend` / `GET /api/trend/uncalculated` — List videos with `trend_score IS NULL`. Query: `?source=search`
- `POST /api/trend` / `POST /api/trend/calculate` — Calculate & persist trend scores. Body: `{ source?, video_ids? }`

> **Workflow reminder:** `POST /api/search` queues jobs with `trend_score = NULL`. You must call `POST /api/trend/calculate` separately to score them.

---

## Coding Conventions
1. **Python**: Strict type hints, modular pipeline functions, preserve all comments, use `get_db()` context manager / connection helpers. Always guard divisions with `max(x, 1)` in `trendCalculator.py`.
2. **TypeScript / React**: Modern functional components, Tailwind v4 styling with CSS variables, typed API contracts via `services/api.ts`.
3. **Database**: SQLite `jobs` table is the single source of truth for job progression. Preserve schema compatibility in `init_db.py` when adding columns.
4. **Config API routes**: Search param endpoints live under `/api/config/search/params` (not `/llm/params`). LLM endpoints live under `/api/config/llm/*`.
