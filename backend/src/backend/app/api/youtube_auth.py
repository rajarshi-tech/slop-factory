"""Google OAuth 2.0 connection flow for YouTube upload channels."""

from urllib.parse import urlencode

import json
import os

from dotenv import set_key

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel

from app.core.config import (
    DEFAULT_FRONTEND_URL,
    ROOT_DIR,
    get_frontend_url,
    get_youtube_oauth_client_id,
    get_youtube_oauth_client_secret,
    get_youtube_oauth_redirect_uri,
)
from app.init_db import (
    consume_youtube_oauth_state,
    create_youtube_oauth_state,
    get_youtube_oauth_client_config,
    save_youtube_channel,
    save_youtube_oauth_client_config,
)
from app.services.youtube import YOUTUBE_UPLOAD_SCOPE

router = APIRouter()


class YouTubeOAuthClientConfig(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: str


def _redirect_uri() -> str:
    database_config = get_youtube_oauth_client_config()
    return (database_config or {}).get("redirect_uri") or get_youtube_oauth_redirect_uri()


def _client_config() -> dict:
    database_config = get_youtube_oauth_client_config()
    client_id = (database_config or {}).get("client_id") or get_youtube_oauth_client_id()
    client_secret = (database_config or {}).get("client_secret") or get_youtube_oauth_client_secret()
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Upload a Google OAuth Web client_secret.json before connecting a YouTube channel.",
        )
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": (database_config or {}).get("auth_uri") or "https://accounts.google.com/o/oauth2/v2/auth",
            "token_uri": (database_config or {}).get("token_uri") or "https://oauth2.googleapis.com/token",
            "redirect_uris": [_redirect_uri()],
        }
    }


def _oauth_client_credentials() -> tuple[str, str]:
    config = _client_config()["web"]
    return config["client_id"], config["client_secret"]


def _redirect_to_frontend(status: str, message: str) -> RedirectResponse:
    return RedirectResponse(f"{get_frontend_url()}/?{urlencode({'youtube': status, 'message': message})}")


def _save_oauth_environment(client_id: str, client_secret: str, redirect_uri: str) -> None:
    """Persist OAuth settings to .env and make them available to this process."""
    env_path = ROOT_DIR / ".env"
    env_path.touch(exist_ok=True)
    values = {
        "YOUTUBE_OAUTH_CLIENT_ID": client_id,
        "YOUTUBE_OAUTH_CLIENT_SECRET": client_secret,
        "YOUTUBE_OAUTH_REDIRECT_URI": redirect_uri,
        # A Google client secret does not contain the frontend URL. Persist the
        # configured value, or the local frontend default, for a complete setup.
        "FRONTEND_URL": get_frontend_url() or DEFAULT_FRONTEND_URL,
    }
    for key, value in values.items():
        set_key(env_path, key, value)
        os.environ[key] = value


@router.get("/youtube")
def start_youtube_oauth():
    flow = Flow.from_client_config(
        _client_config(), scopes=[YOUTUBE_UPLOAD_SCOPE], autogenerate_code_verifier=False
    )
    # This is a confidential server-side web client. Keep PKCE disabled because
    # the verifier is not persisted alongside the callback state.
    flow.autogenerate_code_verifier = False
    flow.code_verifier = None
    flow.redirect_uri = _redirect_uri()
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


@router.get("/youtube/client-config")
def get_youtube_client_config():
    config = get_youtube_oauth_client_config()
    return {
        "configured": bool(config),
        "client_id": (config or {}).get("client_id", ""),
        "redirect_uri": (config or {}).get("redirect_uri") or get_youtube_oauth_redirect_uri(),
    }


@router.put("/youtube/client-config")
def save_youtube_client_config(config: YouTubeOAuthClientConfig):
    existing_config = get_youtube_oauth_client_config()
    client_secret = config.client_secret.strip() or (existing_config or {}).get("client_secret", "")
    if not config.client_id.strip() or not client_secret or not config.redirect_uri.strip():
        raise HTTPException(status_code=400, detail="Client ID, client secret, and redirect URI are required.")
    save_youtube_oauth_client_config(
        config.client_id.strip(), client_secret, config.redirect_uri.strip()
    )
    _save_oauth_environment(config.client_id.strip(), client_secret, config.redirect_uri.strip())
    return {"message": "YouTube OAuth client configuration saved."}


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
    if not isinstance(redirect_uris, list) or not redirect_uris or not all(isinstance(uri, str) and uri.strip() for uri in redirect_uris):
        raise HTTPException(
            status_code=400,
            detail="The uploaded Web application client_secret.json must contain at least one Authorized redirect URI.",
        )
    redirect_uri = redirect_uris[0].strip()
    client_id = web["client_id"].strip()
    client_secret = web["client_secret"].strip()
    save_youtube_oauth_client_config(client_id, client_secret, redirect_uri)
    _save_oauth_environment(client_id, client_secret, redirect_uri)
    return {"message": "Google OAuth client configured. You can now connect a YouTube channel."}


@router.get("/youtube/callback")
def youtube_oauth_callback(request: Request, state: str | None = None, error: str | None = None):
    if error:
        return _redirect_to_frontend("denied", "YouTube connection was cancelled or denied.")
    if not state or not consume_youtube_oauth_state(state):
        return _redirect_to_frontend("error", "The OAuth session expired. Start the connection again.")

    try:
        flow = Flow.from_client_config(
            _client_config(), scopes=[YOUTUBE_UPLOAD_SCOPE], state=state, autogenerate_code_verifier=False
        )
        flow.autogenerate_code_verifier = False
        flow.code_verifier = None
        flow.redirect_uri = _redirect_uri()
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
