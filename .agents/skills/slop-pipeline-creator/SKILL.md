---
name: slop-pipeline-creator
description: >-
  Step-by-step runbook and architectural checklist for scaffolding and implementing
  new content pipelines (e.g., Reddit, Twitter/X, Podcasts, TikTok) within the Slop Factory repository.
---

# Slop Factory Pipeline Creator Skill

Use this skill whenever you are tasked with creating, integrating, or refactoring a content pipeline in Slop Factory (such as implementing the `reddit` pipeline or introducing a new content source).

---

## 1. Multi-Pipeline Architecture Blueprint

Every pipeline must follow the standardized decoupled pattern established by the core YouTube pipeline:

```
backend/src/backend/app/pipeline/<source>/
├── __init__.py
├── scraper.py          # Query scraping & search ingestion
├── ranking.py          # Engagement velocity and trend calculation
├── downloader.py       # Source media/text acquisition
├── transcript.py       # Content analysis / chunking / LLM candidate discovery
├── processor.py        # Derivative asset generation (clipping, subtitle burning, audio)
└── pipeline.py         # End-to-end stage orchestrator
```

Coupled with isolated storage:
```
storage/<source>/
├── content/{item_id}/
│   ├── metadata.json       # Canonical state, metrics, and pipeline flags
│   └── ...                 # Raw and generated media artifacts
├── database/job.db         # Dedicated or shared SQLite database
└── config/config.json      # Pipeline-specific configurations and defaults
```

---

## 2. Implementation Runbook (Step-by-Step)

### Step 1: Storage Helpers & Partitioning
In `backend/src/backend/app/utils/storage.py`, define directory helpers for the new source:
```python
def <source>_item_dir(item_id: str) -> Path:
    """Storage directory for an item: storage/<source>/content/{item_id}/"""
    path = STORAGE / "<source>" / "content" / item_id
    path.mkdir(parents=True, exist_ok=True)
    return path

def <source>_config_dir() -> Path:
    path = STORAGE / "<source>" / "config"
    path.mkdir(parents=True, exist_ok=True)
    return path

def <source>_database_dir() -> Path:
    path = STORAGE / "<source>" / "database"
    path.mkdir(parents=True, exist_ok=True)
    return path
```

### Step 2: Establish the `metadata.json` Standard Contract
Each ingested item must have a `metadata.json` written to its directory before the job is queued in SQLite:
```json
{
  "id": "item_id_here",
  "title": "Item Title",
  "source": "<source>",
  "url": "https://...",
  "published_at": "ISO_8601_TIMESTAMP",
  "statistics": {
    "views": 0,
    "likes": 0,
    "comments": 0
  },
  "details": {},
  "pipeline": {
    "downloaded": false,
    "analysed": false,
    "processed": false
  },
  "trend_score": null,
  "created_at": "ISO_8601_TIMESTAMP",
  "updated_at": "ISO_8601_TIMESTAMP"
}
```

### Step 3: Implement Zero-Safe Scoring
Create `<source>/ranking.py` (or `trendCalculator.py`):
- **Rule**: Denominators must always be guarded using `max(val, 1)` or `max(val, 1.0)`.
- **Rule**: Calculations must be resilient to `None` values (default to `0`).
```python
def calculate_score(views: int, age_hours: float, engagement_actions: int) -> float:
    velocity = views / max(age_hours, 1.0)
    engagement_rate = engagement_actions / max(views, 1)
    return math.log(velocity + 1.0) * engagement_rate
```

### Step 4: Implement Resumable Pipeline Stages
Create `<source>/pipeline.py` with idempotent stage checks:
1. `is_acquired()`: Verifies if raw media/text exists and flag is set in `metadata.json`.
2. `is_analysed()`: Verifies if analysis/transcription output exists.
3. `is_processed()`: Verifies if derivative assets exist in `clips/` or `output/`.
4. Update SQLite status at each phase transition via `init_db.update_job(...)`:
   - `queued` → `downloading` → `downloaded` → `transcribing` → `generating_clips` → `completed` (or `failed`).

### Step 5: Route LLM Requests Through `create_llm()`
- Never import SDKs (`google-genai` or `ollama`) directly in pipeline logic.
- Import provider factory:
  ```python
  from app.llm.factory import create_llm
  llm = create_llm()
  response_text = llm.generate(prompt)
  ```

### Step 6: Additive Database Migrations
If the new pipeline requires additional fields on `jobs` or new tables:
1. Modify `backend/src/backend/app/init_db.py:create_tables()`.
2. For new tables: `CREATE TABLE IF NOT EXISTS <new_table> (...)`.
3. For new columns on `jobs`:
   ```python
   job_cols = {row[1] for row in db.execute("PRAGMA table_info(jobs)").fetchall()}
   if "<new_column>" not in job_cols:
       db.execute("ALTER TABLE jobs ADD COLUMN <new_column> TEXT")
   ```
4. Never drop tables or delete existing columns.

### Step 7: Expose API Router
Create `backend/src/backend/app/api/<source>.py`:
- Ingestion endpoint: `POST /api/<source>/search` or `POST /api/<source>/ingest`
- Trend ranking endpoint: `POST /api/<source>/trend/calculate`
- Processing endpoint: `POST /api/<source>/process`
- Mount router in `backend/src/backend/app/main.py`:
  ```python
  from app.api import <source>
  app.include_router(<source>.router, prefix="/api/<source>", tags=["<Source>"])
  ```

### Step 8: Frontend Centralization
1. Add TypeScript data types and REST endpoints to `frontend/src/services/api.ts`.
2. Expose the new source in navigation and component views.
3. Verify with `npm run build` and `npm run lint`.

---

## 3. Checklist Before Declaring a Pipeline Complete

- [ ] All media and scratch files write strictly to `storage/<source>/content/{item_id}/`.
- [ ] No hardcoded model vendors; all prompts use `create_llm()`.
- [ ] Every division in ranking algorithms uses `max(x, 1)`.
- [ ] Stage execution checks flags on disk to avoid re-running completed work.
- [ ] Pipeline catches exceptions and records `job_status="failed"` with `error_message`.
- [ ] Database schema changes in `init_db.py` are additive and backwards-compatible.
- [ ] TypeScript interfaces in `frontend/src/services/api.ts` match backend Pydantic models.
