import re
import json
import ollama
from app.utils.storage import youtube_video_dir

def srt_to_json(srt_file):
    with open(srt_file, "r", encoding="utf-8") as f:
        content = f.read()

    subtitles = []

    # Split subtitle blocks
    blocks = re.split(r"\n\n+", content.strip())

    for block in blocks:
        lines = block.splitlines()

        if len(lines) < 2:
            continue

        timestamp = None
        text_lines = []

        for line in lines:
            if "-->" in line:
                timestamp = line
            elif timestamp:
                text_lines.append(line)

        if timestamp:
            start, end = [
                x.strip()
                for x in timestamp.split("-->")
            ]

            text = " ".join(text_lines)

            # Remove SRT formatting tags
            text = re.sub(r"<[^>]+>", "", text)

            subtitles.append({
                "start": timestamp_to_seconds(start),
                "end": timestamp_to_seconds(end),
                "text": text
            })

    return subtitles


def timestamp_to_seconds(timestamp):
    # Handles SRT format: HH:MM:SS,mmm
    timestamp = timestamp.replace(",", ".")

    hours, minutes, seconds = timestamp.split(":")
    
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + float(seconds)
    )

def generateTimestamps(id):
    video_dir = youtube_video_dir(id)

    srt_path = video_dir / (id + ".en.srt")

    transcript_json = srt_to_json(srt_path)


    # Send to Ollama
    prompt = f"""
    You are an AI video editor.

    Analyze this transcript and find the best standalone clips.

    Rules:
    - Each clip should have a complete idea.
    - Prefer interesting, surprising, educational, or entertaining moments.
    - Do not cut in the middle of a sentence.
    - Return ONLY valid JSON.

    Return format:

    [
    {{
        "start": number,
        "end": number,
        "title": "short clip title",
        "reason": "why this clip works"
    }}
    ]

    Transcript:

    {json.dumps(transcript_json, indent=2)}
    """


    response = ollama.chat(
        model="gemma4:12b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    output = response["message"]["content"]

    with open(str(video_dir / "clipTimestamps.json"), "w", encoding="utf-8") as file:
        json.dump(output, file, indent=4, ensure_ascii=False)
