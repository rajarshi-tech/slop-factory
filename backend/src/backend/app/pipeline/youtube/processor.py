import json
import subprocess
import os
import re


VIDEO_FILE = "video.mp4"
CLIPS_JSON = "output.json"
OUTPUT_DIR = "clips"


os.makedirs(OUTPUT_DIR, exist_ok=True)


def sanitize_filename(name):
    # Remove invalid Windows filename characters
    return re.sub(r'[<>:"/\\|?*]', '', name)


with open(CLIPS_JSON, "r", encoding="utf-8") as f:
    clips = json.load(f)


for i, clip in enumerate(clips, start=1):
    start = clip["start"]
    end = clip["end"]
    title = sanitize_filename(clip["title"])

    output = os.path.join(
        OUTPUT_DIR,
        f"{i:02d}_{title}.mp4"
    )

    duration = end - start

    command = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-i", VIDEO_FILE,
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