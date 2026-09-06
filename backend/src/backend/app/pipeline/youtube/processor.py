import json
import subprocess
import re
from pathlib import Path

import torch
import whisperx

from app.utils.storage import youtube_video_dir


def sanitize_filename(name):
    # Remove invalid Windows filename characters
    return re.sub(r'[<>:"/\\|?*]', '', name)


def run_command(command):
    result = subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:
        print(result.stderr)
        raise RuntimeError("FFmpeg command failed")


def extract_audio(video_file, start, duration, output_audio):
    """
    Extract an audio segment from video_file as WAV format for WhisperX.
    """
    command = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-i", str(video_file),
        "-t", str(duration),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_audio)
    ]
    run_command(command)


def seconds_to_ass_time(seconds):
    """
    Convert seconds to ASS timestamp format:
    H:MM:SS.cc
    """
    seconds = max(0.0, float(seconds))

    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    whole_seconds = int(seconds % 60)

    centiseconds = int(
        (seconds - int(seconds)) * 100
    )

    return (
        f"{hours}:"
        f"{minutes:02d}:"
        f"{whole_seconds:02d}."
        f"{centiseconds:02d}"
    )


def escape_ass_text(text):
    """
    Escape characters that have special meaning in ASS.
    """
    return (
        text
        .replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
    )


def escape_subtitle_path(path):
    """
    Escape a Windows path for FFmpeg's subtitles filter.
    """
    path = str(Path(path).resolve())
    path = path.replace("\\", "/")
    path = path.replace(":", r"\:")
    path = path.replace("'", r"\'")

    return path


def get_ass_position_tag(position: str = "center") -> str:
    r"""
    Map subtitle position name to ASS alignment/position tag.

    center:           {\an5}                 (Middle of 1080x1920 canvas)
    bottom_center:    {\an2}                 (Standard bottom-center)
    bottom_center_up: {\an2\pos(540,1600)}   (Bottom-center moved slightly upward into 4:5 area)
    """
    position_map = {
        "center": r"{\an5}",
        "bottom_center": r"{\an2}",
        "bottom_center_up": r"{\an2\pos(540,1600)}",
    }
    return position_map.get(position, r"{\an5}")


def generate_ass_plain(
    words,
    output_file,
    font_name="Arial",
    font_size=64,
    highlight_color="&H00FFFF&",  # accepted but unused; kept for uniform call signature
    subtitle_position="center"
):
    """
    Generate plain ASS subtitles: words are grouped into short lines
    (up to MAX_WORDS words or MAX_DURATION seconds) and rendered as
    solid white text with no per-word colour or karaoke timing tags.
    """

    MAX_WORDS = 6
    MAX_DURATION = 3.0

    lines = []
    current_words = []
    line_start = None

    for word in words:
        if "start" not in word or "end" not in word:
            continue

        text = word.get("word", "").strip()

        if not text:
            continue

        start = float(word["start"])
        end = float(word["end"])

        if line_start is None:
            line_start = start

        current_words.append({
            "text": text,
            "start": start,
            "end": end
        })

        if (
            len(current_words) >= MAX_WORDS
            or end - line_start >= MAX_DURATION
        ):
            lines.append(current_words)
            current_words = []
            line_start = None

    if current_words:
        lines.append(current_words)

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "PlayResX: 1080\n"
            "PlayResY: 1920\n"
            "ScaledBorderAndShadow: yes\n"
            "\n"

            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, "
            "PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, "
            "MarginV, Encoding\n"

            f"Style: Default,"
            f"{font_name},"
            f"{font_size},"
            "&H00FFFFFF,"
            "&H00FFFFFF,"
            "&H00000000,"
            "&H80000000,"
            "-1,0,0,0,"
            "100,100,0,0,"
            "1,4,2,5,"
            "60,60,60,1\n"

            "\n"

            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, "
            "MarginL, MarginR, MarginV, Effect, Text\n"
        )

        pos_tag = get_ass_position_tag(subtitle_position)

        for line_words in lines:

            if not line_words:
                continue

            start = line_words[0]["start"]
            end = line_words[-1]["end"]

            subtitle_text = escape_ass_text(
                " ".join(w["text"] for w in line_words)
            )

            f.write(
                "Dialogue: 0,"
                f"{seconds_to_ass_time(start)},"
                f"{seconds_to_ass_time(end)},"
                "Default,,0,0,0,,"
                f"{pos_tag}{subtitle_text}\n"
            )


