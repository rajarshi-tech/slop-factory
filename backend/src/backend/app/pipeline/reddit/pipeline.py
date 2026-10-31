import json
import logging
import re
import subprocess
import threading
import time
import wave
from collections import deque
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any

import torch
import whisperx

from app.pipeline.reddit.database import update_job
from app.utils.storage import reddit_assets_dir, reddit_item_dir


logger = logging.getLogger(__name__)
BACKGROUND_VIDEO = reddit_assets_dir() / "gameplay.mp4"
_model_lock = threading.Lock()
_whisper_models: tuple[Any, Any, Any, str] | None = None
_tts_model: Any = None


def _load_whisper_models() -> tuple[Any, Any, Any, str]:
    global _whisper_models
    with _model_lock:
        if _whisper_models is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            logger.info("Reddit WhisperX: loading large-v3 on %s (%s)", device, compute_type)
            started_at = perf_counter()
            model = whisperx.load_model(
                "large-v3",
                device=device,
                compute_type=compute_type,
                language="en",
            )
            logger.info("Reddit WhisperX: loading English alignment model")
            align_model, align_metadata = whisperx.load_align_model(
                language_code="en",
                device=device,
            )
            _whisper_models = model, align_model, align_metadata, device
            logger.info(
                "Reddit WhisperX: transcription and alignment models are ready (%.1f seconds)",
                perf_counter() - started_at,
            )
        else:
            logger.info("Reddit WhisperX: reusing models already loaded in this process")
        return _whisper_models


def _load_tts_model() -> Any:
    global _tts_model
    with _model_lock:
        if _tts_model is None:
            logger.info("Reddit TTS: loading Coqui API and Jenny voice")
            try:
                from TTS.api import TTS
            except ImportError as exc:
                raise RuntimeError(
                    "Coqui TTS is required for Reddit processing. Install the backend dependencies."
                ) from exc
            device = "cuda" if torch.cuda.is_available() else "cpu"
            started_at = perf_counter()
            logger.info("Reddit TTS: initializing Jenny voice on %s", device)
            _tts_model = TTS("tts_models/en/jenny/jenny").to(device)
            logger.info("Reddit TTS: Jenny voice is ready (%.1f seconds)", perf_counter() - started_at)
        else:
            logger.info("Reddit TTS: reusing Jenny voice already loaded in this process")
        return _tts_model


def _write_metadata(item_dir: Path, metadata: dict) -> None:
    metadata["updated_at"] = datetime.now().isoformat()
    temporary_path = item_dir / "metadata.json.tmp"
    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2, ensure_ascii=False)
    temporary_path.replace(item_dir / "metadata.json")


def _seconds_to_ass_time(seconds: float) -> str:
    centiseconds = max(0, round(seconds * 100))
    hours, remainder = divmod(centiseconds, 360_000)
    minutes, remainder = divmod(remainder, 6_000)
    whole_seconds, centiseconds = divmod(remainder, 100)
    return f"{hours}:{minutes:02}:{whole_seconds:02}.{centiseconds:02}"


def _escape_ass_text(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")


def _subtitle_groups(words: list[dict]) -> list[list[dict]]:
    groups: list[list[dict]] = []
    current: list[dict] = []
    group_start: float | None = None
    for word in words:
        if word.get("start") is None or word.get("end") is None:
            continue
        text = str(word.get("word", "")).strip().replace("\r", " ").replace("\n", " ")
        if not text:
            continue
        start = max(0.0, float(word["start"]))
        end = max(start + 0.01, float(word["end"]))
        if group_start is None:
            group_start = start
        current.append({"text": text, "start": start, "end": end})
        if len(current) >= 6 or end - group_start >= 3.0:
            groups.append(current)
            current = []
            group_start = None
    if current:
        groups.append(current)
    if not groups:
        raise RuntimeError("WhisperX did not return any word-level timestamps.")
    return groups


def _write_ass_subtitles(words: list[dict], output_file: Path, config: dict) -> None:
    position = config["position"]
    alignment = 2 if position != "center" else 5
    position_tag = {
        "center": r"{\an5}",
        "bottom_center": r"{\an2}",
        "bottom_center_up": r"{\an2\pos(540,1600)}",
    }[position]
    bold = -1 if config["bold"] else 0
    groups = _subtitle_groups(words)

    with output_file.open("w", encoding="utf-8") as file:
        file.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "PlayResX: 1080\n"
            "PlayResY: 1920\n"
            "ScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Default,{config['font_name']},{config['font_size']},"
            f"{config['normal_color']},{config['highlight_color']},"
            f"{config['outline_color']},&H80000000,{bold},0,0,0,"
            f"100,100,0,0,1,{config['outline_width']},{config['shadow']},"
            f"{alignment},60,60,60,1\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, "
            "MarginV, Effect, Text\n"
        )
        style = config["style"]
        for group in groups:
            if style == "plain":
                text = _escape_ass_text(" ".join(word["text"] for word in group))
                file.write(
                    f"Dialogue: 0,{_seconds_to_ass_time(group[0]['start'])},"
                    f"{_seconds_to_ass_time(group[-1]['end'])},Default,,0,0,0,,"
                    f"{position_tag}{text}\n"
                )
            elif style == "word_level":
                for word in group:
                    text = _escape_ass_text(word["text"])
                    file.write(
                        f"Dialogue: 0,{_seconds_to_ass_time(word['start'])},"
                        f"{_seconds_to_ass_time(word['end'])},Default,,0,0,0,,"
                        f"{position_tag}{{\\c{config['highlight_color']}}}{text}"
                        f"{{\\c{config['normal_color']}}}\n"
                    )
            else:
                escaped_words = [_escape_ass_text(word["text"]) for word in group]
                for active_index, word in enumerate(group):
                    event_end = (
                        group[active_index + 1]["start"]
                        if active_index + 1 < len(group)
                        else word["end"]
                    )
                    event_end = max(word["start"] + 0.01, event_end)
                    text = " ".join(
                        f"{{\\c{config['highlight_color'] if index == active_index else config['normal_color']}}}"
                        f"{escaped}"
                        for index, escaped in enumerate(escaped_words)
                    )
                    file.write(
                        f"Dialogue: 0,{_seconds_to_ass_time(word['start'])},"
                        f"{_seconds_to_ass_time(event_end)},Default,,0,0,0,,"
                        f"{position_tag}{text}\n"
                    )


