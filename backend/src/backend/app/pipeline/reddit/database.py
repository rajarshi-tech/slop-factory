from datetime import datetime
from typing import Optional

from app.database import get_reddit_db


def create_tables() -> None:
    db = get_reddit_db()
    try:
        db.execute("""
            CREATE TABLE IF NOT EXISTS reddit_jobs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                text_content TEXT NOT NULL,
                source_url TEXT,
                subreddit TEXT,
                job_status TEXT NOT NULL DEFAULT 'queued',
                processing_state TEXT NOT NULL DEFAULT 'pending',
                video_state TEXT NOT NULL DEFAULT 'in_queue',
                progress INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_reddit_job_status ON reddit_jobs(job_status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_reddit_created_at ON reddit_jobs(created_at DESC)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_reddit_video_state ON reddit_jobs(video_state)")
        db.commit()
    finally:
        db.close()


def insert_job(
    item_id: str,
    title: str,
    text_content: str,
    source_url: Optional[str] = None,
    subreddit: Optional[str] = None,
) -> dict:
    db = get_reddit_db()
    try:
        db.execute(
            """
            INSERT INTO reddit_jobs (id, title, text_content, source_url, subreddit)
            VALUES (?, ?, ?, ?, ?)
            """,
            (item_id, title, text_content, source_url, subreddit),
        )
        db.commit()
        row = db.execute("SELECT * FROM reddit_jobs WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            raise RuntimeError(f"Reddit job {item_id} was inserted but could not be retrieved")
        return dict(row)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_job(item_id: str, **fields) -> Optional[dict]:
    allowed_fields = {
        "title", "text_content", "source_url", "subreddit", "job_status",
        "processing_state", "video_state", "progress", "error_message",
    }
    changes = {key: value for key, value in fields.items() if key in allowed_fields}
    if not changes:
        return get_job(item_id)

    db = get_reddit_db()
    try:
        assignments = [f"{key} = ?" for key in changes]
        values = list(changes.values())
        assignments.append("updated_at = ?")
        values.extend((datetime.now().isoformat(), item_id))
        db.execute(
            f"UPDATE reddit_jobs SET {', '.join(assignments)} WHERE id = ?",
            values,
        )
        db.commit()
        row = db.execute("SELECT * FROM reddit_jobs WHERE id = ?", (item_id,)).fetchone()
        return dict(row) if row else None
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_job(item_id: str) -> Optional[dict]:
    db = get_reddit_db()
    try:
        row = db.execute("SELECT * FROM reddit_jobs WHERE id = ?", (item_id,)).fetchone()
        return dict(row) if row else None
    finally:
        db.close()


def get_all_jobs() -> list[dict]:
    db = get_reddit_db()
    try:
        rows = db.execute("""
            SELECT id, title, source_url, subreddit, job_status, processing_state,
                   video_state, progress, error_message, created_at, updated_at
            FROM reddit_jobs ORDER BY created_at DESC
        """).fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()


def archive_jobs(item_ids: list[str]) -> int:
    return _set_video_state(item_ids, "archived")


def unarchive_jobs(item_ids: list[str]) -> int:
    return _set_video_state(item_ids, "in_queue", only_archived=True)


def _set_video_state(item_ids: list[str], state: str, only_archived: bool = False) -> int:
    if not item_ids:
        return 0
    placeholders = ",".join("?" for _ in item_ids)
    archived_filter = " AND video_state = 'archived'" if only_archived else ""
    db = get_reddit_db()
    try:
        cursor = db.execute(
            f"UPDATE reddit_jobs SET video_state = ?, updated_at = ? "
            f"WHERE id IN ({placeholders}){archived_filter}",
            [state, datetime.now().isoformat(), *item_ids],
        )
        db.commit()
        return cursor.rowcount
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_jobs(item_ids: list[str]) -> int:
    if not item_ids:
        return 0
    placeholders = ",".join("?" for _ in item_ids)
    db = get_reddit_db()
    try:
        cursor = db.execute(f"DELETE FROM reddit_jobs WHERE id IN ({placeholders})", item_ids)
        db.commit()
        return cursor.rowcount
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
