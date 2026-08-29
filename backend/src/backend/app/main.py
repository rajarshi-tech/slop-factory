from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import config, search, videos, jobs, llm


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
    llm.router,
    prefix="/api/llm",
    tags=["llm"],
)

app.include_router(
    search.router,
    prefix="/api/search",
    tags=["Search"],
)

app.include_router(
    videos.router,
    prefix="/api/videos",
    tags=["Videos"],
)

app.include_router(
    jobs.router,
    prefix="/api/jobs",
    tags=["Jobs"],
)


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "ok"
    }