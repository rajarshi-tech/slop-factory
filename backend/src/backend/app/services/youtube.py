"""Authenticated YouTube operations backed by persisted OAuth refresh tokens."""

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from app.init_db import get_youtube_channel

YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"


class YouTubeServiceError(RuntimeError):
    """A safe, user-facing error raised for channel authorization/upload failures."""


def get_channel_credentials(channel_id: str) -> Credentials:
    channel = get_youtube_channel(channel_id)
    if not channel:
        raise YouTubeServiceError("The selected YouTube channel is no longer connected.")
    if not channel.get("refresh_token"):
        raise YouTubeServiceError("This YouTube channel has no refresh token. Connect it again.")

    credentials = Credentials(
        token=None,
        refresh_token=channel["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=channel["client_id"],
        client_secret=channel["client_secret"],
        scopes=[YOUTUBE_UPLOAD_SCOPE],
    )
    try:
        credentials.refresh(Request())
    except RefreshError as exc:
        raise YouTubeServiceError("The YouTube authorization expired or was revoked. Connect the channel again.") from exc
    return credentials


def upload_scheduled_video(channel_id: str, file_path: str, title: str, publish_at: str) -> str:
    """Upload a private video and let YouTube publish it at ``publish_at``."""
    try:
        youtube = build("youtube", "v3", credentials=get_channel_credentials(channel_id), cache_discovery=False)
        response = youtube.videos().insert(
            part="snippet,status",
            body={
                "snippet": {"title": title, "description": ""},
                "status": {"privacyStatus": "private", "publishAt": publish_at, "selfDeclaredMadeForKids": False},
            },
            media_body=MediaFileUpload(file_path, mimetype="video/mp4", resumable=True),
        ).execute()
        if not response.get("id"):
            raise YouTubeServiceError("YouTube did not return an uploaded video ID.")
        return response["id"]
    except YouTubeServiceError:
        raise
    except HttpError as exc:
        if exc.resp.status == 403 and "quota" in exc.content.decode("utf-8", errors="ignore").lower():
            raise YouTubeServiceError("YouTube API quota has been exceeded. Try again after quota is available.") from exc
        raise YouTubeServiceError(f"YouTube rejected the upload (HTTP {exc.resp.status}).") from exc
