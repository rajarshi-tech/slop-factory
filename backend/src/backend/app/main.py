from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import config, jobs, process, search, trend, uploads, youtube_auth
from app.init_db import create_tables
from app.utils.storage import STORAGE


app = FastAPI(
    title="Slop Factory API",
    version="0.1.0",
)


@app.on_event("startup")
def initialize_database():
    """Apply additive SQLite schema changes before accepting requests."""
    create_tables()


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
# Static File Mount for Storage (Videos, Clips, Artifacts)
# ---------------------------------------------------------

app.mount("/storage", StaticFiles(directory=str(STORAGE)), name="storage")


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

app.include_router(
    config.router,
    prefix="/api/config",
    tags=["Config"],
)

app.include_router(
    search.router,
    prefix="/api/search",
    tags=["Search"],
)

app.include_router(
    trend.router,
    prefix="/api/trend",
    tags=["Trend"],
)

app.include_router(
    trend.router,
    prefix="/api/trends",
    tags=["Trend"],
)

app.include_router(
    jobs.router,
    prefix="/api/jobs",
    tags=["Jobs"],
)

app.include_router(
    process.router,
    prefix="/api/process",
    tags=["Process"],
)

app.include_router(
    uploads.router,
    prefix="/api/uploads",
    tags=["Uploads"],
)

app.include_router(
    youtube_auth.router,
    prefix="/auth",
    tags=["YouTube OAuth"],
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
