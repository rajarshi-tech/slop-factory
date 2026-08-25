import re
import json
import ollama
from app.utils.storage import youtube_video_dir

def timestamp_to_seconds(timestamp):
    """
    Convert VTT timestamp:
    00:01:23.500 -> 83.5 seconds
    """
    parts = timestamp.split(":")

    if len(parts) == 3:
        hours, minutes, seconds = parts
        return (
            int(hours) * 3600
            + int(minutes) * 60
            + float(seconds)
        )

    elif len(parts) == 2:
        minutes, seconds = parts
        return (
            int(minutes) * 60
            + float(seconds)
        )


def vtt_to_json(vtt_file):
    with open(vtt_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove WEBVTT header
    content = re.sub(
        r"^WEBVTT.*?\n\n",
        "",
        content,
        flags=re.DOTALL
    )

    subtitles = []

    blocks = re.split(r"\n\n+", content.strip())

    for block in blocks:
        lines = block.splitlines()

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

            # Remove VTT formatting
            text = re.sub(r"<[^>]+>", "", text)

            subtitles.append({
                "start": timestamp_to_seconds(start),
                "end": timestamp_to_seconds(end),
                "text": text
            })

    return subtitles


def generateTimestamps(id):
    video_dir = youtube_video_dir(id)

    with open(str(video_dir / "metadata.json"), "r", encoding="utf-8") as file:
        metadata = json.load(file)
    

    # Convert VTT
    transcript_json = vtt_to_json(str(metadata["title"] + ".en.vtt"))


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