def generate_ass_karaoke_sentence(
    words,
    output_file,
    highlight_color="&H00FFFF&",
    font_name="Arial",
    font_size=64,
    subtitle_position="center"
):
    MAX_WORDS = 6
    MAX_DURATION = 3.0

    lines = []
    current_words = []
    line_start = None

    for word in words:
        if "start" not in word or "end" not in word:
            continue

        text = word.get("word", "").strip()

        if not text:
            continue

        start = float(word["start"])
        end = float(word["end"])

        if line_start is None:
            line_start = start

        current_words.append({
            "text": text,
            "start": start,
            "end": end
        })

        if (
            len(current_words) >= MAX_WORDS
            or end - line_start >= MAX_DURATION
        ):
            lines.append(current_words)
            current_words = []
            line_start = None

    if current_words:
        lines.append(current_words)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "PlayResX: 1080\n"
            "PlayResY: 1920\n"
            "ScaledBorderAndShadow: yes\n"
            "\n"

            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, "
            "PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, "
            "MarginV, Encoding\n"

            f"Style: Default,"
            f"{font_name},"
            f"{font_size},"
            "&H00FFFFFF,"       # Normal words = white
            "&H00FFFFFF,"
            "&H00000000,"       # Black outline
            "&H80000000,"       # Black shadow
            "-1,0,0,0,"
            "100,100,0,0,"
            "1,4,2,5,"
            "60,60,60,1\n"

            "\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, "
            "MarginL, MarginR, MarginV, Effect, Text\n"
        )

        pos_tag = get_ass_position_tag(subtitle_position)

        for line_words in lines:
            if not line_words:
                continue

            for active_index, active_word in enumerate(line_words):

                subtitle_text = ""

                for index, word in enumerate(line_words):
                    text = escape_ass_text(word["text"])

                    if index == active_index:
                        # Currently spoken word
                        subtitle_text += (
                            f"{{\\c{highlight_color}}}"
                            f"{text}"
                            r"{\c&HFFFFFF&}"
                            " "
                        )
                    else:
                        # Other words
                        subtitle_text += f"{text} "

                subtitle_text = subtitle_text.strip()

                f.write(
                    "Dialogue: 0,"
                    f"{seconds_to_ass_time(active_word['start'])},"
                    f"{seconds_to_ass_time(active_word['end'])},"
                    "Default,,0,0,0,,"
                    f"{pos_tag}{subtitle_text}\n"
                )


def generate_ass_word_level(
    words,
    output_file,
    highlight_color="&H00FFFF&",
    font_name="Arial",
    font_size=64,
    subtitle_position="center"
):
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "PlayResX: 1080\n"
            "PlayResY: 1920\n"
            "ScaledBorderAndShadow: yes\n"
            "\n"

            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, "
            "PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, "
            "MarginV, Encoding\n"

            f"Style: Default,"
            f"{font_name},"
            f"{font_size},"
            "&H00FFFFFF,"
            "&H00FFFFFF,"
            "&H00000000,"
            "&H80000000,"
            "-1,0,0,0,"
            "100,100,0,0,"
            "1,4,2,5,"
            "60,60,60,1\n"

            "\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, "
            "MarginL, MarginR, MarginV, Effect, Text\n"
        )

        pos_tag = get_ass_position_tag(subtitle_position)

        for word in words:
            if "start" not in word or "end" not in word:
                continue

            text = word.get("word", "").strip()

            if not text:
                continue

            start = seconds_to_ass_time(float(word["start"]))
            end = seconds_to_ass_time(float(word["end"]))

            subtitle_text = (
                f"{pos_tag}{{\\c{highlight_color}}}"
                f"{escape_ass_text(text)}"
                f"{{\\c&HFFFFFF&}}"
            )

            f.write(
                "Dialogue: 0,"
                f"{start},"
                f"{end},"
                "Default,,0,0,0,,"
                f"{subtitle_text}\n"
            )


