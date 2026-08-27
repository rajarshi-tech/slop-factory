import json
import subprocess
import os
import re
from app.utils.storage import youtube_video_dir

def sanitize_filename(name):
    # Remove invalid Windows filename characters
    return re.sub(r'[<>:"/\\|?*]', '', name)

def generateClips(id):

    video_dir = youtube_video_dir(id)

    with open(str(video_dir / "clipTimestamps.json"), "r", encoding="utf-8") as f:
        clips = json.load(f)

    video_file = video_dir / (id + ".mp4")


    for i, clip in enumerate(clips, start=1):
        start = float(clip["start"])
        end = float(clip["end"])
        title = sanitize_filename(clip["title"])

        output_dir = video_dir / "clips"
        output_dir.mkdir(parents=True, exist_ok=True)

        output = os.path.join(
            output_dir,
            f"{i:02d}_{title}.mp4"
        )

        duration = end - start

        command = [
            "ffmpeg",
            "-y",
            "-i", video_file,
            "-ss", str(start),
            "-t", str(duration),

            "-filter_complex",
            (
                # Background: enlarged original, cropped to fill 9:16, then blurred
                "[0:v]"
                "scale=1080:1920:force_original_aspect_ratio=increase,"
                "crop=1080:1920,"
                "boxblur=20:10"
                "[bg];"

                # Foreground: center crop to 4:5, then fill entire width
                "[0:v]"
                "crop=ih*4/5:ih:(iw-ih*4/5)/2:0,"
                "scale=1080:1350"
                "[fg];"

                # Center foreground vertically
                "[bg][fg]"
                "overlay=0:(H-h)/2"
                "[v]"
            ),

            "-map", "[v]",
            "-map", "0:a?",

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