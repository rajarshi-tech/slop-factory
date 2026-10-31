import os

from SubtitleGenerator import generate_srt
from TextToSpeech import generate_audio
from VideoEditing import generate_video


def main():

    os.makedirs("output", exist_ok=True)

    print("Generating audio...")
    generate_audio()

    print("Generating subtitles...")
    generate_srt()

    print("Combining video...")
    generate_video()

    print("Done.")


if __name__ == "__main__":
    main()