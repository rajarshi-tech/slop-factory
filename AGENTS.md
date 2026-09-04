# AGENTS.md - Multi-Agent System Guidelines for Slop Factory

This file defines guidelines and standard operations for AI coding agents (Antigravity, Codex, Gemini, Cursor, Copilot).

## Project Overview
Slop Factory is an end-to-end automated YouTube processing suite:
1. Video Ingestion: Keyword search or Direct URL submission.
2. Ranking: Engagement velocity and trend score computation.
3. Media Processing: Audio transcription (WhisperX) and clip generation.

## Key Project Paths
- Backend Code: `backend/src/backend/app/`
- Backend API Routes: `backend/src/backend/app/api/` (`search.py`, `jobs.py`, `trend.py`, `config.py`)
- Pipeline Logic: `backend/src/backend/app/pipeline/youtube/`
- Frontend Code: `frontend/src/`
- Storage: `storage/youtube/` (`content/`, `database/job.db`, `config/config.json`)

## Execution Guidelines
- When adding new pipeline stages or API routes, preserve SQLite schema compatibility in `init_db.py`.
- Ensure zero-division safety when calculating statistics in `trendCalculator.py`.
- In the frontend, use Tailwind v4 styling with CSS variables and responsive flex/grid layouts.
