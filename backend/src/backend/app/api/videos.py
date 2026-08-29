from fastapi import APIRouter


router = APIRouter()


@router.get("")
def get_videos():
    return {
        "videos": []
    }


@router.get("/{video_id}")
def get_video(video_id: str):
    return {
        "video_id": video_id,
        "status": "unknown",
    }


@router.post("/{video_id}/download")
def download_video(video_id: str):
    return {
        "job_id": "test-job",
        "video_id": video_id,
        "operation": "download",
        "status": "queued",
    }


@router.post("/{video_id}/transcript")
def generate_transcript(video_id: str):
    return {
        "job_id": "test-job",
        "video_id": video_id,
        "operation": "transcript",
        "status": "queued",
    }


@router.post("/{video_id}/clips")
def generate_clips(video_id: str):
    return {
        "job_id": "test-job",
        "video_id": video_id,
        "operation": "clips",
        "status": "queued",
    }


@router.get("/{video_id}/clips")
def get_clips(video_id: str):
    return {
        "video_id": video_id,
        "clips": [],
    }