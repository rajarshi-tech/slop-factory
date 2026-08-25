import json

from app.pipeline.youtube.scraper import scrape
from app.pipeline.youtube.trendCalculator import calculateTrend
from app.pipeline.youtube.downloader import download
from app.pipeline.youtube.transcript import generateTimestamps

from app.utils.storage import youtube_links_dir, youtube_video_dir

def pipeline():
    print("gathering links...")
    scrape()

    print("calculating trend ranks...")
    calculateTrend()

    links_dir = youtube_links_dir()

    with open(str(links_dir / "ranked-videos.json"), "r", encoding="utf-8") as file:
        videos = json.load(file)

    for video in videos:

        video_dir = youtube_video_dir(video["id"])
        with open(str(video_dir / "metadata.json"), "r", encoding="utf-8") as file:
            metadata = json.load(file)

        print("Title: " + metadata["title"] + "\nTrend score: " +  metadata["trend_score"])
        choice = input("Download video? [y/n] ")

        if choice in "yY":
                    
            print("downloading video...")
            download(video["id"])

            print("generating timestamps...")
            generateTimestamps(video["id"])

            print("generating clips...")
            

