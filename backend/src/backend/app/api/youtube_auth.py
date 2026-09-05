"""Google OAuth 2.0 connection flow for YouTube upload channels."""

from urllib.parse import urlencode

import json

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import FRONTEND_URL, YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, YOUTUBE_OAUTH_REDIRECT_URI
from app.init_db import (
    consume_youtube_oauth_state,
    create_youtube_oauth_state,
    get_youtube_oauth_client_config,
    save_youtube_channel,
    save_youtube_oauth_client_config,
)
from app.services.youtube import YOUTUBE_UPLOAD_SCOPE

router = APIRouter()


def _client_config() -> dict:
    database_config = get_youtube_oauth_client_config()
    client_id = (database_config or {}).get("client_id") or YOUTUBE_OAUTH_CLIENT_ID
    client_secret = (database_config or {}).get("client_secret") or YOUTUBE_OAUTH_CLIENT_SECRET
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Upload a Google OAuth Web client_secret.json before connecting a YouTube channel.",
        )
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [YOUTUBE_OAUTH_REDIRECT_URI],
        }
    }


def _oauth_client_credentials() -> tuple[str, str]:
    config = _client_config()["web"]
    return config["client_id"], config["client_secret"]


def _redirect_to_frontend(status: str, message: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/?{urlencode({'youtube': status, 'message': message})}")


@router.get("/youtube")
def start_youtube_oauth():
    flow = Flow.from_client_config(_client_config(), scopes=[YOUTUBE_UPLOAD_SCOPE])
    flow.redirect_uri = YOUTUBE_OAUTH_REDIRECT_URI
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    create_youtube_oauth_state(state)
    return RedirectResponse(authorization_url)


@router.get("/youtube/status")
def youtube_oauth_status():
    try:
        _client_config()
        return {"configured": True}
    except HTTPException:
        return {"configured": False}


@router.post("/youtube/client-secret")
async def upload_oauth_client_secret(file: UploadFile = File(...)):
    """Accept a Google *Web application* client_secret.json once, server-side."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Upload the Google client_secret.json file.")
    try:
        payload = json.loads((await file.read()).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="The uploaded file is not valid JSON.")

    web = payload.get("web") if isinstance(payload, dict) else None
    if not isinstance(web, dict) or not web.get("client_id") or not web.get("client_secret"):
        raise HTTPException(
            status_code=400,
            detail="Use a Google OAuth client_secret.json created as a Web application, not a Desktop application or API key.",
        )
    redirect_uris = web.get("redirect_uris")
    if not isinstance(redirect_uris, list) or YOUTUBE_OAUTH_REDIRECT_URI not in redirect_uris:
        raise HTTPException(
            status_code=400,
            detail=f"Add {YOUTUBE_OAUTH_REDIRECT_URI} as an Authorized redirect URI in Google Cloud, download a new JSON file, then upload it here.",
        )
    save_youtube_oauth_client_config(web["client_id"], web["client_secret"])
    return {"message": "Google OAuth client configured. You can now connect a YouTube channel."}


@router.get("/youtube/callback")
def youtube_oauth_callback(request: Request, state: str | None = None, error: str | None = None):
    if error:
        return _redirect_to_frontend("denied", "YouTube connection was cancelled or denied.")
    if not state or not consume_youtube_oauth_state(state):
        return _redirect_to_frontend("error", "The OAuth session expired. Start the connection again.")

    try:
        flow = Flow.from_client_config(_client_config(), scopes=[YOUTUBE_UPLOAD_SCOPE], state=state)
        flow.redirect_uri = YOUTUBE_OAUTH_REDIRECT_URI
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        if not credentials.refresh_token:
            return _redirect_to_frontend("error", "Google did not return a refresh token. Start the connection again.")
        youtube = build("youtube", "v3", credentials=credentials, cache_discovery=False)
        response = youtube.channels().list(part="id,snippet", mine=True).execute()
        if not response.get("items"):
            return _redirect_to_frontend("error", "The Google account does not have an accessible YouTube channel.")
        channel = response["items"][0]
        client_id, client_secret = _oauth_client_credentials()
        save_youtube_channel(
            channel_id=channel["id"],
            channel_name=channel.get("snippet", {}).get("title") or channel["id"],
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=credentials.refresh_token,
        )
        return _redirect_to_frontend("connected", "YouTube channel connected successfully.")
    except Exception:
        return _redirect_to_frontend("error", "Unable to connect the YouTube channel. Check OAuth client settings and try again.")
