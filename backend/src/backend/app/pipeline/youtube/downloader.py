import yt_dlp
from app.utils.storage import youtube_video_dir 
import json

def download(url):

    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        info = ydl.extract_info(url, download=False)
        video_id = info["id"]

    output_dir = youtube_video_dir(video_id)

    options = {
        # Download best quality video + audio
        "format": "bestvideo+bestaudio/best",

        # Merge video and audio
        "merge_output_format": "mp4",

        # Download subtitles
        "writesubtitles": True,

        # Download auto-generated subtitles if no manual subtitles exist
        "writeautomaticsub": True,

        # Subtitle languages
        "subtitleslangs": ["en"],

        # Output filename
        "outtmpl": str(output_dir / f"{video_id}.%(ext)s"),

        # Keep metadata
        "addmetadata": True,

        # Avoid playlist downloads
        "noplaylist": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl: # type: ignore
        ydl.download([url])

    print(f"Files saved to: {output_dir}")
