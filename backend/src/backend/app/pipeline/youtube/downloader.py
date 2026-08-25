import yt_dlp
from app.utils.storage import youtube_raw_dir 
from app.utils.storage import youtube_links_dir
import json

def download():
    links_dir = youtube_links_dir()

    with open(str(links_dir / "ranked-videos.json"), "r", encoding="utf-8") as file:
        ranked_links = json.load(file)

    for ranked_link in ranked_links:
        url = ranked_link["link"]

        choice = input("download " + url + " [y/n]")
        if choice == 'n':
            continue
        elif choice == 'y':
            print("downloading video...")     

        with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info["id"]

        output_dir = youtube_raw_dir(video_id)

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

            # Convert subtitles to .srt
            "convertsubs": "srt",

            # Output filename
            "outtmpl": str(output_dir / "%(title)s.%(ext)s"),

            # Keep metadata
            "addmetadata": True,

            # Avoid playlist downloads
            "noplaylist": True,
        }

        with yt_dlp.YoutubeDL(options) as ydl: # pyright: ignore[reportArgumentType]
            ydl.download([url])

        print(f"Files saved to: {output_dir}")

    print("all downloads complete...")