from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.pipeline.youtube.trendCalculator import (
    calculate_uncalculated_trends,
    calculate_trend_for_video,
)
from app.init_db import get_uncalculated_jobs


router = APIRouter()


class TrendCalculateRequest(BaseModel):
    source: Optional[str] = "search"
    video_ids: Optional[List[str]] = None


@router.post("")
@router.post("/calculate")
async def calculate_trends(request: Optional[TrendCalculateRequest] = None):
    """
    Calculate trend scores for unranked videos from job database.
    
    By default, calculates trend ranks for all newly searched videos whose trend
    has not been calculated yet, updates their metadata.json, and updates job.db.
    """
    try:
        source = request.source if request else "search"
        video_ids = request.video_ids if request else None

        if video_ids:
            calculated_videos = []
            for video_id in video_ids:
                score = calculate_trend_for_video(video_id)
                if score is not None:
                    calculated_videos.append({
                        "video_id": video_id,
                        "trend_score": score
                    })
        else:
            calculated_videos = calculate_uncalculated_trends(source=source)

        return {
            "status": "success",
            "calculated_count": len(calculated_videos),
            "jobs": calculated_videos,
            "message": f"Trend scores calculated for {len(calculated_videos)} video(s)"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate trend scores: {str(e)}"
        )


@router.get("")
@router.get("/uncalculated")
async def list_uncalculated_videos(source: Optional[str] = "search"):
    """
    Get list of videos in job database whose trend has not been calculated yet.
    """
    try:
        uncalculated = get_uncalculated_jobs(source=source)
        return {
            "uncalculated_count": len(uncalculated),
            "source": source,
            "jobs": uncalculated
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch uncalculated jobs: {str(e)}"
        )
