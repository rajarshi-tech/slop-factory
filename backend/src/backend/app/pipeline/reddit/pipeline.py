import json
import logging
import re
import subprocess
import threading
from datetime import datetime
from pathlib import Path
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
            logger.info("Loading WhisperX large-v3 for Reddit speech transcription")
            model = whisperx.load_model(
                "large-v3",
                device=device,
                compute_type=compute_type,
                language="en",
            )
            align_model, align_metadata = whisperx.load_align_model(
                language_code="en",
                device=device,
            )
            _whisper_models = model, align_model, align_metadata, device
        return _whisper_models


def _load_tts_model() -> Any:
    global _tts_model
    with _model_lock:
        if _tts_model is None:
            try:
                from TTS.api import TTS
            except ImportError as exc:
                raise RuntimeError(
                    "Coqui TTS is required for Reddit processing. Install the backend dependencies."
                ) from exc
            device = "cuda" if torch.cuda.is_available() else "cpu"
            _tts_model = TTS("tts_models/en/jenny/jenny").to(device)
        return _tts_model


def _write_metadata(item_dir: Path, metadata: dict) -> None:
    metadata["updated_at"] = datetime.now().isoformat()
    temporary_path = item_dir / "metadata.json.tmp"
    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2, ensure_ascii=False)
    temporary_path.replace(item_dir / "metadata.json")


def _format_srt_timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02},{milliseconds:03}"


def _write_word_subtitles(words: list[dict], output_file: Path) -> None:
    subtitle_index = 1
    with output_file.open("w", encoding="utf-8") as file:
        for word in words:
            text = str(word.get("word", "")).strip().replace("\r", " ").replace("\n", " ")
            start = word.get("start")
            end = word.get("end")
            if not text or start is None or end is None:
                continue
            start_seconds = max(0.0, float(start))
            end_seconds = max(start_seconds + 0.01, float(end))
            file.write(
                f"{subtitle_index}\n"
                f"{_format_srt_timestamp(start_seconds)} --> "
                f"{_format_srt_timestamp(end_seconds)}\n"
                f"{text}\n\n"
            )
            subtitle_index += 1
    if subtitle_index == 1:
        raise RuntimeError("WhisperX did not return any word-level timestamps.")


def _escape_filter_path(path: Path) -> str:
    return str(path.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


def _run_ffmpeg(item_dir: Path, item_id: str) -> Path:
    audio_path = item_dir / "speech.wav"
    subtitles_path = item_dir / "subtitles.srt"
    output_path = item_dir / f"{item_id}.mp4"
    style = (
        "FontName=Arial,FontSize=40,PrimaryColour=&H00FFFFFF&,"
        "OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,"
        "Alignment=2,MarginL=60,MarginR=60,MarginV=70"
    )
    subtitle_filter = (
        f"subtitles='{_escape_filter_path(subtitles_path)}':"
        f"force_style='{style}'"
    )
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-stream_loop", "-1", "-i", str(BACKGROUND_VIDEO),
            "-i", str(audio_path), "-vf", subtitle_filter, "-shortest",
            "-c:v", "libx264", "-c:a", "aac", "-b:a", "192k", str(output_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"FFmpeg failed while rendering Reddit item: {result.stderr[-2000:]}")
    return output_path


def process_item(item_id: str) -> dict:
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
    if not (pipeline_state.get("video_generated") and output_path.is_file()):
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
        update_job(item_id, job_status="generating_audio", progress=10, error_message=None)
        tts_model = _load_tts_model()
        normalized_text = re.sub(r"\s+", " ", text)
        replacements = {"’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "—": "-", "–": "-"}
        for old, new in replacements.items():
            normalized_text = normalized_text.replace(old, new)
        tts_model.tts_to_file(text=normalized_text, file_path=str(audio_path))
        pipeline_state["audio_generated"] = True
        _write_metadata(item_dir, metadata)

    subtitles_path = item_dir / "subtitles.srt"
    if not (pipeline_state.get("subtitles_generated") and subtitles_path.is_file()):
        update_job(item_id, job_status="transcribing", progress=45)
        whisper_model, align_model, align_metadata, device = _load_whisper_models()
        audio = whisperx.load_audio(str(audio_path))
        transcription = whisper_model.transcribe(audio, batch_size=16, language="en")
        aligned = whisperx.align(
            transcription["segments"],
            align_model,
            align_metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        _write_word_subtitles(aligned.get("word_segments", []), subtitles_path)
        pipeline_state["subtitles_generated"] = True
        _write_metadata(item_dir, metadata)

    if not (pipeline_state.get("video_generated") and output_path.is_file()):
        update_job(item_id, job_status="generating_video", progress=75)
        output_path = _run_ffmpeg(item_dir, item_id)
        pipeline_state["video_generated"] = True
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
    return {
        "id": item_id,
        "status": "processed",
        "video_url": metadata["output_video"],
    }
