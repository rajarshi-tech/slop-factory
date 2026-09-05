from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.pipeline.youtube.pipeline import pipeline
from app.init_db import update_job, get_job

router = APIRouter()

class ProcessRequest(BaseModel):
    video_ids: List[str]

@router.post("")
def process(videos: ProcessRequest):
    video_ids = videos.video_ids
    response = {}
    for video_id in video_ids:
        try:
            update_job(video_id, job_status="generating_clips", progress=10)
            pipeline(video_id)
            update_job(video_id, processing_state="processed", job_status="completed", progress=100)
            response[video_id] = "processed"
        except Exception as e:
            update_job(video_id, job_status="failed", error_message=str(e))
            response[video_id] = f"failed: {str(e)}"
    return response
