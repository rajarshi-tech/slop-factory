import json
import subprocess
import os
import re
from app.utils.storage import youtube_video_dir

def sanitize_filename(name):
    # Remove invalid Windows filename characters
    return re.sub(r'[<>:"/\\|?*]', '', name)

def generate_clips(id):

    video_dir = youtube_video_dir(id)
    
    with open(str(video_dir / "clipTimestamps.json"), "r", encoding="utf-8") as f:
        clips = json.load(f)


    with open(str(video_dir / "metadata.json"), "r", encoding="utf-8") as f:
        metadata = json.load(f)

    video_file = video_dir / metadata["title"] + ".mp4"


    for i, clip in enumerate(clips, start=1):
        start = clip["start"]
        end = clip["end"]
        title = sanitize_filename(clip["title"])

        output_dir = video_dir / "clips"

        output = os.path.join(
            output_dir,
            f"{i:02d}_{title}.mp4"
        )

        duration = end - start

        command = [
            "ffmpeg",
            "-y",
            "-ss", str(start),
            "-i", video_file,
            "-t", str(duration),

            # Re-encode for accurate cuts
            "-c:v", "libx264",
            "-c:a", "aac",

            "-preset", "fast",

            output
        ]

        print(f"Creating: {output}")

        subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT
        )


    print("All clips created.")