import json
import math
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.utils.storage import youtube_video_dir
from app.init_db import get_uncalculated_jobs, update_job


def calculateAgeHours(published_at: str) -> float:
    """Calculate the age of a video in hours from published_at ISO timestamp."""
    published_time = datetime.fromisoformat(
        published_at.replace("Z", "+00:00")
    )
    now = datetime.now(timezone.utc)
    time_diff = now - published_time
    age_hours = time_diff.total_seconds() / 3600
    return max(age_hours, 0.0)


def calculateRank(view_count: int, age_hours: float, like_count: int, comment_count: int, subscriber_count: int) -> float:
    """Calculate trend score using velocity and engagement rates with safe division."""
    velocity = view_count / max(age_hours, 1.0)

    # Safe division to prevent ZeroDivisionError
    like_rate = like_count / max(view_count, 1)
    comment_rate = comment_count / max(view_count, 1)
    subscriber_velocity = view_count / max(subscriber_count, 1)

    engagement = (0.5 * like_rate + 0.3 * comment_rate + 0.2 * subscriber_velocity)
    trend_score = math.log(velocity + 1.0) * engagement

    return float(trend_score)


def updateMetadata(video_id: str, trend_score: float) -> dict:
    """Update trend_score in the video's metadata.json."""
    video_dir = youtube_video_dir(video_id)
    metadata_path = video_dir / "metadata.json"

    with open(str(metadata_path), "r", encoding="utf-8") as f:
        metadata = json.load(f)

    metadata["trend_score"] = trend_score

    with open(str(metadata_path), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)

    return metadata


def calculate_trend_for_video(video_id: str) -> Optional[float]:
    """
    Calculate trend score for a single video from its metadata.json,
    update metadata.json, and update job.db.
    """
    video_dir = youtube_video_dir(video_id)
    metadata_path = video_dir / "metadata.json"

    if not metadata_path.exists():
        return None

    with open(str(metadata_path), "r", encoding="utf-8") as f:
        metadata = json.load(f)

    stats = metadata.get("statistics", {})
    channel = metadata.get("channel", {})
    published_at = metadata.get("published_at")

    if not published_at:
        return None

    view_count = int(stats.get("views", 0))
    like_count = int(stats.get("likes", 0))
    comment_count = int(stats.get("comments", 0))
    subscriber_count = int(channel.get("subscriber_count", 0))

    age_hours = calculateAgeHours(published_at)
    trend_score = calculateRank(view_count, age_hours, like_count, comment_count, subscriber_count)

    # Update metadata.json
    updateMetadata(video_id, trend_score)

    # Update job.db
    update_job(video_id, trend_score=trend_score)

    return trend_score


def calculate_uncalculated_trends(source: Optional[str] = "search") -> List[Dict[str, Any]]:
    """
    Fetch uncalculated videos from job.db, calculate their trend scores,
    and update both metadata.json and job.db.

    Args:
        source: Source filter ('search', 'direct_url', or None for all)

    Returns:
        List of dicts for all newly calculated videos
    """
    uncalculated_jobs = get_uncalculated_jobs(source=source)
    calculated_videos = []

    for job in uncalculated_jobs:
        video_id = job["video_id"]
        try:
            video_dir = youtube_video_dir(video_id)
            metadata_path = video_dir / "metadata.json"

            if not metadata_path.exists():
                print(f"Warning: metadata.json not found for video {video_id}")
                continue

            with open(str(metadata_path), "r", encoding="utf-8") as f:
                metadata = json.load(f)

            stats = metadata.get("statistics", {})
            channel = metadata.get("channel", {})
            published_at = metadata.get("published_at")

            if not published_at:
                print(f"Warning: published_at missing for video {video_id}")
                continue

            view_count = int(stats.get("views", 0))
            like_count = int(stats.get("likes", 0))
            comment_count = int(stats.get("comments", 0))
            subscriber_count = int(channel.get("subscriber_count", 0))

            age_hours = calculateAgeHours(published_at)
            trend_score = calculateRank(view_count, age_hours, like_count, comment_count, subscriber_count)

            # Update metadata.json
            updateMetadata(video_id, trend_score)

            # Update job.db
            updated_job = update_job(video_id, trend_score=trend_score)

            calculated_videos.append({
                "video_id": video_id,
                "title": job.get("title") or metadata.get("title"),
                "channel": job.get("channel") or channel.get("name"),
                "source": job.get("source"),
                "trend_score": trend_score,
                "view_count": view_count,
                "like_count": like_count,
                "comment_count": comment_count,
                "subscriber_count": subscriber_count,
                "age_hours": age_hours,
                "job": updated_job
            })

        except Exception as e:
            print(f"Error calculating trend for video {video_id}: {str(e)}")

    print(f"Trend scores calculated for {len(calculated_videos)} uncalculated videos...")
    return calculated_videos


def calculateTrend() -> List[Dict[str, Any]]:
    """Legacy alias for pipeline.py compatibility"""
    return calculate_uncalculated_trends(source="search")


def generateList(searchResults: list) -> list:
    """
    Legacy helper: Calculate trend scores for searchResults list and update metadata.
    """
    videos_with_trends = []

    for item in searchResults:
        link = item.get("link")
        video_id = item.get("id") or item.get("video_id")
        title = item.get("title")
        channel = item.get("channel")

        view_count = item.get("view_count", 0)
        like_count = item.get("like_count", 0)
        comment_count = item.get("comment_count", 0)
        subscriber_count = item.get("subscriber_count", 0)
        age_hours = calculateAgeHours(item.get("published_at"))

        trend_score = calculateRank(view_count, age_hours, like_count, comment_count, subscriber_count)

        updateMetadata(video_id, trend_score)

        videos_with_trends.append({
            "link": link,
            "video_id": video_id,
            "title": title,
            "channel": channel,
            "trend_score": trend_score
        })

    print(f"Trend scores calculated for {len(videos_with_trends)} videos...")
    return videos_with_trends

