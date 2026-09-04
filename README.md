# Slop Factory

An end-to-end automated YouTube content research and video processing suite. Search for trending videos by keyword or ingest them directly by URL, rank them by engagement velocity, and run them through a full download → transcription → clip generation pipeline.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development](#development)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Configuration Reference](#configuration-reference)
- [Pipeline Stages](#pipeline-stages)
- [Known Gotchas](#known-gotchas)

---

## Features

- **Keyword Search Ingestion** – Scrape YouTube using the Data API v3 with fully configurable search parameters (order, duration, captions, category, date range, etc.)
- **Direct URL Ingestion** – Add any YouTube video by URL; metadata is fetched automatically.
- **Trend Scoring** – Compute engagement-velocity scores from views, likes, comments, age, and subscriber count.
- **Job Queue** – SQLite-backed job queue with status tracking per video.
- **WebSocket Live Updates** – Real-time job state streaming to the frontend.
- **LLM Configuration** – Switch between Ollama (local) and Gemini (cloud) providers from the UI.
- **Media Pipeline** – Download → WhisperX transcription → AI clip generation (run from backend CLI).

---

## Architecture

```
Slop Factory/
├── backend/                        # FastAPI application
│   ├── src/backend/app/
│   │   ├── main.py                 # App entrypoint, CORS, router registration
│   │   ├── database.py             # SQLite connection helper (get_db)
│   │   ├── init_db.py              # Schema creation & job CRUD helpers
│   │   ├── api/
│   │   │   ├── config.py           # /api/config — LLM & search param config
│   │   │   ├── search.py           # /api/search — keyword ingestion
│   │   │   ├── jobs.py             # /api/jobs — direct URL ingestion & queue
│   │   │   └── trend.py            # /api/trend — trend score calculation
│   │   ├── core/
│   │   │   └── config.py           # Loads YOUTUBE_API_KEY, GEMINI_API_KEY from .env
│   │   ├── llm/
│   │   │   └── factory.py          # LLM provider abstraction (Ollama / Gemini)
│   │   ├── pipeline/youtube/
│   │   │   ├── scraper.py          # YouTube Data API search + metadata.json writer
│   │   │   ├── trendCalculator.py  # Trend rank formula (log-velocity × engagement)
│   │   │   ├── downloader.py       # yt-dlp video download
│   │   │   ├── transcript.py       # WhisperX transcription & word alignment
│   │   │   ├── processor.py        # LLM clip generation
│   │   │   └── pipeline.py         # Legacy interactive CLI pipeline runner
│   │   └── utils/
│   │       └── storage.py          # Filesystem path helpers
│   └── pyproject.toml
│
├── frontend/                       # Vite + React 19 + Tailwind CSS v4
│   ├── src/
│   │   ├── App.tsx                 # Main dashboard shell
│   │   ├── services/api.ts         # Axios client, TypeScript types, all API calls
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── IngestionSection.tsx    # Search & direct URL ingestion UI
│   │       ├── ParamControls.tsx       # Search parameter editor panel
│   │       ├── SearchBar.tsx
│   │       ├── ConfigSection.tsx       # LLM provider/model selector
│   │       ├── JobQueueSection.tsx     # Live job queue table
│   │       └── TrendCalculatorSection.tsx
│   └── vite.config.ts
│
└── storage/youtube/
    ├── content/{video_id}/         # Per-video artifacts
    │   └── metadata.json           # Video metadata + pipeline state + trend_score
    ├── database/job.db             # SQLite jobs database
    └── config/config.json          # Active LLM + search parameter config
```

---

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend dev server |
| YouTube Data API v3 key | — | Required for search & direct URL metadata |
| Gemini API key | — | Optional; required for Gemini LLM provider |
| Ollama | latest | Optional; required for local LLM provider |

---

## Setup

### 1. Clone & create `.env`

```bash
git clone <repo-url>
cd "Slop Factory"
```

Create `.env` in the project root:

```env
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
GEMINI_API_KEY=your_gemini_api_key          # optional
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -e .
```

Initialize the database (only needed once):

```bash
python -m app.init_db
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Development

### Start Backend

```bash
cd backend
.venv\Scripts\activate
fastapi dev src\backend\app\main.py
# Server: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

Alternative (explicit uvicorn):

```bash
uvicorn src.backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Frontend

```bash
cd frontend
npm run dev
# Dev server: http://localhost:5173
```

Other frontend commands:

```bash
npm run build   # TypeScript check + production bundle
npm run lint    # ESLint
```

---

## API Reference

All routes are prefixed with the base URL `http://localhost:8000`.

### Health

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Server liveness check |

### Configuration — `/api/config`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/config` | Return full `config.json` |
| `GET` | `/api/config/llm/providers` | Check Ollama & Gemini availability; updates `config.json` |
| `GET` | `/api/config/llm/models` | Fetch available models for all active providers |
| `PUT` | `/api/config/llm/configure` | Set active provider and model |
| `GET` | `/api/config/search/params/options` | Return valid values/ranges for all search parameters |
| `PUT` | `/api/config/search/params` | Persist new search parameter values to `config.json` |

> **Note:** `GET /api/config/llm/providers` must be called before `GET /api/config/llm/models`, as it seeds the provider list used by the models endpoint.

### Search (Ingestion Method 1) — `/api/search`

| Method | Route | Body | Description |
|--------|-------|------|-------------|
| `POST` | `/api/search` | `{ q, overrideParams? }` | Run YouTube keyword search, write `metadata.json` per video, insert jobs with `trend_score = NULL` |

**Request body:**
```json
{
  "q": "quantum computing",
  "overrideParams": { "maxResults": 5 }
}
```

**Response:**
```json
{
  "jobs": [],
  "count": 10,
  "errors": []
}
```

### Jobs (Ingestion Method 2) — `/api/jobs`

| Method | Route | Body | Description |
|--------|-------|------|-------------|
| `GET` | `/api/jobs` | — | List all jobs ordered by `created_at DESC` |
| `GET` | `/api/jobs/{video_id}` | — | Get single job by YouTube video ID |
| `POST` | `/api/jobs` or `/api/jobs/url` | `{ url }` | Ingest a video by direct YouTube URL |
| `WS` | `/ws/jobs` | — | WebSocket: push all jobs on each client message |

**Direct URL request:**
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Direct URL response:**
```json
{
  "job": {},
  "message": "Job created successfully",
  "created": true
}
```

If the video already exists, `created` is `false` and the existing job is returned.

### Trend Calculation — `/api/trend`

| Method | Route | Body / Query | Description |
|--------|-------|------|-------------|
| `GET` | `/api/trend` or `/api/trend/uncalculated` | `?source=search` | List videos with `trend_score IS NULL` |
| `POST` | `/api/trend` or `/api/trend/calculate` | `{ source?, video_ids? }` | Calculate trend scores; updates `metadata.json` + `job.db` |

**Calculate request body (all fields optional):**
```json
{
  "source": "search",
  "video_ids": ["abc123"]
}
```

---

## Data Models

### `Job` — SQLite `jobs` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `video_id` | TEXT UNIQUE | YouTube video ID |
| `title` | TEXT | Video title |
| `channel` | TEXT | Channel name |
| `source` | TEXT | `"search"` or `"direct_url"` |
| `trend_score` | REAL | `NULL` until trend calculation is run |
| `job_status` | TEXT | `queued` → `downloading` → `downloaded` → `transcribing` → `generating_clips` → `completed` / `failed` |
| `processing_state` | TEXT | `pending` / `processed` / `rejected` / `failed` |
| `video_state` | TEXT | `in_queue` / `active` / `archived` |
| `progress` | INTEGER | 0–100 |
| `error_message` | TEXT | Error detail if `job_status = failed` |
| `created_at` | DATETIME | Insertion timestamp |
| `updated_at` | DATETIME | Last update timestamp |

### `metadata.json` — per video artifact

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "channel": {
    "name": "Channel Name",
    "id": "UC...",
    "subscriber_count": 1234567
  },
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "published_at": "2024-01-01T00:00:00Z",
  "statistics": {
    "views": 100000,
    "likes": 5000,
    "comments": 300
  },
  "details": {
    "duration": 212.0
  },
  "pipeline": {
    "downloaded": false,
    "transcript-analysed": false,
    "clips-processed": false
  },
  "trend_score": null
}
```

`trend_score` is `null` until `POST /api/trend/calculate` is called.

---

## Configuration Reference

`storage/youtube/config/config.json` has three top-level sections:

### `llm` — Active provider selection

```json
{
  "llm": {
    "provider": "gemini",
    "model": "models/gemini-2.5-flash"
  }
}
```

### `params` — Active search parameters (editable from UI)

```json
{
  "params": {
    "q": "quantum computing",
    "order": "viewCount",
    "publishedAfter": null,
    "publishedBefore": null,
    "maxResults": 10,
    "videoCaption": "closedCaption",
    "videoCategoryId": null,
    "videoDefinition": "any",
    "videoDimension": "any",
    "videoDuration": "medium",
    "videoEmbeddable": "any",
    "videoLicense": "any",
    "videoSyndicated": "any",
    "videoType": "any",
    "safeSearch": "none"
  }
}
```

### `details` — Valid options for params (read-only)

Populated by `GET /api/config/llm/providers` and `GET /api/config/llm/models`. Contains the full set of valid values for each `params` field and the list of available LLM providers/models.

---

## Pipeline Stages

The recommended workflow:

```
1. Configure search params  →  PUT /api/config/search/params
2. Keyword search           →  POST /api/search
3. Calculate trends         →  POST /api/trend/calculate
4. (Optional) Direct URL    →  POST /api/jobs  { url }
```

Full media processing (CLI only, not yet wired to API):

```
Download  →  Transcribe (WhisperX large-v3)  →  Generate Clips (LLM)
```

### Trend Score Formula

```
velocity            = view_count / max(age_hours, 1)
like_rate           = like_count / max(view_count, 1)
comment_rate        = comment_count / max(view_count, 1)
subscriber_velocity = view_count / max(subscriber_count, 1)

engagement   = 0.5 × like_rate + 0.3 × comment_rate + 0.2 × subscriber_velocity
trend_score  = log(velocity + 1) × engagement
```

All divisions are zero-safe (`max(x, 1)`). Higher score = more trending.

### WhisperX

- Model: `large-v3`
- Device: CUDA (`float16`) if available, else CPU (`int8`)
- English alignment model loaded alongside for word-level timestamps
- Models are lazy-loaded — only initialized on the first clip generation call in a pipeline session

---

## Known Gotchas

| Issue | Detail |
|-------|--------|
| Trend scores not calculated after search | `POST /api/trend/calculate` must be called explicitly. Search never auto-calculates. |
| LLM models 404 | Call `GET /api/config/llm/providers` first to seed the provider list before calling `/llm/models`. |
| Date filters silently dropped | `publishedAfter` / `publishedBefore` must be full ISO 8601 with timezone (`2024-01-01T00:00:00Z`). Plain `YYYY-MM-DD` strings are ignored. |
| Duplicate video IDs | Re-ingesting an existing video is non-fatal; it's reported in the `errors` array but doesn't abort the batch. |
| WebSocket is pull-based | `/ws/jobs` sends a snapshot only when the client sends a message. There is no server-side push interval. |
| CORS origins | Only `localhost:3000` and `localhost:5173` are allowed by default. Update `main.py` for other origins. |
