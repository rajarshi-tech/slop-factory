from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.pipeline.youtube.pipeline import pipeline
from app.init_db import update_job, get_job

router = APIRouter()


class SubtitleConfig(BaseModel):
    """
    Per-request subtitle rendering configuration.

    enabled:         Whether to burn subtitles into clips at all.
    style:           Which ASS generator to use.
                     "plain"            → generate_ass_plain()            (grouped lines, no highlighting, default)
                     "karaoke_sentence" → generate_ass_karaoke_sentence()  (sentence-level karaoke)
                     "word_level"       → generate_ass_word_level()        (one word at a time)
    font_name:       Font family name understood by libass/FFmpeg.
    font_size:       Font size in ASS units (roughly points at 1080p).
    highlight_color: ASS colour string, e.g. "&H00FFFF&" (yellow-cyan).
    """

    enabled: bool = True
    style: str = "plain"
    font_name: str = "Arial"
    font_size: int = 64
    highlight_color: str = "&H00FFFF&"


class ProcessRequest(BaseModel):
    video_ids: List[str]
    subtitle_config: Optional[SubtitleConfig] = None


@router.post("")
def process(videos: ProcessRequest):
    video_ids = videos.video_ids
    subtitle_config = videos.subtitle_config
    response = {}
    for video_id in video_ids:
        try:
            update_job(video_id, job_status="generating_clips", progress=10)
            pipeline(video_id, subtitle_config=subtitle_config)
            update_job(video_id, processing_state="processed", job_status="completed", progress=100)
            response[video_id] = "processed"
        except Exception as e:
            update_job(video_id, job_status="failed", error_message=str(e))
            response[video_id] = f"failed: {str(e)}"
    return response
