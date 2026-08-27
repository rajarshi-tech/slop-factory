import json

from app.pipeline.youtube.scraper import scrape
from app.pipeline.youtube.trendCalculator import calculateTrend
from app.pipeline.youtube.downloader import download
from app.pipeline.youtube.transcript import generateTimestamps
from app.pipeline.youtube.processor import generateClips

from app.utils.storage import youtube_links_dir, youtube_video_dir

def pipeline():

    ch = input("gather links? [y/n]")

    if ch in 'yY':
        print("gathering links...")
        scrape()

    ch = input("calculate trade ranks? [y/n]")
    
    if ch in 'yY':
        print("calculating trend ranks...")
        calculateTrend()

    links_dir = youtube_links_dir()

    with open(str(links_dir / "ranked-videos.json"), "r", encoding="utf-8") as file:
        videos = json.load(file)

    for video in videos:

        video_dir = youtube_video_dir(video["video_id"])
        with open(str(video_dir / "metadata.json"), "r", encoding="utf-8") as file:
            metadata = json.load(file)

        print("Title: " + metadata["title"] + "\nTrend score: " +  str(metadata["trend_score"]) + "\nVideo length: " + str(metadata["details"]["duration"]))
        choice = input("Process video? [y/n] ")

        if choice in "yY":

            ch = input("download video? [y/n]")
            
            if ch in 'yY':       
                print("downloading video...")
                download(video["video_id"])

            ch = input("generate timestamps? [y/n]")
                        
            if ch in 'yY': 
                print("generating timestamps...")
                generateTimestamps(video["video_id"])

            ch = input("generate clips? [y/n]")
                        
            if ch in 'yY': 
                print("generating clips...")
                generateClips(video["video_id"])

        print("Process complete for this video")

    print("all videos processed")

pipeline()