def _escape_filter_path(path: Path) -> str:
    return str(path.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


def _audio_duration(audio_path: Path) -> float:
    with wave.open(str(audio_path), "rb") as audio_file:
        frame_rate = audio_file.getframerate()
        if frame_rate <= 0:
            raise ValueError(f"Audio file has an invalid sample rate: {audio_path}")
        return audio_file.getnframes() / frame_rate


def _run_ffmpeg(item_dir: Path, item_id: str, subtitles_enabled: bool) -> Path:
    audio_path = item_dir / "speech.wav"
    subtitles_path = item_dir / "subtitles.ass"
    output_path = item_dir / f"{item_id}.mp4"
    duration = _audio_duration(audio_path)
    if duration <= 0:
        raise ValueError(f"Audio file is empty: {audio_path}")
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-progress", "pipe:1", "-stream_loop", "-1", "-i", str(BACKGROUND_VIDEO),
        "-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0",
    ]
    if subtitles_enabled:
        command.extend(["-vf", f"ass='{_escape_filter_path(subtitles_path)}'"])
    command.extend([
        "-t", f"{duration:.3f}", "-shortest",
        "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ])
    logger.info(
        "Reddit FFmpeg: rendering item %s for %.1f seconds (background=%s)",
        item_id,
        duration,
        BACKGROUND_VIDEO,
    )
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    recent_output: deque[str] = deque(maxlen=30)
    last_progress = 75
    last_update_time = 0.0
    output_time = 0.0

    if process.stdout is None:
        process.kill()
        raise RuntimeError("FFmpeg progress output could not be opened.")

    try:
        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line:
                continue
            recent_output.append(line)
            if line.startswith(("out_time_us=", "out_time_ms=")):
                try:
                    output_time = int(line.partition("=")[2]) / 1_000_000
                except ValueError:
                    logger.warning("Reddit FFmpeg returned an invalid progress value: %s", line)
            elif line.startswith("out_time="):
                try:
                    hours, minutes, seconds = line.partition("=")[2].split(":")
                    output_time = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
                except ValueError:
                    logger.warning("Reddit FFmpeg returned an invalid output time: %s", line)
            elif not line.startswith((
                "frame=", "fps=", "stream_", "bitrate=", "total_size=",
                "dup_frames=", "drop_frames=", "speed=", "progress=",
            )):
                logger.warning("Reddit FFmpeg: %s", line)

            progress = min(99, 75 + int(24 * min(output_time / duration, 1.0)))
            now = time.monotonic()
            if progress > last_progress and (progress - last_progress >= 2 or now - last_update_time >= 1):
                last_progress = progress
                last_update_time = now
                update_job(item_id, progress=progress)
                logger.info("Reddit FFmpeg: item %s is %d%% complete", item_id, progress)
    except Exception:
        process.kill()
        process.wait()
        raise

    return_code = process.wait()
    if return_code:
        details = "\n".join(recent_output)
        raise RuntimeError(
            f"FFmpeg exited with code {return_code} while rendering Reddit item {item_id}."
            + (f"\nLast FFmpeg output:\n{details}" if details else "")
        )
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError(f"FFmpeg exited successfully but produced no video for Reddit item {item_id}.")
    update_job(item_id, progress=99)
    logger.info("Reddit FFmpeg: item %s rendered successfully (%s bytes)", item_id, output_path.stat().st_size)
    return output_path


def process_item(item_id: str, subtitle_config: dict | None = None) -> dict:
    subtitle_config = subtitle_config or {
        "enabled": True,
        "style": "word_level",
        "font_name": "Arial",
        "font_size": 64,
        "highlight_color": "&H00FFFF&",
        "normal_color": "&HFFFFFF&",
        "outline_color": "&H000000&",
        "outline_width": 2,
        "shadow": 1,
        "bold": True,
        "position": "center",
    }
    item_dir = reddit_item_dir(item_id)
    metadata_path = item_dir / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(f"Metadata for Reddit item {item_id} was not found.")

    with metadata_path.open("r", encoding="utf-8") as file:
        metadata = json.load(file)
    if not isinstance(metadata.get("pipeline"), dict):
        raise ValueError(f"Pipeline metadata for Reddit item {item_id} is invalid.")
    pipeline_state = metadata["pipeline"]
    output_path = item_dir / f"{item_id}.mp4"
    subtitle_config_changed = metadata.get("subtitle_config") != subtitle_config
    render_needed = not (
        pipeline_state.get("video_generated")
        and output_path.is_file()
        and not subtitle_config_changed
    )
    if render_needed:
        if not BACKGROUND_VIDEO.is_file():
            raise FileNotFoundError(
                "Upload a background MP4 using POST /api/reddit/background-video before processing."
            )
    text_path = item_dir / "script.txt"
    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"Reddit item {item_id} has no script text.")

    audio_path = item_dir / "speech.wav"
    if not (pipeline_state.get("audio_generated") and audio_path.is_file()):
        update_job(item_id, job_status="loading_tts", progress=5, error_message=None)
        logger.info("Reddit item %s: loading text-to-speech model", item_id)
        tts_model = _load_tts_model()
        normalized_text = re.sub(r"\s+", " ", text)
        replacements = {"’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "—": "-", "–": "-"}
        for old, new in replacements.items():
            normalized_text = normalized_text.replace(old, new)
        update_job(item_id, job_status="generating_audio", progress=15)
        logger.info("Reddit item %s: generating speech audio", item_id)
        tts_started_at = perf_counter()
        tts_model.tts_to_file(text=normalized_text, file_path=str(audio_path))
        pipeline_state["audio_generated"] = True
        _write_metadata(item_dir, metadata)
        update_job(item_id, progress=35)
        logger.info(
            "Reddit item %s: speech audio generated in %.1f seconds",
            item_id,
            perf_counter() - tts_started_at,
        )

    subtitles_path = item_dir / "subtitles.ass"
    words_path = item_dir / "word_segments.json"
    subtitles_current = (
        subtitle_config["enabled"]
        and pipeline_state.get("subtitles_generated")
        and subtitles_path.is_file()
        and not subtitle_config_changed
    )
    if subtitle_config["enabled"] and not subtitles_current:
        words = []
        if words_path.is_file():
            try:
                words = json.loads(words_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                logger.warning("Reddit item %s: saved word timings were unreadable; transcribing again", item_id)
        if not isinstance(words, list) or not words:
            update_job(item_id, job_status="loading_whisper", progress=38)
            logger.info("Reddit item %s: loading WhisperX transcription and alignment models", item_id)
            whisper_model, align_model, align_metadata, device = _load_whisper_models()
            update_job(item_id, job_status="transcribing", progress=45)
            logger.info("Reddit item %s: transcribing generated speech with WhisperX", item_id)
            transcription_started_at = perf_counter()
            audio = whisperx.load_audio(str(audio_path))
            transcription = whisper_model.transcribe(audio, batch_size=16, language="en")
            logger.info(
                "Reddit item %s: WhisperX transcription found %d segments in %.1f seconds",
                item_id,
                len(transcription["segments"]),
                perf_counter() - transcription_started_at,
            )
            update_job(item_id, job_status="aligning", progress=60)
            logger.info("Reddit item %s: aligning word-level timestamps", item_id)
            alignment_started_at = perf_counter()
            aligned = whisperx.align(
                transcription["segments"],
                align_model,
                align_metadata,
                audio,
                device,
                return_char_alignments=False,
            )
            logger.info(
                "Reddit item %s: WhisperX alignment completed in %.1f seconds",
                item_id,
                perf_counter() - alignment_started_at,
            )
            words = aligned.get("word_segments", [])
            if not words:
                raise RuntimeError("WhisperX did not return any word-level timestamps.")
            words_path.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        _write_ass_subtitles(words, subtitles_path, subtitle_config)
        pipeline_state["subtitles_generated"] = True
        update_job(item_id, progress=70)
        logger.info("Reddit item %s: %s subtitles generated", item_id, subtitle_config["style"])
    elif not subtitle_config["enabled"]:
        pipeline_state["subtitles_generated"] = False

    if render_needed:
        update_job(item_id, job_status="generating_video", progress=75)
        logger.info("Reddit item %s: starting FFmpeg video render", item_id)
        output_path = _run_ffmpeg(item_dir, item_id, subtitle_config["enabled"])
        pipeline_state["video_generated"] = True
    metadata["subtitle_config"] = subtitle_config
    metadata["processing_state"] = "processed"
    metadata["output_video"] = f"/storage/reddit/content/{item_id}/{output_path.name}"
    _write_metadata(item_dir, metadata)

    update_job(
        item_id,
        job_status="completed",
        processing_state="processed",
        progress=100,
        error_message=None,
    )
    logger.info("Reddit item %s: pipeline completed successfully", item_id)
    return {
        "id": item_id,
        "status": "processed",
        "video_url": metadata["output_video"],
    }
