from fastapi import APIRouter, WebSocket
from app.database import get_db

router = APIRouter()


@router.websocket("/jobs")
async def jobs_socket(websocket: WebSocket):

    await websocket.accept()

    while True:
        db = get_db()

        jobs = db.execute(
            "SELECT * FROM jobs"
        ).fetchall()

        await websocket.send_json({
            "jobs": [
                dict(job)
                for job in jobs
            ]
        })

        db.close()

        await websocket.receive_text()