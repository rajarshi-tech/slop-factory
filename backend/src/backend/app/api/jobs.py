from fastapi import APIRouter


router = APIRouter()


@router.get("")
def get_jobs():
    return {
        "jobs": []
    }


@router.get("/{job_id}")
def get_job(job_id: str):
    return {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "stage": None,
    }


@router.get("/{job_id}/logs")
def get_job_logs(job_id: str):
    return {
        "job_id": job_id,
        "logs": [],
    }