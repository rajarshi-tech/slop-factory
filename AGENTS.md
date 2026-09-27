# AGENTS.md - Multi-Agent System Guidelines for Slop Factory

This document establishes operational principles, architectural boundaries, coding standards, and expansion patterns for AI coding agents (Antigravity, Codex, Gemini, Cursor, Copilot) working in the Slop Factory repository.

---

## 1. Project Overview & Multi-Pipeline Architecture

Slop Factory is an automated video research, media processing, and scheduled distribution system. The codebase is organized into decoupled layers:
- **Backend API (`backend/src/backend/app/api/`)**: FastAPI service managing configuration, ingestion, job queuing, trend scoring, media processing, and OAuth/upload scheduling.
- **Processing Pipelines (`backend/src/backend/app/pipeline/<source>/`)**: Source-specific workflows (e.g., `youtube`, `reddit`) handling scraping, ranking, downloading, transcription, and clip generation.
- **Frontend Dashboard (`frontend/src/`)**: React 19 + Vite dashboard styled with Tailwind CSS v4 and responsive layouts.
- **Storage Subsystem (`storage/<source>/`)**: Local persistence isolating databases, configurations, and media artifacts per pipeline.

### Multi-Pipeline Expansion Blueprint
The repository is designed to host multiple independent pipelines (e.g., `youtube`, `reddit`):
1. **Pipeline Directory**: Place source-specific ingestion, analysis, and processing modules under `backend/src/backend/app/pipeline/<source>/`. Keep processing logic decoupled from API routing.
2. **Storage Partitioning**: Namespace all media artifacts, source databases, and configs under `storage/<source>/` via path helpers in `backend/src/backend/app/utils/storage.py` (e.g., `storage/<source>/content/{item_id}/`).
3. **Standard Pipeline Stages**: Every pipeline should implement consistent phase boundaries:
   - *Ingestion*: Query-based scraping or direct URL/ID submission -> saves initial `metadata.json` -> enqueues job in SQLite.
   - *Ranking & Scoring*: Zero-division-safe velocity and engagement calculations.
   - *Media Acquisition*: Fetch media files (video/audio/text) with resumption checks.
   - *Content Understanding*: Transcript extraction, audio alignment (WhisperX), or text chunking.
   - *Derivative Asset Generation*: LLM candidate selection -> FFmpeg clipping and subtitle burning -> output registration.
   - *Distribution*: Publishing/upload workflows with independent schedule tracking.
4. **Router Registration**: Expose pipeline routes in `backend/src/backend/app/api/` and mount them in `main.py`.

---

## 2. Core Architectural Principles & Boundaries

1. **Strict Storage Boundaries**:
   - Never write media artifacts or scratch files directly into the source code tree (`backend/` or `frontend/`).
   - Store all runtime media in `storage/<source>/content/{item_id}/`.
   - Serve client-facing artifacts through the FastAPI static mount at `/storage` (`http://localhost:8000/storage/...`).

2. **Idempotency & Safe Resumption**:
   - Media downloads, transcriptions, and video encoding are computationally expensive.
   - Pipeline stages must verify whether work has already completed before executing (e.g., checking `metadata["pipeline"][stage]` flags and file existence on disk). Never overwrite completed artifacts unless explicitly requested.

3. **Provider-Agnostic LLM Integration**:
   - All AI prompt invocations must route through `app.llm.base.LLMProvider` instantiated via `app.llm.factory.create_llm()`.
   - Never couple pipeline logic directly to vendor-specific SDKs (`google-genai` or `ollama`) outside of `app/llm/providers/`.

4. **Independent Lifecycle for Derivative Assets**:
   - Source content jobs (`jobs` table) track the ingestion, download, transcription, and clip creation lifecycle.
   - Derivative assets intended for publishing (e.g., individual short-form clips) must be tracked independently in separate tables (e.g., `upload_jobs`), linked back via `source_video_id`.

---

## 3. Database & State Management Rules

1. **Additive Schema Migrations Only**:
   - The primary database is SQLite at `storage/youtube/database/job.db` (managed via `app.database.get_db()`).
   - Schema creation and column additions occur on application startup in `backend/src/backend/app/init_db.py:create_tables()`.
   - When modifying schemas, always preserve backwards compatibility:
     - Use `CREATE TABLE IF NOT EXISTS` for new tables.
     - For table alterations, inspect existing columns via `PRAGMA table_info(<table_name>)` before issuing `ALTER TABLE <table_name> ADD COLUMN ...`.
     - Never execute destructive `DROP TABLE` or table recreations without migration scripts.

