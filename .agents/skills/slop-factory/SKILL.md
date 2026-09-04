---
name: slop-factory
description: >-
  Workflows, operations, and architecture guidelines for Slop Factory video pipeline,
  FastAPI backend, React frontend, and SQLite job queue.
---

# Slop Factory Skill

## Overview
Slop Factory is an AI-driven YouTube pipeline that searches, downloads, transcribes, ranks, and clips video content.

## Common Workflows

### 1. Ingesting Videos
- **Search Query**: Call `POST /api/search` with JSON `{"q": "query", "overrideParams": {...}}`.
- **Direct URL**: Call `POST /api/jobs` with JSON `{"url": "https://youtube.com/watch?v=..."}`.

### 2. Calculating Trend Scores
- Check uncalculated videos: `GET /api/trend/uncalculated`.
- Execute calculation: `POST /api/trend/calculate`.
- This evaluates engagement rate + view velocity and writes results to `metadata.json` and `job.db`.

### 3. Monitoring Jobs
- REST: `GET /api/jobs`.
- WebSocket: Connect to `ws://localhost:8000/ws/jobs`.
- Inspect single job: `GET /api/jobs/{video_id}`.
