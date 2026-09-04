import re
import json
import shutil
from fastapi import APIRouter, WebSocket, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.init_db import insert_job, get_job, get_all_jobs, archive_jobs, delete_jobs
from app.utils.storage import youtube_video_dir, STORAGE
from app.core.config import YOUTUBE_API_KEY
from app.pipeline.youtube.trendCalculator import calculate_trend_for_video
from googleapiclient.discovery import build
import isodate


router = APIRouter()


class DirectURLRequest(BaseModel):
    url: str


class ArchiveRequest(BaseModel):
    video_ids: Optional[List[str]] = None
    video_id: Optional[str] = None


class DeleteJobsRequest(BaseModel):
    video_ids: Optional[List[str]] = None
    video_id: Optional[str] = None


def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


@router.get("")
async def list_jobs():
    """Get all jobs ordered by created_at DESC"""
    try:
        jobs = get_all_jobs()
        return {
            "jobs": jobs,
            "count": len(jobs)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch jobs: {str(e)}"
        )


@router.get("/{video_id}")
async def get_job_by_id(video_id: str):
    """Get a specific job by video_id"""
    try:
        job = get_job(video_id)

        if not job:
            raise HTTPException(
                status_code=404,
                detail=f"Job with video_id {video_id} not found"
            )

        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch job: {str(e)}"
        )


@router.post("")
@router.post("/url")
async def create_job_from_url(request: DirectURLRequest):
    """
    Create a job from a direct YouTube URL.

    Args:
        request: DirectURLRequest with YouTube URL

    Returns:
        Created job dict
    """
    try:
        # Extract video ID
        video_id = extract_video_id(request.url)

        if not video_id:
            raise HTTPException(
                status_code=400,
                detail="Invalid YouTube URL. Could not extract video ID."
            )

        # Check if job already exists
        existing_job = get_job(video_id)
        if existing_job:
            return {
                "job": existing_job,
                "message": "Job already exists",
                "created": False
            }

        # Fetch video metadata from YouTube API
        youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

        # Get video details
        video_response = youtube.videos().list(
            part="snippet,statistics,contentDetails",
            id=video_id
        ).execute()

        if not video_response["items"]:
            raise HTTPException(
                status_code=404,
                detail=f"Video {video_id} not found on YouTube"
            )

        video_data = video_response["items"][0]
        snippet = video_data["snippet"]
        stats = video_data.get("statistics", {})
        content_details = video_data.get("contentDetails", {})

        # Get channel statistics
        channel_id = snippet["channelId"]
        channel_response = youtube.channels().list(
            part="statistics",
            id=channel_id
        ).execute()

        channel_stats = {}
        if channel_response["items"]:
            channel_stats = channel_response["items"][0]["statistics"]

        # Parse duration
        duration = 0
        if "duration" in content_details:
            duration = isodate.parse_duration(content_details["duration"]).total_seconds()

        # Create metadata.json
        metadata = {
            "id": video_id,
            "title": snippet["title"],
            "channel": {
                "name": snippet["channelTitle"],
                "id": channel_id,
                "subscriber_count": int(channel_stats.get("subscriberCount", 0))
            },
            "url": f"https://youtube.com/watch?v={video_id}",
            "published_at": snippet["publishedAt"],
            "statistics": {
                "views": int(stats.get("viewCount", 0)),
                "likes": int(stats.get("likeCount", 0)),
                "comments": int(stats.get("commentCount", 0))
            },
            "details": {
                "duration": float(duration)
            },
            "pipeline": {
                "downloaded": False,
                "transcript-analysed": False,
                "clips-processed": False
            }
        }

        # Save metadata
        video_dir = youtube_video_dir(video_id)
        with open(str(video_dir / "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4, ensure_ascii=False)

        # Calculate trend score immediately from freshly written metadata
        trend_score = calculate_trend_for_video(video_id)

        # Insert job into database (with trend score already calculated)
        job = insert_job(
            video_id=video_id,
            title=snippet["title"],
            channel=snippet["channelTitle"],
            source="direct_url",
            trend_score=trend_score
        )

        return {
            "job": job,
            "message": "Job created successfully",
            "created": True
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create job: {str(e)}"
        )


@router.post("/archive")
@router.put("/archive")
async def archive_videos(request: ArchiveRequest):
    """
    Set video_state to 'archived' in the job database for specified video IDs.

    Args:
        request: ArchiveRequest with video_ids array or video_id string

    Returns:
        JSON response with archived count and video IDs
    """
    try:
        video_ids = request.video_ids or ([] if not request.video_id else [request.video_id])

        if not video_ids:
            raise HTTPException(
                status_code=400,
                detail="No video_ids provided in request body."
            )

        archived_count = archive_jobs(video_ids)

        return {
            "status": "success",
            "archived_count": archived_count,
            "video_ids": video_ids,
            "message": f"Successfully set {archived_count} video(s) to archived."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to archive videos: {str(e)}"
        )


@router.post("/delete")
@router.delete("/delete")
@router.delete("")
async def delete_videos(request: DeleteJobsRequest):
    """
    Delete jobs from DB and remove their content directory and all related files.

    Args:
        request: DeleteJobsRequest with video_ids array or video_id string

    Returns:
        JSON response with deleted count and video IDs
    """
    try:
        video_ids = request.video_ids or ([] if not request.video_id else [request.video_id])

        if not video_ids:
            raise HTTPException(
                status_code=400,
                detail="No video_ids provided in request body."
            )

        # Remove video content folders and files
        for vid in video_ids:
            content_dir = STORAGE / "youtube" / "content" / vid
            if content_dir.exists() and content_dir.is_dir():
                shutil.rmtree(content_dir, ignore_errors=True)

        # Delete matching job rows from SQLite
        deleted_count = delete_jobs(video_ids)

        return {
            "status": "success",
            "deleted_count": deleted_count,
            "video_ids": video_ids,
            "message": f"Successfully deleted {deleted_count} video(s) and associated files."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete videos: {str(e)}"
        )


@router.websocket("/jobs")
async def jobs_socket(websocket: WebSocket):
    """WebSocket endpoint for live job updates"""
    await websocket.accept()

    while True:
        db = get_db()

        jobs = db.execute(
            "SELECT * FROM jobs ORDER BY created_at DESC"
        ).fetchall()

        await websocket.send_json({
            "jobs": [
                dict(job)
                for job in jobs
            ]
        })

        db.close()

        await websocket.receive_text()