2. **Synchronization Between DB & Disk**:
   - Each content item maintains both a database record (`jobs` table) and a filesystem artifact (`metadata.json`).
   - Keep status flags synchronized: `job_status`, `processing_state`, and `video_state` in SQLite must reflect the state recorded in `metadata.json`.

3. **Thread-Safe Configuration Persistence**:
   - Global parameters and provider settings reside in `storage/youtube/config/config.json`.
   - Reads and writes to `config.json` must use `load_config()` and `save_config()` in `app/utils/storage.py`, which use threading locks (`_config_lock`) and atomic temporary-file replacement (`.tmp` -> replace).

---

## 4. Coding Conventions & Guardrails

### Backend (Python 3.11)
- **Zero-Division Safety**: When calculating velocity, engagement, or statistical ratios (in `trendCalculator.py` or new pipelines), denominators MUST always be guarded using `max(denominator, 1)` or `max(denominator, 1.0)`.
- **Error Propagation & Job Status**: Pipeline tasks must catch exceptions, update the database record with `job_status="failed"` and the `error_message`, and log errors without crashing the main FastAPI worker.
- **External Dependencies**:
  - `ffmpeg`: Required on the system `PATH` for audio extraction, clip slicing, and subtitle burning.
  - `WhisperX`: Uses `large-v3` with word alignment models; lazy-load weights only when media processing begins. Fallback safely from CUDA (`float16`) to CPU (`int8`) when GPUs are unavailable.
- **Comments & Docstrings**: Maintain existing docstrings and comments. Do not remove explanatory code comments when refactoring.

### Frontend (React 19 + TypeScript + Vite)
- **Styling**: Use Tailwind CSS v4 syntax with CSS variables and responsive flex/grid layouts. Avoid Tailwind v3 config patterns.
- **API Contracts**: Centralize all REST endpoints, WebSocket interactions, and TypeScript data types in `frontend/src/services/api.ts`. Keep frontend interface definitions in sync with backend Pydantic models.
- **WebSocket Protocol**: `/ws/jobs` operates as a pull-based WebSocket (the backend returns a full job queue snapshot in response to client messages).
- **Component Separation**: Maintain distinct sections for ingestion, trend calculation, active queue, processed clips, channel OAuth management, scheduling, and configuration settings.

---

## 5. Environment & Development Commands

### Backend (PowerShell on Windows)
```powershell
cd backend
uv python install 3.11
uv sync
.venv\Scripts\Activate.ps1

# Run development server with auto-reload (port 8000)
fastapi dev src\backend\app\main.py

# Explicit uvicorn execution
uvicorn src.backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Initialize/upgrade SQLite schema manually
python -m app.init_db
```

### Frontend (PowerShell on Windows)
```powershell
cd frontend
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # Type-check and production bundle build
npm run lint     # ESLint checks
```

---

## 6. Agent Modification Policy
- Only edit files directly required to fulfill the user's explicit request.
- When adding new features or pipeline stages, write defensive unit-level code that gracefully handles missing files, empty responses, network drops, and corrupted JSON configurations.
- Verify changes with `npm run build` / `npm run lint` for frontend edits and import/syntax sanity checks for backend edits before declaring completion.

---

## 7. Installed Workspace Skills
The repository includes dedicated skills under `.agents/skills/`:
- **`slop-factory`** (`.agents/skills/slop-factory/SKILL.md`): Master operational runbook for YouTube ingestion, trend scoring, media processing, SQLite state tracking, and YouTube OAuth channel scheduling.
- **`slop-pipeline-creator`** (`.agents/skills/slop-pipeline-creator/SKILL.md`): Step-by-step checklist and architecture pattern for scaffolding new pipeline sources (e.g., Reddit, TikTok, Podcasts).
- **`media-processing`** (`.agents/skills/media-processing/SKILL.md`): Deep guide for FFmpeg audio extraction, WhisperX alignment, and ASS subtitle generation (`plain`, `karaoke_sentence`, `word_level`).

