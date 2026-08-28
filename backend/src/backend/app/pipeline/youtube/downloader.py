import json
import yt_dlp

from app.utils.storage import youtube_video_dir


def download(url):

    # First, extract the video ID.
    # Cookies are required here because YouTube may block unauthenticated requests.
    extract_options = {
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(extract_options) as ydl: # type: ignore
        info = ydl.extract_info(url, download=False)
        video_id = info["id"]

    output_dir = youtube_video_dir(video_id)

    with open(output_dir / "metadata.json", "r", encoding="utf-8") as f:
        metadata = json.load(f)

    if metadata["pipeline"]["downloaded"]:
        print("video already downloaded")
        return

    options = {

        # Best available video + audio
        "format": "bestvideo+bestaudio/best",

        # Merge video and audio into MP4
        "merge_output_format": "mp4",

        # Download subtitles
        "writesubtitles": True,
        "writeautomaticsub": True,

        # Subtitle languages
        "subtitleslangs": ["en"],

        # Output filename
        "outtmpl": str(output_dir / f"{video_id}.%(ext)s"),

        # Keep metadata
        "addmetadata": True,

        # Don't download playlists
        "noplaylist": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl: # type: ignore
        ydl.download([url])

    # Mark download as complete
    metadata["pipeline"]["downloaded"] = True

    # Save the updated metadata
    with open(output_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)

    print(f"Files saved to: {output_dir}")