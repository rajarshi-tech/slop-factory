from app.pipeline.youtube.scraper import scrape
from app.pipeline.youtube.trendCalculator import calculateTrend
from app.pipeline.youtube.downloader import download
from pipeline.youtube.downloader import download

def pipeline():
    print("gathering links...")
    scrape()

    print("calculating trend ranks...")
    calculateTrend()

    print("downloading videos...")
    download()

    print("generating timestamps...")
    getTimeStamps()