def generate_ass_karaoke_sentence(
    words,
    output_file,
    highlight_color="&H00FFFF&",
    normal_color="&HFFFFFF&",
    font_name="Arial",
    font_size=64,
    subtitle_position="center"
):
    """
    Generate ASS subtitles with sentence-level karaoke highlighting.

    - Entire sentence stays visible.
    - Currently spoken word highlights using karaoke timing.
    - No flickering between words.
    - highlight_color: ASS AABBGGRR format.
    - normal_color: ASS AABBGGRR format.
    """

    MAX_WORDS = 6
    MAX_DURATION = 3.0

    lines = []
    current_words = []
    line_start = None

    for word in words:
        if "start" not in word or "end" not in word:
            continue

        text = word.get("word", "").strip()

        if not text:
            continue

        start = float(word["start"])
        end = float(word["end"])

        if line_start is None:
            line_start = start

        current_words.append({
            "text": text,
            "start": start,
            "end": end
        })

        if (
            len(current_words) >= MAX_WORDS
            or end - line_start >= MAX_DURATION
        ):
            lines.append(current_words)
            current_words = []
            line_start = None

    if current_words:
        lines.append(current_words)

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "PlayResX: 1080\n"
            "PlayResY: 1920\n"
            "ScaledBorderAndShadow: yes\n"
            "\n"

            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, "
            "PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, "
            "MarginV, Encoding\n"

            f"Style: Default,"
            f"{font_name},"
            f"{font_size},"
            f"{highlight_color},"
            f"{normal_color},"
            "&H00000000,"
            "&H80000000,"
            "-1,0,0,0,"
            "100,100,0,0,"
            "1,4,2,5,"
            "60,60,60,1\n"

            "\n"

            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, "
            "MarginL, MarginR, MarginV, Effect, Text\n"
        )

        pos_tag = get_ass_position_tag(subtitle_position)

        for line_words in lines:

            if not line_words:
                continue

            start = line_words[0]["start"]
            end = line_words[-1]["end"]

            subtitle_text = ""

            for word in line_words:

                # ASS karaoke duration is centiseconds
                duration = max(
                    1,
                    round(
                        (word["end"] - word["start"]) * 100
                    )
                )

                text = escape_ass_text(
                    word["text"]
                )

                subtitle_text += (
                    f"{{\\kf{duration}}}"
                    f"{text} "
                )

            subtitle_text = subtitle_text.strip()

            f.write(
                "Dialogue: 0,"
                f"{seconds_to_ass_time(start)},"
                f"{seconds_to_ass_time(end)},"
                "Default,,0,0,0,,"
                f"{pos_tag}{subtitle_text}\n"
            )
            

def create_final_clip(
    video_file,
    start,
    duration,
    subtitle_file,
    output_file
):
    """
    Create the final 9:16 clip:

    - enlarged blurred background
    - 4:5 center-cropped foreground
    - ASS subtitles burned into the video
    """

    subtitle_path = escape_subtitle_path(
        subtitle_file
    )

    filter_complex = (
        # -----------------------------------------------------
        # Background
        # -----------------------------------------------------
        "[0:v]"
        "scale=1080:1920:"
        "force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        "boxblur=20:10"
        "[bg];"

        # -----------------------------------------------------
        # Foreground
        # 16:9 -> 4:5 center crop
        # -----------------------------------------------------
        "[0:v]"
        "crop=ih*4/5:ih:(iw-ih*4/5)/2:0,"
        "scale=1080:1350"
        "[fg];"

        # -----------------------------------------------------
        # Center foreground vertically
        # -----------------------------------------------------
        "[bg][fg]"
        "overlay=0:(H-h)/2"
        "[video];"

        # -----------------------------------------------------
        # Burn subtitles
        # -----------------------------------------------------
        f"[video]subtitles='{subtitle_path}'"
        "[outv]"
    )

    command = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-i", str(video_file),
        "-t", str(duration),
        "-filter_complex",
        filter_complex,
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_file)
    ]

    run_command(command)


