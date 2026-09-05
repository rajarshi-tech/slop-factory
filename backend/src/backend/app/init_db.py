from typing import Optional, List
from app.database import get_db
from datetime import datetime


def create_tables():
    """Create the jobs and upload-jobs tables with indexes."""
    db = get_db()

    db.execute("""
    CREATE TABLE IF NOT EXISTS jobs (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        video_id TEXT NOT NULL UNIQUE,

        title TEXT,
        channel TEXT,

        source TEXT NOT NULL,
        /*
        search
        direct_url
        */

        trend_score REAL DEFAULT NULL,

        job_status TEXT NOT NULL DEFAULT 'queued',
        /*
        queued
        downloading
        downloaded
        transcribing
        generating_clips
        completed
        failed
        */

        processing_state TEXT NOT NULL DEFAULT 'pending',
        /*
        pending
        processed
        rejected
        failed
        */

        video_state TEXT NOT NULL DEFAULT 'in_queue',
        /*
        in_queue
        active
        archived
        */

        progress INTEGER DEFAULT 0,

        error_message TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Create indexes for faster queries
    db.execute("CREATE INDEX IF NOT EXISTS idx_job_status ON jobs(job_status)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON jobs(created_at DESC)")

    # Upload jobs intentionally live separately from source-video jobs. A single
    # processed source video can create several clips, each with its own YouTube
    # upload lifecycle and publish time.
    db.execute("""
    CREATE TABLE IF NOT EXISTS upload_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_video_id TEXT NOT NULL,
        clip_id TEXT NOT NULL,
        clip_filename TEXT NOT NULL,
        clip_path TEXT NOT NULL,
        title TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        scheduled_publish_at TEXT NOT NULL,
        timezone TEXT NOT NULL,
        upload_status TEXT NOT NULL DEFAULT 'queued',
        youtube_video_id TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    db.execute("CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(upload_status)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_upload_jobs_schedule ON upload_jobs(scheduled_publish_at)")

    db.execute("""
    CREATE TABLE IF NOT EXISTS youtube_channels (
        channel_id TEXT PRIMARY KEY,
        channel_name TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    db.execute("""
    CREATE TABLE IF NOT EXISTS youtube_oauth_states (
        state TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    db.execute("""
    CREATE TABLE IF NOT EXISTS youtube_oauth_client_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    db.commit()
    db.close()


def create_upload_jobs(upload_jobs: List[dict]) -> List[dict]:
    """Persist a batch of independently trackable clip upload jobs."""
    if not upload_jobs:
        return []

    db = get_db()
    try:
        now = datetime.now().isoformat()
        created = []
        for job in upload_jobs:
            cursor = db.execute("""
                INSERT INTO upload_jobs (
                    source_video_id, clip_id, clip_filename, clip_path, title,
                    channel_id, channel_name, scheduled_publish_at, timezone,
                    upload_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
            """, (
                job["source_video_id"], job["clip_id"], job["clip_filename"],
                job["clip_path"], job["title"], job["channel_id"],
                job["channel_name"], job["scheduled_publish_at"], job["timezone"],
                now, now,
            ))
            row = db.execute("SELECT * FROM upload_jobs WHERE id = ?", (cursor.lastrowid,)).fetchone()
            created.append(dict(row))
        db.commit()
        return created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_upload_job(upload_job_id: int, **kwargs):
    """Update an upload job without allowing arbitrary SQL field values."""
    allowed_fields = {"upload_status", "youtube_video_id", "error_message"}
    changes = {key: value for key, value in kwargs.items() if key in allowed_fields}
    if not changes:
        return None

    db = get_db()
    try:
        fields = [f"{key} = ?" for key in changes]
        values = list(changes.values())
        fields.append("updated_at = ?")
        values.append(datetime.now().isoformat())
        values.append(upload_job_id)
        db.execute(f"UPDATE upload_jobs SET {', '.join(fields)} WHERE id = ?", values)
        db.commit()
        row = db.execute("SELECT * FROM upload_jobs WHERE id = ?", (upload_job_id,)).fetchone()
        return dict(row) if row else None
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_youtube_channels() -> List[dict]:
    db = get_db()
    try:
        rows = db.execute(
            "SELECT channel_id, channel_name, created_at, updated_at FROM youtube_channels ORDER BY channel_name COLLATE NOCASE"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()


def get_youtube_channel(channel_id: str) -> Optional[dict]:
    db = get_db()
    try:
        row = db.execute("SELECT * FROM youtube_channels WHERE channel_id = ?", (channel_id,)).fetchone()
        return dict(row) if row else None
    finally:
        db.close()


def save_youtube_channel(channel_id: str, channel_name: str, client_id: str, client_secret: str, refresh_token: str, user_id: Optional[str] = None) -> dict:
    """Upsert a server-only OAuth credential for an authenticated channel."""
    db = get_db()
    try:
        now = datetime.now().isoformat()
        db.execute("""
            INSERT INTO youtube_channels (
                channel_id, channel_name, client_id, client_secret, refresh_token, user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(channel_id) DO UPDATE SET
                channel_name = excluded.channel_name,
                client_id = excluded.client_id,
                client_secret = excluded.client_secret,
                refresh_token = excluded.refresh_token,
                user_id = excluded.user_id,
                updated_at = excluded.updated_at
        """, (channel_id, channel_name, client_id, client_secret, refresh_token, user_id, now, now))
        db.commit()
        return get_youtube_channel(channel_id) or {}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_youtube_channel(channel_id: str) -> bool:
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM youtube_channels WHERE channel_id = ?", (channel_id,))
        db.commit()
        return cursor.rowcount > 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_youtube_oauth_state(state: str) -> None:
    db = get_db()
    try:
        db.execute("DELETE FROM youtube_oauth_states WHERE created_at < datetime('now', '-15 minutes')")
        db.execute("INSERT INTO youtube_oauth_states (state) VALUES (?)", (state,))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def consume_youtube_oauth_state(state: str) -> bool:
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM youtube_oauth_states WHERE state = ?", (state,))
        db.commit()
        return cursor.rowcount == 1
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_youtube_oauth_client_config() -> Optional[dict]:
    db = get_db()
    try:
        row = db.execute("SELECT client_id, client_secret, created_at, updated_at FROM youtube_oauth_client_config WHERE id = 1").fetchone()
        return dict(row) if row else None
    finally:
        db.close()


def save_youtube_oauth_client_config(client_id: str, client_secret: str) -> None:
    """Store the OAuth application's client secret server-side for channel connection."""
    db = get_db()
    try:
        now = datetime.now().isoformat()
        db.execute("""
            INSERT INTO youtube_oauth_client_config (id, client_id, client_secret, created_at, updated_at)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                client_id = excluded.client_id,
                client_secret = excluded.client_secret,
                updated_at = excluded.updated_at
        """, (client_id, client_secret, now, now))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def insert_job(video_id: str, title: str, channel: str, source: str, trend_score: Optional[float] = None):
    """
    Insert a new job into the database.

    Args:
        video_id: YouTube video ID
        title: Video title
        channel: Channel name
        source: 'search' or 'direct_url'
        trend_score: Trend score (default None)

    Returns:
        dict: The created job
    """
    db = get_db()

    try:
        db.execute("""
            INSERT INTO jobs (video_id, title, channel, source, trend_score)
            VALUES (?, ?, ?, ?, ?)
        """, (video_id, title, channel, source, trend_score))

        db.commit()

        # Fetch and return the created job
        job = db.execute(
            "SELECT * FROM jobs WHERE video_id = ?",
            (video_id,)
        ).fetchone()

        return dict(job)
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def update_job(video_id: str, **kwargs):
    """
    Update job fields.

    Args:
        video_id: YouTube video ID
        **kwargs: Fields to update (job_status, progress, error_message, etc.)

    Returns:
        dict: The updated job
    """
    db = get_db()

    try:
        # Build dynamic UPDATE query
        fields = []
        values = []

        for key, value in kwargs.items():
            fields.append(f"{key} = ?")
            values.append(value)

        # Always update updated_at
        fields.append("updated_at = ?")
        values.append(datetime.now().isoformat())

        values.append(video_id)

        query = f"UPDATE jobs SET {', '.join(fields)} WHERE video_id = ?"

        db.execute(query, values)
        db.commit()

        # Fetch and return updated job
        job = db.execute(
            "SELECT * FROM jobs WHERE video_id = ?",
            (video_id,)
        ).fetchone()

        return dict(job) if job else None
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def get_job(video_id: str):
    """Get a single job by video_id"""
    db = get_db()
    job = db.execute(
        "SELECT * FROM jobs WHERE video_id = ?",
        (video_id,)
    ).fetchone()
    db.close()

    return dict(job) if job else None


def get_all_jobs():
    """Get all jobs ordered by created_at DESC"""
    db = get_db()
    jobs = db.execute(
        "SELECT * FROM jobs ORDER BY created_at DESC"
    ).fetchall()
    db.close()

    return [dict(job) for job in jobs]


def get_uncalculated_jobs(source: Optional[str] = "search"):
    """
    Get jobs whose trend score has not been calculated yet.

    Args:
        source: Optional source filter ('search', 'direct_url', or None for all)

    Returns:
        List of uncalculated job dicts ordered by created_at ASC
    """
    db = get_db()
    if source:
        jobs = db.execute(
            "SELECT * FROM jobs WHERE source = ? AND trend_score IS NULL ORDER BY created_at ASC",
            (source,)
        ).fetchall()
    else:
        jobs = db.execute(
            "SELECT * FROM jobs WHERE trend_score IS NULL ORDER BY created_at ASC"
        ).fetchall()
    db.close()

    return [dict(job) for job in jobs]


def archive_jobs(video_ids: List[str]) -> int:
    """
    Set video_state to 'archived' for a list of video_ids.

    Args:
        video_ids: List of YouTube video IDs

    Returns:
        int: Number of updated rows
    """
    if not video_ids:
        return 0

    db = get_db()
    try:
        now = datetime.now().isoformat()
        placeholders = ",".join(["?"] * len(video_ids))
        query = f"""
            UPDATE jobs 
            SET video_state = 'archived', updated_at = ? 
            WHERE video_id IN ({placeholders})
        """
        cursor = db.execute(query, [now] + list(video_ids))
        db.commit()
        return cursor.rowcount
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def unarchive_jobs(video_ids: List[str]) -> int:
    """
    Restore archived jobs to the queue while preserving their processing state.

    Args:
        video_ids: List of YouTube video IDs

    Returns:
        int: Number of updated rows
    """
    if not video_ids:
        return 0

    db = get_db()
    try:
        now = datetime.now().isoformat()
        placeholders = ",".join(["?"] * len(video_ids))
        query = f"""
            UPDATE jobs
            SET video_state = 'in_queue', updated_at = ?
            WHERE video_state = 'archived' AND video_id IN ({placeholders})
        """
        cursor = db.execute(query, [now] + list(video_ids))
        db.commit()
        return cursor.rowcount
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def delete_jobs(video_ids: List[str]) -> int:
    """
    Delete jobs from the database for a list of video_ids.

    Args:
        video_ids: List of YouTube video IDs

    Returns:
        int: Number of deleted rows
    """
    if not video_ids:
        return 0

    db = get_db()
    try:
        placeholders = ",".join(["?"] * len(video_ids))
        query = f"DELETE FROM jobs WHERE video_id IN ({placeholders})"
        cursor = db.execute(query, list(video_ids))
        db.commit()
        return cursor.rowcount
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    create_tables()
