# CLAUDE.md - Slop Factory Developer Guide

## 1. Project Overview & Architecture

**Slop Factory** is an automated content research, media ingestion, trend analysis, AI clip generation, and scheduled publishing suite. It is designed around modular pipelines that ingest media from external sources, rank content by engagement velocity, transcribe and analyze dialogue, produce captioned clips, and manage distribution channels.

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (React 19 + Vite)                  │
│       Tailwind v4 • Dashboard • Queue • Video Previews       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (/ws/jobs)
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend Service                  │
│   /api/config   /api/search   /api/jobs    /api/trend       │
│   /api/process  /api/uploads  /auth        /storage         │
└──────┬───────────────────────┬──────────────────────────────┘
       │                       │
┌──────▼────────────────┐ ┌────▼──────────────────────────────┐
│  Pipeline Subsystems  │ │       Storage & Persistence       │
│  ├── youtube/         │ │  storage/youtube/                 │
│  │   ├── scraper      │ │  ├── content/{video_id}/          │
│  │   ├── trendCalc    │ │  │   ├── metadata.json            │
│  │   ├── downloader   │ │  │   ├── {video_id}.mp4           │
│  │   ├── transcript   │ │  │   ├── clipTimestamps.json      │
│  │   ├── processor    │ │  │   └── clips/*.mp4              │
│  │   └── pipeline     │ │  ├── database/job.db (SQLite)     │
│  └── reddit/ (planned)│ │  └── config/config.json           │
└───────────────────────┘ └───────────────────────────────────┘
```

---

## 2. Directory Structure & Component Roles

```
Slop Factory/
├── backend/
│   ├── pyproject.toml              # UV project config, Python 3.11, CUDA 12.8 PyTorch
│   ├── uv.lock                     # Locked backend dependencies
│   ├── README.md                   # Backend setup and execution details
│   └── src/backend/app/
│       ├── main.py                 # FastAPI application, CORS, static mounts, router setup
│       ├── database.py             # SQLite connection factory (get_db, Row factory)
│       ├── init_db.py              # SQLite DDL, migrations, and CRUD helper operations
│       ├── api/
│       │   ├── config.py           # /api/config: LLM & search param options, API key setup
│       │   ├── search.py           # /api/search: YouTube keyword ingestion
│       │   ├── jobs.py             # /api/jobs: direct URL ingestion, queue management, WS
│       │   ├── trend.py            # /api/trend: engagement velocity calculation
│       │   ├── process.py          # /api/process: download, transcribe & clip generation
│       │   ├── uploads.py          # /api/uploads: clip upload scheduling & channels
│       │   └── youtube_auth.py     # /auth: Google OAuth 2.0 flow for upload channels
│       ├── core/
│       │   └── config.py           # Environment variables (.env) loading & OAuth defaults
│       ├── llm/
│       │   ├── base.py             # LLMProvider abstract base class
│       │   ├── factory.py          # create_llm() reading provider from config.json
│       │   └── providers/          # Ollama (local) and Gemini (google-genai SDK)
│       ├── pipeline/
│       │   ├── youtube/            # YouTube ingestion, ranking, media processing
│       │   │   ├── scraper.py      # YouTube Data API v3 search scraper
│       │   │   ├── trendCalculator.py # Zero-safe velocity and engagement ranking
│       │   │   ├── downloader.py   # yt-dlp media and caption fetcher
│       │   │   ├── transcript.py   # Transcript chunking, LLM clip candidate scoring
│       │   │   ├── processor.py    # WhisperX alignment, ASS subtitle rendering, FFmpeg
│       │   │   └── pipeline.py     # Orchestrator running download -> transcribe -> clip
│       │   └── reddit/             # Scaffolded directory for upcoming Reddit pipeline
│       ├── services/
│       │   └── youtube.py          # YouTube upload worker and channel helper logic
│       └── utils/
│           └── storage.py          # Thread-safe config.json I/O, path helpers
│
├── frontend/
│   ├── package.json                # React 19, Vite, Tailwind CSS v4, Axios
│   ├── vite.config.ts              # Vite configuration
│   ├── README.md                   # Frontend setup and run guidelines
│   └── src/
│       ├── main.tsx                # React DOM entrypoint
│       ├── App.tsx                 # Dashboard view switcher and navigation shell
│       ├── services/api.ts         # Centralized Axios client, WS helper, all TS types
│       └── components/
│           ├── Navbar.tsx          # Navigation header and active view switcher
│           ├── IngestionSection.tsx # Search ingestion and direct URL input
│           ├── ParamControls.tsx   # Search parameter customization panel
│           ├── TrendCalculatorSection.tsx # Video scoring and ranking UI
│           ├── JobQueueSection.tsx # Live job table, WebSocket updates, batch actions
│           ├── ProcessedSection.tsx # Processed clip preview, metadata editor, scheduling
│           ├── ArchivedSection.tsx # Archived video table with restore/delete actions
│           ├── YoutubeChannelsSection.tsx # OAuth connect flow & channel settings
│           ├── ConfigSection.tsx   # LLM provider/model picker and defaults
│           └── ApiKeyPopup.tsx     # Missing API keys modal dialog
│
└── storage/
    └── youtube/
        ├── content/{video_id}/     # Per-video workspace
        │   ├── metadata.json       # Canonical video metadata, pipeline flags, scores
        │   ├── {video_id}.mp4      # Downloaded source media
        │   ├── {video_id}.en.vtt   # Downloaded or extracted subtitles
        │   ├── clipTimestamps.json # Discovered clip boundaries, scores, and titles
        │   └── clips/              # Rendered MP4 clips with burned subtitles
        ├── database/job.db         # SQLite jobs and uploads database
        └── config/config.json      # Active provider, model, and search parameters
```

---

## 3. Development Commands

### Backend Setup & Execution (PowerShell on Windows)
Backend uses **Python 3.11** managed via `uv`:

```powershell
cd backend

# Environment setup
uv python install 3.11
uv sync
.venv\Scripts\Activate.ps1

# Run development server (FastAPI dev with HMR / auto-reload on port 8000)
fastapi dev src\backend\app\main.py

# Alternative explicit uvicorn command
uvicorn src.backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Explicit database schema initialization / migration
python -m app.init_db
```

- Server Address: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### Frontend Setup & Execution (PowerShell on Windows)
Frontend uses **Node.js 18+** with **npm**:

```powershell
cd frontend

# Install dependencies
npm install

# Run Vite development server (port 5173)
npm run dev

# Type check & build production bundle
npm run build

# Run ESLint
npm run lint

# Preview production build locally
npm run preview
```

---

## 4. Multi-Pipeline Architecture & Growth Blueprint

The repository is built to support multiple content sources (YouTube, Reddit, etc.) with consistent architectural boundaries:

1. **Pipeline Subpackage Isolation**:
   - Each source lives in `backend/src/backend/app/pipeline/<source>/`.
   - Never import implementation details across pipeline subpackages. Pipelines share only common application utilities (`app.utils.storage`, `app.llm.factory`, `app.database`).
2. **Storage Partitioning**:
   - Each pipeline must store its data under `storage/<source>/`.
   - Per-item artifacts must be self-contained in `storage/<source>/content/{item_id}/`.
   - Add path helpers in `backend/src/backend/app/utils/storage.py` (following `youtube_video_dir`, `youtube_config_dir`, `youtube_database_dir`).
3. **Database Schema Extensibility**:
   - Primary content records are stored in `jobs` (distinguished by the `source` field).
   - If a new pipeline requires source-specific attributes, add optional columns via additive `ALTER TABLE` checks in `init_db.py`.
   - Derivative assets with distinct publish/upload lifecycles must use independent tracking tables (e.g., `upload_jobs`).
4. **Pipeline Lifecycle Conventions**:
   - **Ingestion**: Scrapes search queries or accepts direct IDs; writes `metadata.json` and inserts a `queued` job.
   - **Scoring**: Computes zero-division-safe ranking; updates `metadata.json` and `job.db`.
   - **Processing**: Idempotently checks previous stage completion flags (`downloaded`, `transcript-analysed`, `clips-processed`) before running expensive steps.
   - **LLM Calls**: Must always use `app.llm.factory.create_llm()` to maintain provider-agnostic support across Ollama and Gemini.

---

## 5. Verified Backend API Specification

Base URL: `http://localhost:8000`

### System & Health
- `GET /api/health` — Liveness check. Returns `{"status": "ok"}`.

### Configuration (`/api/config`)
- `GET /api/config` — Returns entire `config.json` (details, llm, params).
- `GET /api/config/llm/providers` — Tests connectivity to Ollama and Gemini; updates available provider state in `config.json`. *(Must be called before `/llm/models`)*.
- `GET /api/config/llm/models` — Returns available models for active providers.
- `PUT /api/config/llm/configure` — Sets active provider and model. Body: `{"provider": str, "model": str}`.
- `GET /api/config/search/params/options` — Returns valid values and ranges for search parameters.
- `PUT /api/config/search/params` — Updates search parameters in `config.json`. Body: dictionary of param overrides.
- `GET /api/config/check-keys` — Returns `{"configured": {"youtube": bool, "gemini": bool}}`.
- `POST /api/config/set-keys` — Saves `YOUTUBE_API_KEY` and `GEMINI_API_KEY` to root `.env`.

### YouTube Ingestion & Search (`/api/search`)
- `POST /api/search` — Runs YouTube Data API v3 search with configured/overridden params. Writes `metadata.json` for each result, inserts rows into `jobs` table with `source="search"` and `trend_score=NULL`.
  - Body: `{"q": str, "overrideParams": Optional[dict]}`
  - Response: `{"jobs": list, "count": int, "errors": list}`

### Jobs & Queue (`/api/jobs`)
- `GET /api/jobs` — Lists all jobs ordered by `created_at DESC`.
- `GET /api/jobs/{video_id}` — Returns single job record by ID.
- `POST /api/jobs` or `POST /api/jobs/url` — Ingests a direct YouTube URL. Fetches metadata via `yt-dlp`, creates `metadata.json`, and records job with `source="direct_url"`.
  - Body: `{"url": str}`
- `GET /api/jobs/{video_id}/clips` — Returns all generated clips and timestamp data from `clipTimestamps.json`.
- `PATCH /api/jobs/{video_id}/clips/{clip_id}` — Updates clip title or description in `clipTimestamps.json`.
  - Body: `{"title": Optional[str], "description": Optional[str]}`
- `PATCH /api/jobs/{video_id}` — Updates job fields in SQLite.
- `POST /api/jobs/archive` or `PUT /api/jobs/archive` — Sets `video_state="archived"`. Body: `{"video_ids": list[str]}`.
- `POST /api/jobs/unarchive` or `PUT /api/jobs/unarchive` — Restores video to `video_state="in_queue"` or `"active"`. Body: `{"video_ids": list[str]}`.
- `DELETE /api/jobs` or `POST /api/jobs/delete` — Deletes job from SQLite and permanently removes `storage/youtube/content/{video_id}` from disk. Body: `{"video_ids": list[str]}`.
- `WS /ws/jobs` — Pull-based WebSocket connection. Emits full job queue snapshot whenever a message is received from client.

### Trend Scoring (`/api/trend` and `/api/trends`)
- `GET /api/trend/uncalculated` or `GET /api/trend` — Returns jobs where `trend_score IS NULL` (optional query: `?source=search`).
- `POST /api/trend/calculate` or `POST /api/trend` — Calculates trend scores for uncalculated or specified videos; updates `metadata.json` and `job.db`.
  - Body: `{"source": Optional[str], "video_ids": Optional[list[str]]}`

### Media Processing (`/api/process`)
- `POST /api/process` — Triggers download, WhisperX transcription, LLM candidate scoring, and subtitle/clip rendering for specified video IDs.
  - Body:
    ```json
    {
      "video_ids": ["abc123xyz"],
      "subtitle_config": {
        "enabled": true,
        "style": "plain",
        "font_name": "Arial",
        "font_size": 64,
        "highlight_color": "&H00FFFF&",
        "position": "center"
      }
    }
    ```
  - Subtitle styles: `"plain"` (static lines), `"karaoke_sentence"` (highlighted sentence), `"word_level"` (word-by-word reveal).

### Upload Scheduling (`/api/uploads`)
- `GET /api/uploads` — Returns list of all scheduled `upload_jobs`.
- `GET /api/uploads/channels` — Lists connected YouTube upload channels (secrets omitted).
- `PUT /api/uploads/channels/{channel_id}` — Updates default channel description. Body: `{"default_description": str}`.
- `DELETE /api/uploads/channels/{channel_id}` — Removes connected channel and refresh token.
- `POST /api/uploads/preview` — Previews scheduled upload timestamps across channels and days.
- `POST /api/uploads` — Creates scheduled clip upload jobs in `upload_jobs` table.
  - Body:
    ```json
    {
      "video_ids": ["videoId"],
      "channel_id": "channelId",
      "videos_per_day": 2,
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "timezone": "UTC",
      "clip_overrides": [{"clip_id": "videoId_1", "title": "...", "description": "..."}]
    }
    ```

### YouTube OAuth Flow (`/auth`)
- `GET /auth/youtube/status` — Checks whether OAuth client credentials are configured.
- `GET /auth/youtube/client-config` — Returns client ID and redirect URI (secret redacted).
- `PUT /auth/youtube/client-config` — Sets OAuth client ID, secret, and redirect URI.
- `POST /auth/youtube/client-secret` — Uploads a downloaded Google Cloud `client_secret.json` file.
- `GET /auth/youtube` — Initiates Google OAuth consent flow (redirects to Google).
- `GET /auth/youtube/callback` — Google OAuth redirect receiver; exchanges auth code for refresh token, queries channel profile, saves to `youtube_channels` table, redirects back to frontend.

### Static Asset Access
- `/storage/*` — Direct access to static media under `storage/` (e.g., `/storage/youtube/content/{video_id}/clips/{clip_name}.mp4`).

---

## 6. Core Data Models & Schemas

### SQLite `jobs` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `video_id` | TEXT | NOT NULL UNIQUE | YouTube video ID |
| `title` | TEXT | | Video title |
| `channel` | TEXT | | Channel name |
| `source` | TEXT | NOT NULL | `"search"` or `"direct_url"` |
| `trend_score` | REAL | DEFAULT NULL | Scored value (NULL until calculated) |
| `job_status` | TEXT | NOT NULL DEFAULT 'queued' | `queued`, `downloading`, `downloaded`, `transcribing`, `generating_clips`, `completed`, `failed` |
| `processing_state`| TEXT | NOT NULL DEFAULT 'pending' | `pending`, `processed`, `rejected`, `failed` |
| `video_state` | TEXT | NOT NULL DEFAULT 'in_queue'| `in_queue`, `active`, `archived` |
| `progress` | INTEGER | DEFAULT 0 | Completion percentage (0 to 100) |
| `error_message` | TEXT | | Failure traceback or error reason |
| `created_at` | DATETIME| DEFAULT CURRENT_TIMESTAMP | Enqueue timestamp |
| `updated_at` | DATETIME| DEFAULT CURRENT_TIMESTAMP | Last modification timestamp |

### SQLite `upload_jobs` Table
Tracks independently scheduled clip uploads:
- `source_video_id`, `clip_id`, `clip_filename`, `clip_path`
- `title`, `description`
- `channel_id`, `channel_name`
- `scheduled_publish_at`, `timezone`
- `upload_status` (`queued`, etc.), `youtube_video_id`, `error_message`

### SQLite Channel & OAuth Tables
- `youtube_channels`: `channel_id` (PK), `channel_name`, `default_description`, `client_id`, `client_secret`, `refresh_token`, `user_id`.
- `youtube_oauth_states`: CSRF verification tokens (`state` PK).
- `youtube_oauth_client_config`: Single-row config (`id=1`, `client_id`, `client_secret`, `redirect_uri`).

### Video Artifact `metadata.json`
Located at `storage/youtube/content/{video_id}/metadata.json`:
```json
{
  "id": "videoId",
  "title": "Video Title",
  "channel": {
    "name": "Channel Name",
    "id": "channelId",
    "subscriber_count": 50000
  },
  "url": "https://youtube.com/watch?v=videoId",
  "published_at": "2025-01-01T00:00:00Z",
  "statistics": { "views": 100000, "likes": 5000, "comments": 250 },
  "details": { "duration": 180.0 },
  "pipeline": {
    "downloaded": false,
    "transcript-analysed": false,
    "clips-processed": false,
    "processed": false
  },
  "trend_score": null
}
```

---

## 7. Algorithms & Mathematical Formulas

### Trend Scoring Formula (`trendCalculator.py`)
All divisions must be guarded with `max(val, 1)`:
```
velocity            = view_count / max(age_hours, 1.0)
like_rate           = like_count / max(view_count, 1)
comment_rate        = comment_count / max(view_count, 1)
subscriber_velocity = view_count / max(subscriber_count, 1)

engagement  = (0.5 * like_rate) + (0.3 * comment_rate) + (0.2 * subscriber_velocity)
trend_score = ln(velocity + 1.0) * engagement
```

---

## 8. Coding Standards & Conventions

1. **Python Quality**:
   - Strict typing hints across function definitions.
   - Guard every mathematical division against zero.
   - Use `app.database.get_db()` context manager / connection functions.
   - Do not delete existing comments and docstrings.
2. **Database Integrity**:
   - Preserve additive schema evolution in `init_db.py`.
   - Never run destructive table drops.
3. **Frontend & Styling**:
   - React 19 functional components with TypeScript.
   - Style with Tailwind CSS v4 using CSS variables and flex/grid layouts.
   - Centralize all API calls, WebSocket logic, and payload types in `frontend/src/services/api.ts`.
4. **Concurrency & Thread Safety**:
   - Update `config.json` only via `load_config()` and `save_config()` in `storage.py` to prevent race conditions.

---

## 9. Known Gotchas & Operational Traps

- **Two-Step Search & Rank**: `POST /api/search` enqueues jobs with `trend_score = NULL`. You must invoke `POST /api/trend/calculate` to score them before sorting or processing by trend rank.
- **Provider Seeding**: Calling `GET /api/config/llm/models` before `GET /api/config/llm/providers` may yield missing provider configurations. Always seed providers first.
- **ISO 8601 Timestamps**: Search date filters (`publishedAfter`, `publishedBefore`) require full RFC 3339 / ISO 8601 timestamps with timezone designator (e.g. `2025-01-01T00:00:00Z`).
- **WhisperX Requirements**: Requires FFmpeg on system `PATH`. When GPU is absent, model loader automatically falls back to CPU `int8`.
- **CORS Allowed Origins**: FastAPI defaults allow `http://localhost:3000` and `http://localhost:5173`. Add any other development or remote hosts in `main.py`.
