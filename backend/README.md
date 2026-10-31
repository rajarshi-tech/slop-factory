# Slop Factory Backend

FastAPI service for YouTube ingestion, Reddit text-to-video processing, media processing, and scheduled clip uploads.

## Requirements

- Python 3.11
- FFmpeg on `PATH` for media processing
- Coqui TTS for Reddit text-to-speech processing
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
- `/api/reddit` - paste text into an independent queue, process selected items, and archive/delete them
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

Reddit jobs use a separate database at `storage/reddit/database/job.db`. Pasted scripts and generated audio, subtitles, metadata, and videos are stored under `storage/reddit/content/{item_id}`. Upload an MP4 gameplay/background video to `POST /api/reddit/background-video` before processing Reddit items. Processing uses Coqui TTS and the existing WhisperX `large-v3` model configuration.

Reddit workflow:

1. `POST /api/reddit` with `{"text": "Your script", "title": "Optional title"}` to queue text without processing it.
2. Upload an MP4 background once with `POST /api/reddit/background-video` (multipart field `file`).
3. Process selected queue items with `POST /api/reddit/process`. The request may include a `subtitle_config` with `enabled`, `style` (`plain`, `karaoke_sentence`, or `word_level`), `font_name`, `font_size`, `normal_color`, `highlight_color`, `outline_color`, `outline_width`, `shadow`, `bold`, and `position`.
4. Manage queue entries with `POST /api/reddit/archive`, `POST /api/reddit/unarchive`, or `DELETE /api/reddit` using `{"item_ids": ["..."]}`. The pull-based queue socket is `/api/reddit/ws`.
5. Connect a YouTube channel, then use `POST /api/uploads/preview` and `POST /api/uploads` with the Reddit item ID in `video_ids` to preview and schedule its rendered MP4. A Reddit item is treated as one uploadable video.

Reddit renders use the generated narration as their audio track and end when that narration finishes. Subtitle settings are saved with the rendered item; processing again with different settings re-renders the video.
