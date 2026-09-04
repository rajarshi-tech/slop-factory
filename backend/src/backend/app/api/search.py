import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.pipeline.youtube.scraper import scrape
from app.pipeline.youtube.trendCalculator import generateList
from app.init_db import insert_job
from app.utils.storage import youtube_config_dir


router = APIRouter()


class SearchRequest(BaseModel):
    q: str
    overrideParams: Optional[dict] = None


@router.post("")
async def search_videos(request: SearchRequest):
    """
    Execute YouTube search, calculate trend scores, and create jobs.

    Args:
        request: SearchRequest with query and optional parameter overrides

    Returns:
        dict with created jobs and count
    """
    try:
        # Load current config
        config_dir = youtube_config_dir()
        config_path = config_dir / "config.json"

        with open(str(config_path), "r", encoding="utf-8") as f:
            config = json.load(f)

        # Update query in config
        config["params"]["q"] = request.q

        # Apply any parameter overrides
        if request.overrideParams:
            config["params"].update(request.overrideParams)

        # Save updated config
        with open(str(config_path), "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)

        # Run scraper with updated params
        search_results = scrape(config["params"])

        if not search_results:
            return {
                "jobs": [],
                "count": 0,
                "message": "No videos found for query"
            }

        # Calculate trend scores
        videos_with_trends = generateList(search_results)

        # Insert jobs into database
        created_jobs = []
        errors = []

        for video in videos_with_trends:
            try:
                job = insert_job(
                    video_id=video["video_id"],
                    title=video["title"],
                    channel=video["channel"],
                    source="search",
                    trend_score=video["trend_score"]
                )
                created_jobs.append(job)
            except Exception as e:
                # Handle duplicate video_id or other errors
                error_msg = str(e)
                if "UNIQUE constraint failed" in error_msg:
                    errors.append(f"Video {video['video_id']} already exists")
                else:
                    errors.append(f"Failed to create job for {video['video_id']}: {error_msg}")

        response = {
            "jobs": created_jobs,
            "count": len(created_jobs)
        }

        if errors:
            response["errors"] = errors

        return response

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Config file not found. Please initialize configuration first."
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Invalid JSON in config file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )
