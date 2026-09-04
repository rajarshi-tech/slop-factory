from typing import Optional, List
from app.database import get_db
from datetime import datetime


def create_tables():
    """Create the jobs table with indexes"""
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

    db.commit()
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