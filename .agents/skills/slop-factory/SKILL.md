---
name: slop-factory
description: >-
  Operational runbooks, workflows, API specifications, and troubleshooting for the
  Slop Factory video processing system, FastAPI backend, React dashboard, and SQLite job queue.
---

# Slop Factory Operational Skill

Use this skill when interacting with the Slop Factory application, executing pipeline jobs, managing the SQLite queue, configuring LLMs, or diagnosing backend/frontend issues.

---

## 1. Core Architecture & Workflow Sequence

```
1. Configuration      → PUT /api/config/llm/configure & PUT /api/config/search/params
2. Video Ingestion    → POST /api/search (query) or POST /api/jobs (direct URL)
3. Trend Scoring      → POST /api/trend/calculate (computes engagement velocity)
4. Media Processing   → POST /api/process (downloads, WhisperX, LLM clips, FFmpeg ASS)
5. Review & Edit      → GET /api/jobs/{video_id}/clips & PATCH /{video_id}/clips/{clip_id}
6. Channel Connect    → POST /auth/youtube/client-secret & GET /auth/youtube
7. Upload Schedule    → POST /api/uploads/preview & POST /api/uploads
```

---

## 2. Ingestion Workflows

### Method A: Keyword Search Ingestion
- Endpoint: `POST /api/search`
- Payload:
  ```json
  {
    "q": "tech documentary",
    "overrideParams": {
      "maxResults": 10,
      "order": "viewCount",
      "videoDuration": "medium"
    }
  }
  ```
- **Behavior**: Calls YouTube Data API v3, saves initial `metadata.json` in `storage/youtube/content/{video_id}/`, and inserts a job with `source="search"`, `job_status="queued"`, and `trend_score=NULL`.
- **Note**: Trend calculation is not run automatically.

### Method B: Direct URL Ingestion
- Endpoint: `POST /api/jobs` or `POST /api/jobs/url`
- Payload: `{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}`
- **Behavior**: Extracts metadata via `yt-dlp`, saves `metadata.json`, and records job with `source="direct_url"`. If the video already exists, returns `{"created": false, "job": {...}}`.

---

## 3. Trend Ranking Workflows

- **List Uncalculated Videos**:
  - `GET /api/trend/uncalculated` (optional filter: `?source=search`)
- **Calculate Trend Scores**:
  - `POST /api/trend/calculate`
  - Body (optional filters): `{"source": "search", "video_ids": ["vid1", "vid2"]}`
- **Score Formula**:
  $$\text{velocity} = \frac{\text{views}}{\max(\text{age\_hours}, 1.0)}$$
  $$\text{engagement} = 0.5 \times \frac{\text{likes}}{\max(\text{views}, 1)} + 0.3 \times \frac{\text{comments}}{\max(\text{views}, 1)} + 0.2 \times \frac{\text{views}}{\max(\text{subs}, 1)}$$
  $$\text{trend\_score} = \ln(\text{velocity} + 1.0) \times \text{engagement}$$
- Updates `metadata["trend_score"]` on disk and `jobs.trend_score` in SQLite.

---

## 4. Media Processing Workflows

- Endpoint: `POST /api/process`
- Payload:
  ```json
  {
    "video_ids": ["VIDEO_ID"],
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
- **Processing Steps Executed**:
  1. `downloader.py`: Downloads full MP4 video and `.en.vtt` subtitles with `yt-dlp`.
  2. `transcript.py`: Parses transcript, chunks into 100-sentence segments with 25-sentence overlap, invokes LLM (`create_llm()`) to identify high-hook viral clips, and saves `clipTimestamps.json`.
  3. `processor.py`: Extracts audio slices, runs WhisperX `large-v3` word alignment (CUDA float16 / CPU int8 fallback), generates ASS subtitle scripts, and cuts/burns clips via FFmpeg into `storage/youtube/content/{video_id}/clips/*.mp4`.
  4. Updates `job_status="completed"`, `processing_state="processed"`, `progress=100`.

---

## 5. Clip Review & Upload Scheduling

### Review & Edit Clips
- List clips: `GET /api/jobs/{video_id}/clips`
  - Returns clip URLs (`/storage/youtube/content/{video_id}/clips/{filename}`), duration, title, description, and AI scores.
- Edit clip title/description:
  - `PATCH /api/jobs/{video_id}/clips/{clip_id}`
  - Body: `{"title": "New Title", "description": "New Description"}`

### YouTube OAuth Setup
1. Check status: `GET /auth/youtube/status`
2. Upload client secret: `POST /auth/youtube/client-secret` (multipart form `file`)
3. Connect channel: Navigate user to `GET /auth/youtube` (initiates Google OAuth consent for `youtube.upload`).
4. Google redirects to `GET /auth/youtube/callback`, saving channel ID, name, and refresh token into `youtube_channels` table.

### Schedule Uploads
1. Preview schedule: `POST /api/uploads/preview`
   - Body: `{"video_ids": ["..."], "channel_id": "...", "videos_per_day": 2, "start_date": "YYYY-MM-DD", "start_time": "14:00", "timezone": "America/New_York"}`
2. Confirm & enqueue: `POST /api/uploads` (creates records in `upload_jobs`).

---

## 6. Database & State Management

- SQLite file: `storage/youtube/database/job.db`
- Inspect connection via `app.database.get_db()`.
- Additive schema migrations only:
  - Tables: `jobs`, `upload_jobs`, `youtube_channels`, `youtube_oauth_states`, `youtube_oauth_client_config`.
  - Check existing columns before adding new ones:
    ```python
    cols = {row[1] for row in db.execute("PRAGMA table_info(my_table)").fetchall()}
    if "new_col" not in cols:
        db.execute("ALTER TABLE my_table ADD COLUMN new_col TEXT")
    ```

---

## 7. Troubleshooting & Gotchas

- **WhisperX OOM / Device Error**: WhisperX defaults to `cuda` (`float16`). If no GPU is available, it falls back to `cpu` (`int8`). Ensure PyTorch CUDA 12.8 dependencies are installed via `uv sync`.
- **FFmpeg Not Found**: FFmpeg must be on Windows system `PATH`. Test with `ffmpeg -version`.
- **Corrupted `config.json`**: Always use `load_config()` and `save_config()` in `app.utils.storage`. These employ `_config_lock` and atomic `.tmp` replacement. If corrupted, defaults are automatically restored.
- **WebSocket Pull Protocol**: `/ws/jobs` only emits the job queue snapshot when the client sends a message over the socket.
