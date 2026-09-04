# GEMINI.md - Antigravity & Gemini Workspace Instructions

## Project Context: Slop Factory
Slop Factory is an AI-assisted YouTube search, trend analysis, and video processing application.

## Workflow Rules
- **Backend**: FastAPI with SQLite (`storage/youtube/database/job.db`).
- **Frontend**: Vite + React 19 + Tailwind CSS v4.
- **Trend Calculation**: Videos ingested via `POST /api/search` are queued with `trend_score = NULL`. Run `POST /api/trend/calculate` to process newly searched videos, update their `metadata.json`, and update `job.db`.
- **WebSocket Streaming**: Job updates are broadcast through `/ws/jobs`.
