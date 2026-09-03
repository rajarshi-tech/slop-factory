from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import config, jobs


app = FastAPI(
    title="Slop Factory API",
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

app.include_router(
    config.router,
    prefix="/api/config",
    tags=["Config"],
)


app.include_router(
    jobs.router,
    prefix="/api/jobs",
    tags=["Jobs"],
)


app.include_router(
    jobs.router,
    prefix="/ws",
    tags=["WebSocket"],
)

# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "ok"
    }