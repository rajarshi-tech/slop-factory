---
name: media-processing
description: >-
  Workflows, FFmpeg recipes, WhisperX speech alignment, and ASS subtitle generation
  (plain, karaoke, word-level) for video processing and clip creation in Slop Factory.
---

# Media Processing & Subtitle Generation Skill

Use this skill when developing, debugging, or enhancing video download, audio extraction, WhisperX transcription, ASS subtitle styling, and FFmpeg video clipping in Slop Factory.

---

## 1. Pipeline Media Architecture

```
[Full Video .mp4]
      │
      ▼ (FFmpeg)
[16kHz Mono WAV Audio] ───► [WhisperX large-v3 & Alignment]
                                    │
                                    ▼
[Transcript & Candidate Clustered JSON] ───► [ASS Subtitle Script]
                                                      │
                                                      ▼ (FFmpeg libass)
                                         [Clipped .mp4 with Burned Subs]
```

---

## 2. Audio Extraction for WhisperX

WhisperX requires 16kHz single-channel mono PCM audio for accurate phonetic alignment:

```python
command = [
    "ffmpeg",
    "-y",
    "-ss", str(start_seconds),
    "-i", str(video_file),
    "-t", str(duration_seconds),
    "-vn",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    str(output_audio_path)
]
```

---

## 3. WhisperX Model Loading & Hardware Fallback

WhisperX models must be loaded lazily (only when media generation starts). Always guard device selection:

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

# 1. Base Transcription Model
whisper_model = whisperx.load_model(
    "large-v3",
    device=device,
    compute_type=compute_type,
    language="en"
)

# 2. English Phonetic Alignment Model
align_model, align_metadata = whisperx.load_align_model(
    language_code="en",
    device=device
)
```

---

## 4. Advanced ASS Subtitle Generation

Subtitles are generated as Advanced SubStation Alpha (`.ass`) files and burned into the video using FFmpeg's `libass` filter.

### Timestamp Conversion
ASS timestamps strictly use the format `H:MM:SS.cc` (hours, 2-digit minutes, 2-digit seconds, and 2-digit centiseconds):
```python
def seconds_to_ass_time(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    whole_seconds = int(seconds % 60)
    centiseconds = int(round((seconds - int(seconds)) * 100))
    if centiseconds >= 100:
        whole_seconds += 1
        centiseconds -= 100
    return f"{hours}:{minutes:02d}:{whole_seconds:02d}.{centiseconds:02d}"
```

### Color Coding
ASS colors are expressed in hexadecimal `&HAABBGGRR&` (or `&HBBGGRR&` for 100% opaque):
- Yellow: `&H00FFFF&` (Blue: 00, Green: FF, Red: FF)
- Cyan: `&HFFFF00&`
- White: `&HFFFFFF&`
- Black: `&H000000&`

### Supported Subtitle Modes
1. **`plain`**:
   - Groups words into clean, readable sentence blocks.
   - Text is displayed statically for the segment duration with high-contrast outlines.
2. **`karaoke_sentence`**:
   - Displays the full sentence context.
   - Uses ASS karaoke timing tags `{\k<centiseconds>}` to dynamically highlight each word as it is spoken.
3. **`word_level`**:
   - Reveals words rapidly in tight rhythmic clusters (1 to 3 words) matching short-form social media trends (TikTok/Shorts style).

---

## 5. FFmpeg Video Clipping & Subtitle Burning

When burning subtitles on Windows, file paths passed to the `ass` filter must format path separators carefully to prevent escaping issues:

```python
# Convert Windows backslashes to forward slashes for the libass filter
escaped_ass_path = str(ass_file).replace("\\", "/").replace(":", "\\:")

command = [
    "ffmpeg",
    "-y",
    "-ss", str(start_seconds),
    "-i", str(input_video_path),
    "-t", str(duration_seconds),
    "-vf", f"ass='{escaped_ass_path}'",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "192k",
    str(output_clip_path)
]
```

---

## 6. Safe Resumption & Verification

Before re-running heavy transcription or rendering tasks:
1. Verify if `{video_id}.mp4` exists and `metadata["pipeline"]["downloaded"] == True`.
2. Verify if `clipTimestamps.json` exists and `metadata["pipeline"]["transcript-analysed"] == True`.
3. Verify if `clips/` directory contains `.mp4` files and `metadata["pipeline"]["clips-processed"] == True`.
4. Never re-encode or re-transcribe if completed artifacts already exist on disk unless forced by the user.
