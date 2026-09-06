"""Scheduled YouTube uploads for generated clips and connected OAuth channels."""

import json
from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.init_db import (
    archive_jobs,
    create_upload_jobs,
    delete_youtube_channel,
    get_job,
    get_upload_jobs,
    get_youtube_channel,
    get_youtube_channels,
    update_upload_job,
)
from app.services.youtube import upload_scheduled_video
from app.utils.storage import youtube_video_dir

router = APIRouter()


class ClipScheduleOverride(BaseModel):
    clip_id: str
    title: Optional[str] = None
    description: Optional[str] = None


class UploadScheduleRequest(BaseModel):
    video_ids: List[str] = Field(min_length=1)
    channel_id: str = Field(min_length=1)
    videos_per_day: int = Field(ge=1, le=96)
    start_date: str
    start_time: str
    timezone: str
    clip_overrides: Optional[List[ClipScheduleOverride]] = None


def _configured_channels() -> List[dict]:
    return get_youtube_channels()


def _public_channel(channel: dict) -> dict:
    return {"id": channel["channel_id"], "name": channel["channel_name"]}


def _get_channel(channel_id: str) -> dict:
    channel = get_youtube_channel(channel_id)
    if not channel:
        raise HTTPException(status_code=400, detail="Select a configured YouTube channel before saving the schedule.")
    return channel


def _schedule_start(request: UploadScheduleRequest) -> tuple[datetime, ZoneInfo]:
    try:
        zone = ZoneInfo(request.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Timezone must be a valid IANA timezone, such as Asia/Kolkata.")
    try:
        local_start = datetime.combine(
            datetime.strptime(request.start_date, "%Y-%m-%d").date(),
            time.fromisoformat(request.start_time),
            tzinfo=zone,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Start date and time must use YYYY-MM-DD and HH:MM formats.")
    if local_start.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="The first publish time must be in the future.")
    return local_start, zone


def _collect_clips(video_ids: List[str], overrides: Optional[dict] = None) -> List[dict]:
    overrides = overrides or {}
    clips = []
    for video_id in video_ids:
        job = get_job(video_id)
        if not job or job.get("processing_state") != "processed" or job.get("video_state") == "archived":
            raise HTTPException(status_code=400, detail=f"{video_id} is not an available processed video.")

        video_dir = youtube_video_dir(video_id)
        timestamps = []
        timestamps_file = video_dir / "clipTimestamps.json"
        if timestamps_file.exists():
            try:
                timestamps = json.loads(timestamps_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                timestamps = []

        for index, path in enumerate(sorted((video_dir / "clips").glob("*.mp4")) if (video_dir / "clips").exists() else []):
            metadata = timestamps[index] if index < len(timestamps) and isinstance(timestamps[index], dict) else {}
            clip_id = f"{video_id}_{index + 1}"
            override = overrides.get(clip_id) or {}

            title = override.get("title")
            if not title or not str(title).strip():
                title = str(metadata.get("title") or path.stem)[:100]
            else:
                title = str(title).strip()[:100]

            description = override.get("description")
            if description is None:
                description = str(metadata.get("description") or "")
            else:
                description = str(description).strip()

            clips.append({
                "source_video_id": video_id,
                "clip_id": clip_id,
                "clip_filename": path.name,
                "clip_path": str(path),
                "title": title,
                "description": description,
            })
    if not clips:
        raise HTTPException(status_code=400, detail="The selected processed videos do not contain generated clip files.")
    return clips


def _build_schedule(request: UploadScheduleRequest) -> List[dict]:
    channel = _get_channel(request.channel_id)
    start, zone = _schedule_start(request)
    overrides_map = {}
    if request.clip_overrides:
        for item in request.clip_overrides:
            overrides_map[item.clip_id] = {
                "title": item.title,
                "description": item.description,
            }
    clips = _collect_clips(request.video_ids, overrides_map)
    slot_interval = timedelta(days=1) / request.videos_per_day
    schedule = []
    for index, clip in enumerate(clips):
        # Slot 1 begins at the configured local start. Consecutive slots are
        # evenly distributed over 24 hours; every nth clip starts the next day.
        local_publish_at = start + (slot_interval * index)
        schedule.append({
            **clip,
            "channel_id": channel["channel_id"],
            "channel_name": channel["channel_name"],
            "scheduled_publish_at": local_publish_at.astimezone(timezone.utc).isoformat(),
            "display_publish_at": local_publish_at.isoformat(),
            "timezone": zone.key,
            "slot_number": (index % request.videos_per_day) + 1,
            "day_number": (index // request.videos_per_day) + 1,
        })
    return schedule


def _check_and_archive_source_video(source_video_id: str) -> bool:
    """If all generated clips of a source video have been successfully uploaded, archive it."""
    video_dir = youtube_video_dir(source_video_id)
    clips_dir = video_dir / "clips"
    if not clips_dir.exists():
        return False
    all_clips = sorted(list(clips_dir.glob("*.mp4")))
    if not all_clips:
        return False

    upload_jobs = get_upload_jobs([source_video_id])
    uploaded_filenames = {
        j["clip_filename"] for j in upload_jobs if j.get("upload_status") == "uploaded"
    }

    if all(clip.name in uploaded_filenames for clip in all_clips):
        archive_jobs([source_video_id])
        return True
    return False


def _upload_job(upload_job: dict) -> None:
    try:
        update_upload_job(upload_job["id"], upload_status="uploading", error_message=None)
        youtube_video_id = upload_scheduled_video(
            upload_job["channel_id"],
            upload_job["clip_path"],
            upload_job["title"],
            upload_job["scheduled_publish_at"],
            description=upload_job.get("description", ""),
        )
        update_upload_job(upload_job["id"], upload_status="uploaded", youtube_video_id=youtube_video_id)
        _check_and_archive_source_video(upload_job["source_video_id"])
    except Exception as exc:
        update_upload_job(upload_job["id"], upload_status="failed", error_message=str(exc))


@router.get("")
def list_upload_jobs(video_ids: Optional[str] = None):
    """List upload jobs, optionally filtered by comma-separated source video IDs."""
    ids = [v.strip() for v in video_ids.split(",") if v.strip()] if video_ids else None
    jobs = get_upload_jobs(ids)
    return {"upload_jobs": jobs}


@router.get("/channels")
def list_upload_channels():
    """List channel identities only; OAuth secrets remain private."""
    return {"channels": [_public_channel(item) for item in _configured_channels()]}


@router.delete("/channels/{channel_id}")
def remove_upload_channel(channel_id: str):
    if not delete_youtube_channel(channel_id):
        raise HTTPException(status_code=404, detail="YouTube channel was not found.")
    return {"message": "YouTube channel removed."}


@router.post("/preview")
def preview_upload_schedule(request: UploadScheduleRequest):
    schedule = _build_schedule(request)
    return {"clip_count": len(schedule), "schedule": schedule}


@router.post("")
def create_scheduled_uploads(request: UploadScheduleRequest, background_tasks: BackgroundTasks):
    schedule = _build_schedule(request)
    created = create_upload_jobs(schedule)
    for upload_job in created:
        background_tasks.add_task(_upload_job, upload_job)
    return {
        "status": "queued",
        "upload_count": len(created),
        "upload_jobs": created,
        "message": f"Created and started {len(created)} scheduled YouTube upload job(s).",
    }

