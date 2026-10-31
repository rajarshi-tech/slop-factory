import ffmpeg

video_file = "input/gameplay.mp4"
audio_file = "output/output.wav"
subtitle_file = "output/subtitles.srt"
output_file = "output/output.mp4"

style = (
    "FontName=Poppins ExtraBold,"
    "FontSize=40,"
    "PrimaryColour=&H0000FFFF&,"
    "OutlineColour=&H00000000,"
    "BorderStyle=2,"
    "Outline=2,"
    "Shadow=1,"
    "Bold=0,"
    "Alignment=2,"
    "MarginL=60,"
    "MarginR=60,"
    "MarginV=70"
)

def generate_video():

    video = ffmpeg.input(video_file)
    audio = ffmpeg.input(audio_file)

    (
        ffmpeg
        .output(
            video.video,
            audio.audio,
            output_file,

            vf=f"subtitles='{subtitle_file}':force_style='{style}'",

            vcodec="libx264",
            acodec="aac",

            shortest=None
        )
        .overwrite_output()
        .run()
    )

    print("Video with subtitles and audio generated.")
