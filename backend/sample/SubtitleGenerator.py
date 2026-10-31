import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from faster_whisper import WhisperModel
import torch

def format_srt_timestamp(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)

    return f"{hrs:02}:{mins:02}:{secs:02},{millis:03}"





def generate_srt():

    model = WhisperModel(
        "medium",
        device="cuda" if torch.cuda.is_available() else "cpu",
        compute_type="float16" if torch.cuda.is_available() else "int8"
    )
    
    segments, _ = model.transcribe(
        "output/output.wav",
        word_timestamps=True
    )

    subtitle_index = 1

    with open("output/subtitles.srt", "w", encoding="utf-8") as f:
        for segment in segments:

            if segment.words is None:
                continue

            for word in segment.words:

                start = format_srt_timestamp(word.start)
                end = format_srt_timestamp(word.end)

                text = word.word.strip()

                if not text:
                    continue

                f.write(f"{subtitle_index}\n")
                f.write(f"{start} --> {end}\n")
                f.write(f"{text}\n\n")

                subtitle_index += 1

    print("Word-level SRT subtitles generated.")
