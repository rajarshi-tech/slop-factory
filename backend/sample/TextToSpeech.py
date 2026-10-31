import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from TTS.api import TTS
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

def generate_audio():
    
    #tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    tts = TTS("tts_models/en/jenny/jenny").to(device)
    txt = open("input/input.txt", "r", encoding="utf-8").read()

    replacements = {
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "…": "...",
        "—": "-",
        "–": "-",
    }

    for old, new in replacements.items():
        txt = txt.replace(old, new)
    tts.tts_to_file(
        text=txt,
        #speaker_wav="input/speaker.wav",
        #language="en",
        file_path="output/output.wav"
    )
    print("Audio generated.")
