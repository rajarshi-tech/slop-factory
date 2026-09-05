import json
from datetime import datetime

import torch
import whisperx

from app.pipeline.youtube.downloader import download
from app.pipeline.youtube.transcript import generateTimestamps
from app.pipeline.youtube.processor import generateClips
from app.utils.storage import youtube_video_dir
from app.init_db import update_job


def load_whisper_models():
    """
    Load WhisperX and the English alignment model once
    for the entire pipeline session.
    """

    device = (
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    compute_type = (
        "float16"
        if device == "cuda"
        else "int8"
    )

    print("Loading WhisperX model...")

    print(
        "CUDA available:",
        torch.cuda.is_available()
    )

    if device == "cuda":
        print(
            "CUDA device:",
            torch.cuda.get_device_name(0)
        )

    # ---------------------------------------------------------
    # Load WhisperX transcription model
    # ---------------------------------------------------------

    whisper_model = whisperx.load_model(
        "large-v3",
        device=device,
        compute_type=compute_type,
        language="en"
    )

    print(
        "Whisper model loaded with device:",
        device
    )

    # ---------------------------------------------------------
    # Load English alignment model
    # ---------------------------------------------------------

    print(
        "Loading English alignment model..."
    )

    align_model, align_metadata = (
        whisperx.load_align_model(
            language_code="en",
            device=device
        )
    )

    print(
        "Alignment model device:",
        next(
            align_model.parameters()
        ).device
    )

    print(
        "WhisperX models loaded."
    )

    return (
        whisper_model,
        align_model,
        align_metadata,
        device
    )


def pipeline(video_id: str):

    # ---------------------------------------------------------
    # Models are loaded lazily.
    #
    # If the session never generates clips, we don't waste
    # time loading WhisperX.
    # ---------------------------------------------------------

    whisper_model = None
    align_model = None
    align_metadata = None
    whisper_device = None

    # ---------------------------------------------------------
    # Video directory & metadata
    # ---------------------------------------------------------

    video_dir = youtube_video_dir(video_id)

    with open(
        video_dir / "metadata.json",
        "r",
        encoding="utf-8"
    ) as file:
        metadata = json.load(file)

    print(
        "Title: "
        + metadata["title"]
        + "\nTrend score: "
        + str(metadata["trend_score"])
        + "\nVideo length: "
        + str(metadata["details"]["duration"])
    )

    # -----------------------------------------------------
    # Helpers for keeping metadata.json and the jobs table
    # in sync as the pipeline progresses.
    # -----------------------------------------------------

    def save_metadata_field(key, value):
        """Persist a single top-level metadata key atomically."""
        metadata[key] = value
        metadata["updated_at"] = datetime.now().isoformat()
        with open(video_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4, ensure_ascii=False)

    def ensure_pipeline_flags():
        """Make sure metadata['pipeline'] exists with default flags."""
        if "pipeline" not in metadata:
            metadata["pipeline"] = {}

        pipeline_flags = metadata["pipeline"]
        pipeline_flags.setdefault("downloaded", False)
        pipeline_flags.setdefault("transcript-analysed", False)
        pipeline_flags.setdefault("clips-processed", False)
        metadata["updated_at"] = datetime.now().isoformat()

        with open(video_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4, ensure_ascii=False)

    ensure_pipeline_flags()

    # -----------------------------------------------------
    # Skip helpers.
    #
    # These mirror the guards used by downloader /
    # transcript / processor so already-finished stages are
    # skipped entirely (no re-download, no re-transcription,
    # no re-rendering).
    # -----------------------------------------------------

    def is_downloaded():
        """Video is downloaded when the flag is set AND an mp4 exists."""
        return (
            metadata["pipeline"].get("downloaded", False)
            and (video_dir / f"{video_id}.mp4").exists()
        )

    def is_timestamps_generated():
        """Timestamps exist when the flag is set AND clipTimestamps.json exists."""
        return (
            metadata["pipeline"].get("transcript-analysed", False)
            and (video_dir / "clipTimestamps.json").exists()
        )

    def is_clips_generated():
        """Clips exist when the flag is set AND at least one clip file exists."""
        if not metadata["pipeline"].get("clips-processed", False):
            return False

        clips_dir = video_dir / "clips"
        return (
            clips_dir.is_dir()
            and any(clips_dir.glob("*.mp4"))
        )

    # -----------------------------------------------------
    # Download
    # -----------------------------------------------------

    if is_downloaded():
        print("video already downloaded")
    else:
        print("downloading video...")
        update_job(video_id, job_status="downloading", progress=20)
        download(video_id)
        save_metadata_field("processing_state", "downloaded")

    # -----------------------------------------------------
    # Generate clip timestamps
    # -----------------------------------------------------

    if is_timestamps_generated():
        print("clip timestamps already generated")
    else:
        print(
            "generating timestamps..."
        )
        update_job(video_id, job_status="transcribing", progress=40)
        generateTimestamps(video_id)
        save_metadata_field("processing_state", "timestamps_ready")

    # -----------------------------------------------------
    # Generate clips
    # -----------------------------------------------------

    if is_clips_generated():
        print("clips already generated")
    else:
        # Load models only the first time clips are
        # generated during this pipeline session.
        if whisper_model is None:

            (
                whisper_model,
                align_model,
                align_metadata,
                whisper_device
            ) = load_whisper_models()

        print(
            "generating clips..."
        )

        update_job(video_id, job_status="generating_clips", progress=60)
        generateClips(
            video_id,
            whisper_model,
            align_model,
            align_metadata,
            whisper_device
        )
        save_metadata_field("processing_state", "clips_ready")

    # -----------------------------------------------------
    # Update video metadata to mark as processed
    # -----------------------------------------------------
    try:
        with open(video_dir / "metadata.json", "r", encoding="utf-8") as f:
            metadata = json.load(f)

        if "pipeline" not in metadata:
            metadata["pipeline"] = {}

        metadata["pipeline"]["processed"] = True
        metadata["pipeline"]["clips-processed"] = True
        metadata["processing_state"] = "processed"
        metadata["updated_at"] = datetime.now().isoformat()

        with open(video_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Warning: Failed to update metadata.json for video {video_id}: {e}")

    # -----------------------------------------------------
    # Sync the jobs table to the final state
    # -----------------------------------------------------

    update_job(
        video_id,
        processing_state="processed",
        job_status="completed",
        progress=100
    )

    print(
        "Process complete for this video"
    )

