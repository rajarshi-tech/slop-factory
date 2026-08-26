import re
import json
import ollama
from app.utils.storage import youtube_video_dir

def vtt_to_json(vtt_file):
    with open(vtt_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove WEBVTT header
    content = re.sub(
        r"^WEBVTT.*?\n",
        "",
        content,
        count=1
    )

    subtitles = []

    blocks = re.split(r"\n\n+", content.strip())

    for block in blocks:
        lines = block.splitlines()

        timestamp = None
        text_lines = []

        for line in lines:
            if "-->" in line:
                parts = line.split("-->")
                timestamp = (
                    parts[0].strip()
                    + " --> "
                    + parts[1].strip().split()[0]
                )

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

def timestamp_to_seconds(timestamp):
    # Remove VTT settings like align:start, position:0%
    timestamp = timestamp.split()[0]

    timestamp = timestamp.replace(",", ".")

    parts = timestamp.split(":")

    if len(parts) == 3:
        hours, minutes, seconds = parts
    elif len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        raise ValueError(f"Invalid timestamp: {timestamp}")

    return (
        int(hours) * 3600
        + int(minutes) * 60
        + float(seconds)
    )

def chunk_transcript(transcript, chunk_size=100):
    chunks = []

    for i in range(0, len(transcript), chunk_size):
        chunks.append(transcript[i:i + chunk_size])

    # Merge last chunk if it is too small
    if len(chunks) > 1 and len(chunks[-1]) < 50:
        chunks[-2].extend(chunks[-1])
        chunks.pop()

    return chunks


def generateTimestamps(id):
    video_dir = youtube_video_dir(id)

    vtt_path = video_dir / (id + ".en.vtt")
    transcript_json = vtt_to_json(vtt_path)

    chunks = chunk_transcript(transcript_json)

    all_timestamps = []

    for index, chunk in enumerate(chunks):
        print(f"Processing chunk {index + 1}/{len(chunks)}")

        prompt = f"""
        You are an AI video editor.

        Analyze this transcript segment and find the best standalone video clips.

        Rules:
        - Each clip should contain a complete idea or valuable moment.
        - Prefer interesting, surprising, educational, entertaining, or highly engaging moments.
        - Do not cut in the middle of a sentence.
        - Do not create clips from incomplete thoughts, introductions, greetings, filler, or contextless fragments.
        - If this transcript segment is too short, lacks enough context, or does not contain a meaningful standalone moment, return an empty JSON array [].
        - Only return clips that would make sense when viewed independently from the original video.
        - Do not force a clip selection just to return something.
        - Return ONLY valid JSON.
        - Do not include markdown, explanations, or additional text.

        Return format exactly:

        [
        {{
            "start": 123.45,
            "end": 150.75,
            "title": "Example title",
            "reason": "Example reason"
        }}
        ]

        The array elements must be objects. Never return a list of keys or strings.
        If there are no suitable clips, return exactly:
        []

        Transcript:

        {json.dumps(chunk, indent=2)}
        """

        clip_schema = {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {
                        "type": "number"
                    },
                    "end": {
                        "type": "number"
                    },
                    "title": {
                        "type": "string"
                    },
                    "reason": {
                        "type": "string"
                    }
                },
                "required": [
                    "start",
                    "end",
                    "title",
                    "reason"
                ]
            }
        }

        response = ollama.chat(
            model="qwen2.5:7b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            format=clip_schema
        )

        output = response["message"]["content"]

        try:
            parsed_output = json.loads(output)
            if (
                isinstance(parsed_output, list)
                and all(
                    isinstance(item, dict)
                    and "start" in item
                    and "end" in item
                    for item in parsed_output
                )
            ):
                all_timestamps.extend(parsed_output)
            else:
                print(f"Invalid response from chunk {index+1}")

        except json.JSONDecodeError:
            print(f"Failed parsing chunk {index + 1}")
            print(output)

    with open(
        str(video_dir / "clipTimestamps.json"),
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            all_timestamps,
            file,
            indent=4,
            ensure_ascii=False
        )