def generateClips(
    id,
    whisper_model,
    align_model,
    align_metadata,
    device,
    subtitle_config=None
):
    """
    Generate all selected clips for a video.

    whisper_model:
        Already-loaded WhisperX model owned by pipeline.py.

    align_model:
        Already-loaded English alignment model owned by
        pipeline.py.

    align_metadata:
        Metadata belonging to the English alignment model.

    device:
        Explicit WhisperX device selected by pipeline.py.
        This should be "cuda" or "cpu".
    """

    video_dir = youtube_video_dir(id)

    metadata_file = video_dir / "metadata.json"

    with open(
        metadata_file,
        "r",
        encoding="utf-8"
    ) as f:
        metadata = json.load(f)

    if (
        metadata["pipeline"]["clips-processed"] is True
        and (video_dir / "clips").is_dir()
        and any((video_dir / "clips").glob("*.mp4"))
    ):
        print("clips already made")
        return

    timestamps_file = (
        video_dir / "clipTimestamps.json"
    )

    with open(
        timestamps_file,
        "r",
        encoding="utf-8"
    ) as f:
        clips = json.load(f)

    video_file = video_dir / f"{id}.mp4"

    if not video_file.exists():
        raise FileNotFoundError(
            f"Video file not found: {video_file}"
        )

    # ---------------------------------------------------------
    # Display device information.
    #
    # IMPORTANT:
    # "cuda" and "cuda:0" are equivalent here.
    # Do NOT compare them as strings.
    # ---------------------------------------------------------

    print()
    print("WhisperX device:", device)
    print(
        "CUDA available:",
        torch.cuda.is_available()
    )

    alignment_device = next(
        align_model.parameters()
    ).device

    print(
        "Alignment model device:",
        alignment_device
    )

    # ---------------------------------------------------------
    # All temporary and final files are stored in /clips.
    # ---------------------------------------------------------

    output_dir = video_dir / "clips"

    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # ---------------------------------------------------------
    # Process every selected clip
    # ---------------------------------------------------------

    for i, clip in enumerate(clips, start=1):

        start = float(clip["start"])
        end = float(clip["end"])
        duration = end - start

        title = sanitize_filename(
            clip["title"]
        )

        output_file = (
            output_dir
            / f"{i:02d}_{title}.mp4"
        )

        # Temporary files stay inside /clips.
        temp_audio = (
            output_dir
            / f".tmp_{i:02d}.wav"
        )

        temp_ass = (
            output_dir
            / f".tmp_{i:02d}.ass"
        )

        print()
        print("=" * 60)
        print(
            f"Processing clip "
            f"{i}/{len(clips)}"
        )
        print(f"Title: {title}")
        print(f"Start: {start}")
        print(f"End: {end}")
        print("=" * 60)

        try:

            # -------------------------------------------------
            # 1. Extract temporary audio
            # -------------------------------------------------

            print("Extracting audio...")

            extract_audio(
                video_file,
                start,
                duration,
                temp_audio
            )

            # -------------------------------------------------
            # 2. Transcribe using the shared WhisperX model
            # -------------------------------------------------

            print("Transcribing...")

            audio = whisperx.load_audio(
                str(temp_audio)
            )

            result = whisper_model.transcribe(
                audio,
                batch_size=16,
                language="en"
            )

            # -------------------------------------------------
            # 3. Generate word-level timestamps
            # -------------------------------------------------

            print(
                "Generating word-level timestamps..."
            )

            # Do NOT use:
            #
            #     whisper_model.device
            #
            # WhisperX uses CTranslate2 internally and this
            # property is not a reliable representation of the
            # actual CTranslate2 execution device.
            #
            # Also do NOT move align_model here. It was already
            # loaded on the requested device.

            alignment_device = next(
                align_model.parameters()
            ).device

            print(
                "WhisperX device:",
                device
            )

            print(
                "Alignment model device:",
                alignment_device
            )

            aligned_result = whisperx.align(
                result["segments"],
                align_model,
                align_metadata,
                audio,
                device,
                return_char_alignments=False
            )

            words = aligned_result.get(
                "word_segments",
                []
            )

            if not words:
                raise RuntimeError(
                    "WhisperX returned no "
                    "word-level timestamps."
                )

            print(
                f"Detected {len(words)} words."
            )

            # -------------------------------------------------
            # 4. Generate temporary ASS subtitles
            # -------------------------------------------------

            print(
                "Generating ASS subtitles..."
            )

            # --------------------------------------------------
            # Resolve subtitle parameters from subtitle_config.
            # All fields fall back to the function-signature
            # defaults when subtitle_config is absent.
            # --------------------------------------------------

            subtitles_enabled = True
            sub_style = "plain"
            sub_font = "Arial"
            sub_size = 64
            sub_color = "&H00FFFF&"
            sub_position = "center"

            if subtitle_config is not None:
                subtitles_enabled = subtitle_config.enabled
                sub_style = subtitle_config.style
                sub_font = subtitle_config.font_name
                sub_size = subtitle_config.font_size
                sub_color = subtitle_config.highlight_color
                sub_position = getattr(subtitle_config, 'position', 'center')

            if not subtitles_enabled:
                # Burn no subtitles; write an empty ASS file so
                # create_final_clip() still gets a valid path.
                with open(temp_ass, "w", encoding="utf-8") as f:
                    f.write(
                        "[Script Info]\n"
                        "ScriptType: v4.00+\n"
                        "[V4+ Styles]\n"
                        "[Events]\n"
                    )
                print("Subtitles disabled — writing empty ASS file.")
            elif sub_style == "word_level":
                generate_ass_word_level(
                    words,
                    temp_ass,
                    highlight_color=sub_color,
                    font_name=sub_font,
                    font_size=sub_size,
                    subtitle_position=sub_position
                )
            elif sub_style == "karaoke_sentence":
                generate_ass_karaoke_sentence(
                    words,
                    temp_ass,
                    highlight_color=sub_color,
                    font_name=sub_font,
                    font_size=sub_size,
                    subtitle_position=sub_position
                )
            else:
                # Default: "plain" (grouped lines, no highlighting)
                # or any unrecognised style value.
                generate_ass_plain(
                    words,
                    temp_ass,
                    font_name=sub_font,
                    font_size=sub_size,
                    subtitle_position=sub_position
                )

            # -------------------------------------------------
            # 5. Generate final video
            # -------------------------------------------------

            print(
                f"Creating final clip:\n"
                f"{output_file}"
            )

            create_final_clip(
                video_file,
                start,
                duration,
                temp_ass,
                output_file
            )

            print("Final clip created.")

        finally:

            # -------------------------------------------------
            # 6. Delete temporary audio
            # -------------------------------------------------

            if temp_audio.exists():

                try:
                    temp_audio.unlink()

                    print(
                        f"Deleted temporary audio: "
                        f"{temp_audio.name}"
                    )

                except Exception as e:

                    print(
                        f"Could not delete "
                        f"{temp_audio}: {e}"
                    )

            # -------------------------------------------------
            # 7. Delete temporary ASS
            # -------------------------------------------------

            if temp_ass.exists():

                try:
                    temp_ass.unlink()

                    print(
                        f"Deleted temporary subtitles: "
                        f"{temp_ass.name}"
                    )

                except Exception as e:

                    print(
                        f"Could not delete "
                        f"{temp_ass}: {e}"
                    )

    # ---------------------------------------------------------
    # Mark processing as complete
    # ---------------------------------------------------------

    metadata["pipeline"]["clips-processed"] = True

    with open(
        metadata_file,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            metadata,
            f,
            indent=4,
            ensure_ascii=False
        )

    print()
    print("All clips created.")