import json
import shutil

import torch
import whisperx

from app.pipeline.youtube.scraper import scrape
from app.pipeline.youtube.trendCalculator import calculateTrend
from app.pipeline.youtube.downloader import download
from app.pipeline.youtube.transcript import generateTimestamps
from app.pipeline.youtube.processor import generateClips
from app.utils.storage import (
    youtube_links_dir,
    youtube_video_dir
)


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


def pipeline():

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
    # Gather links
    # ---------------------------------------------------------

    ch = input(
        "gather links? [y/n]"
    )

    if ch in "yY":
        print("gathering links...")
        scrape()

    # ---------------------------------------------------------
    # Calculate trend ranks
    # ---------------------------------------------------------

    ch = input(
        "calculate trade ranks? [y/n]"
    )

    if ch in "yY":
        print(
            "calculating trend ranks..."
        )
        calculateTrend()

    # ---------------------------------------------------------
    # Load ranked videos
    # ---------------------------------------------------------

    links_dir = youtube_links_dir()

    with open(
        links_dir / "ranked-videos.json",
        "r",
        encoding="utf-8"
    ) as file:
        videos = json.load(file)

    # ---------------------------------------------------------
    # Process each video
    # ---------------------------------------------------------

    for video in videos:

        video_id = video["video_id"]

        video_dir = youtube_video_dir(
            video_id
        )

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

        choice = input(
            "Process video? [y/n] "
        )

        if choice not in "yY":
            continue

        # -----------------------------------------------------
        # Download
        # -----------------------------------------------------

        ch = input(
            "download video? [y/n]"
        )

        if ch in "yY":
            print("downloading video...")
            download(video_id)

        # -----------------------------------------------------
        # Generate clip timestamps
        # -----------------------------------------------------

        ch = input(
            "generate timestamps? [y/n]"
        )

        if ch in "yY":
            print(
                "generating timestamps..."
            )
            generateTimestamps(video_id)

        # -----------------------------------------------------
        # Generate clips
        # -----------------------------------------------------

        ch = input(
            "generate clips? [y/n]"
        )

        if ch in "yY":

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

            generateClips(
                video_id,
                whisper_model,
                align_model,
                align_metadata,
                whisper_device
            )

        print(
            "Process complete for this video"
        )

    print(
        "all videos processed"
    )


pipeline()