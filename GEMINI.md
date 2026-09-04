# GEMINI.md - Antigravity & Gemini Workspace Instructions

## Project Context: Slop Factory
Slop Factory is an AI-assisted YouTube search, trend analysis, and video processing application.

## Stack
- **Backend**: FastAPI + SQLite (`storage/youtube/database/job.db`)
- **Frontend**: Vite + React 19 + Tailwind CSS v4
- **LLM**: Ollama (local) or Gemini (cloud), configured via `config.json`

## Workflow Rules
- **Search Ingestion**: `POST /api/search` — scrapes YouTube, writes `metadata.json`, queues jobs with `trend_score = NULL`.
- **Direct URL Ingestion**: `POST /api/jobs` with `{ url }` — fetches YouTube API metadata, writes `metadata.json`, inserts job.
- **Trend Calculation**: Call `POST /api/trend/calculate` after search to compute scores. Search never auto-calculates trends.
- **WebSocket**: `/ws/jobs` is pull-based — server sends a snapshot only when the client sends a message.

## Config API Routes (exact paths)
- `GET  /api/config/search/params/options` — read valid param values from `config.json`
- `PUT  /api/config/search/params`         — save updated search params to `config.json`
- `GET  /api/config/llm/providers`         — check Ollama/Gemini availability *(must run before `/llm/models`)*
- `GET  /api/config/llm/models`            — list models for all active providers
- `PUT  /api/config/llm/configure`         — set active provider + model

## metadata.json Schema (per video)
```json
{
  "id": "<video_id>",
  "title": "", "channel": { "name": "", "id": "", "subscriber_count": 0 },
  "url": "", "published_at": "",
  "statistics": { "views": 0, "likes": 0, "comments": 0 },
  "details": { "duration": 0.0 },
  "pipeline": { "downloaded": false, "transcript-analysed": false, "clips-processed": false },
  "trend_score": null
}
```

## Coding Conventions
- Always guard divisions with `max(x, 1)` in `trendCalculator.py` (zero-division safety).
- Do not break SQLite schema in `init_db.py`; add columns with `DEFAULT` values only.
- Frontend API calls all go through `services/api.ts` — update types there when adding endpoints.
