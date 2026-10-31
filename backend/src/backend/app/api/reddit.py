import json
import logging
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.pipeline.reddit import database
from app.pipeline.reddit.pipeline import BACKGROUND_VIDEO, process_item
from app.utils.storage import reddit_assets_dir, reddit_item_dir


router = APIRouter()
logger = logging.getLogger(__name__)
_ITEM_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
_MAX_BACKGROUND_SIZE = 1024 * 1024 * 1024


class RedditIngestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    title: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=2048)
    subreddit: Optional[str] = Field(default=None, max_length=100)


class ItemIdsRequest(BaseModel):
    item_ids: list[str] = Field(min_length=1)


def _validate_item_ids(item_ids: list[str]) -> list[str]:
    unique_ids = list(dict.fromkeys(item_ids))
    if any(not _ITEM_ID_PATTERN.fullmatch(item_id) for item_id in unique_ids):
        raise HTTPException(status_code=400, detail="One or more Reddit item IDs are invalid.")
    return unique_ids


def _metadata_path(item_id: str) -> Path:
    return reddit_item_dir(item_id) / "metadata.json"


@router.post("")
@router.post("/ingest")
def ingest_reddit_text(request: RedditIngestRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text content cannot be blank.")

    title = (request.title or "").strip()
    if not title:
        title = next((line.strip() for line in text.splitlines() if line.strip()), "")[:200]
    if not title:
        raise HTTPException(status_code=422, detail="A title or non-empty first line is required.")

    item_id = uuid.uuid4().hex
    item_dir = reddit_item_dir(item_id)
    now = datetime.now().isoformat()
    metadata = {
        "id": item_id,
        "source": "reddit",
        "title": title,
        "url": request.source_url,
        "subreddit": request.subreddit,
        "statistics": {"views": 0, "likes": 0, "comments": 0},
        "details": {"text_length": len(text)},
        "pipeline": {
            "audio_generated": False,
            "subtitles_generated": False,
            "video_generated": False,
        },
        "processing_state": "pending",
        "created_at": now,
        "updated_at": now,
    }

    try:
        script_tmp = item_dir / "script.txt.tmp"
        script_tmp.write_text(text, encoding="utf-8")
        script_tmp.replace(item_dir / "script.txt")
        metadata_tmp = item_dir / "metadata.json.tmp"
        metadata_tmp.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
        metadata_tmp.replace(item_dir / "metadata.json")
        job = database.insert_job(
            item_id=item_id,
            title=title,
            text_content=text,
            source_url=request.source_url,
            subreddit=request.subreddit,
        )
        job.pop("text_content", None)
    except Exception as exc:
        shutil.rmtree(item_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to queue Reddit text: {exc}") from exc

    return {"job": job, "created": True}


@router.get("")
def list_reddit_jobs():
    jobs = database.get_all_jobs()
    return {"jobs": jobs, "count": len(jobs)}


@router.websocket("/ws")
async def reddit_jobs_socket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"jobs": database.get_all_jobs()})
            await websocket.receive_text()
    except WebSocketDisconnect:
        return


@router.get("/background-video")
def get_background_video_status():
    return {
        "configured": BACKGROUND_VIDEO.is_file(),
        "filename": BACKGROUND_VIDEO.name if BACKGROUND_VIDEO.is_file() else None,
    }


@router.post("/background-video")
async def upload_background_video(file: UploadFile = File(...)):
    if Path(file.filename or "").suffix.lower() != ".mp4":
        raise HTTPException(status_code=400, detail="The background video must be an MP4 file.")

    assets_dir = reddit_assets_dir()
    temporary_path = assets_dir / "gameplay.mp4.tmp"
    size = 0
    try:
        with temporary_path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > _MAX_BACKGROUND_SIZE:
                    raise HTTPException(status_code=413, detail="Background video exceeds the 1 GB limit.")
                target.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="The background video is empty.")
        temporary_path.replace(BACKGROUND_VIDEO)
    except HTTPException:
        temporary_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to store background video: {exc}") from exc
    finally:
        await file.close()

    return {"configured": True, "filename": BACKGROUND_VIDEO.name, "size_bytes": size}


@router.post("/process")
def process_reddit_items(request: ItemIdsRequest):
    item_ids = _validate_item_ids(request.item_ids)
    results = {}
    for item_id in item_ids:
        job = database.get_job(item_id)
        if job is None:
            results[item_id] = {"status": "failed", "error": "Reddit item not found."}
            continue
        if job["video_state"] == "archived":
            results[item_id] = {"status": "failed", "error": "Archived items cannot be processed."}
            continue
        if job["job_status"] in {"generating_audio", "transcribing", "generating_video"}:
            results[item_id] = {"status": "failed", "error": "This item is already being processed."}
            continue
        if job["job_status"] == "completed":
            results[item_id] = {"status": "already_processed"}
            continue

        try:
            results[item_id] = process_item(item_id)
        except Exception as exc:
            database.update_job(
                item_id,
                job_status="failed",
                processing_state="failed",
                error_message=str(exc),
            )
            metadata_path = _metadata_path(item_id)
            if metadata_path.is_file():
                try:
                    with metadata_path.open("r", encoding="utf-8") as file:
                        metadata = json.load(file)
                    metadata["processing_state"] = "failed"
                    metadata["error_message"] = str(exc)
                    metadata["updated_at"] = datetime.now().isoformat()
                    temporary_path = metadata_path.with_suffix(".json.tmp")
                    temporary_path.write_text(
                        json.dumps(metadata, indent=2, ensure_ascii=False),
                        encoding="utf-8",
                    )
                    temporary_path.replace(metadata_path)
                except (OSError, json.JSONDecodeError):
                    logger.exception("Could not persist failure metadata for Reddit item %s", item_id)
            results[item_id] = {"status": "failed", "error": str(exc)}
    return {"results": results}


@router.post("/archive")
@router.put("/archive")
def archive_reddit_items(request: ItemIdsRequest):
    item_ids = _validate_item_ids(request.item_ids)
    count = database.archive_jobs(item_ids)
    return {"status": "success", "archived_count": count, "item_ids": item_ids}


@router.post("/unarchive")
@router.put("/unarchive")
def unarchive_reddit_items(request: ItemIdsRequest):
    item_ids = _validate_item_ids(request.item_ids)
    count = database.unarchive_jobs(item_ids)
    return {"status": "success", "unarchived_count": count, "item_ids": item_ids}


@router.delete("")
def delete_reddit_items(request: ItemIdsRequest):
    item_ids = _validate_item_ids(request.item_ids)
    for item_id in item_ids:
        item_dir = reddit_item_dir(item_id)
        if item_dir.is_dir():
            shutil.rmtree(item_dir)
    deleted_count = database.delete_jobs(item_ids)
    return {"status": "success", "deleted_count": deleted_count, "item_ids": item_ids}


@router.get("/{item_id}")
def get_reddit_item(item_id: str):
    item_id = _validate_item_ids([item_id])[0]
    job = database.get_job(item_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Reddit item {item_id} not found.")

    metadata_path = _metadata_path(item_id)
    metadata = {}
    if metadata_path.is_file():
        with metadata_path.open("r", encoding="utf-8") as file:
            metadata = json.load(file)
    return {"job": job, "metadata": metadata}
