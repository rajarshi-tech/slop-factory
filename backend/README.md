# Slop Factory Backend

FastAPI service for YouTube ingestion, trend scoring, media processing, and scheduled clip uploads.

## Requirements

- Python 3.11
- FFmpeg on `PATH` for media processing
- A YouTube Data API v3 key for search and metadata ingestion
- Optional Gemini API key for the Gemini provider
- Optional Ollama installation for local LLM processing
- CUDA-capable PyTorch is recommended for WhisperX; CPU fallback is supported but slower

## Install

This project requires **Python 3.11** and uses `uv` for dependency management.

From this directory:

```powershell
uv python install 3.11
uv sync
.venv\Scripts\Activate.ps1
```

The project configures CUDA 12.8 builds of PyTorch, torchaudio, and torchvision through the `uv` index. Use the project dependency configuration when installing on a machine with a different PyTorch setup.

Create a `.env` file in the repository root when keys are not entered through the UI:

```env
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:8000/auth/youtube/callback
```

## Run

```powershell
fastapi dev src\backend\app\main.py
```

The API is available at `http://localhost:8000`. Interactive documentation is at `http://localhost:8000/docs`.

The database schema is created and upgraded additively during application startup. To initialize it explicitly:

```powershell
python -m app.init_db
```

## Main API Areas

- `/api/config` - LLM, search parameter, and API-key configuration
- `/api/search` - keyword-based YouTube ingestion
- `/api/jobs` - direct URL ingestion, job listing, and archiving
- `/api/trend` - trend score calculation for unranked jobs
- `/api/process` - download, transcribe, and generate clips
- `/api/uploads` - channel management and scheduled clip uploads
- `/auth/youtube` - Google OAuth connection for upload channels
- `/ws/jobs` - pull-based WebSocket snapshots of the job queue
- `/storage` - static access to generated artifacts

## Development Workflow

1. Add videos with `/api/search` or `/api/jobs`.
2. Calculate rankings with `/api/trend/calculate`.
3. Process selected videos with `/api/process`.
4. Configure a Google Web OAuth client and connect a YouTube channel.
5. Preview and create schedules through `/api/uploads/preview` and `/api/uploads`.

The SQLite database is stored at `storage/youtube/database/job.db`. Per-video media and metadata are stored under `storage/youtube/content/{video_id}`.
