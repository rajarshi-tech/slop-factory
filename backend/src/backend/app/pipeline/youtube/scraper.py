from app.core.config import YOUTUBE_API_KEY
from googleapiclient.discovery import build
from app.utils.storage import youtube_params_dir, youtube_links_dir
import json

def parse_video(item, topic):
    video_id = item["id"]["videoId"]

    return {
        "id": video_id,

        "topic": {
            "name": topic,
            "query": topic
        },

        "youtube": {
            "title": item["snippet"]["title"],
            "channel": item["snippet"]["channelTitle"],
            "link": f"https://youtube.com/watch?v={video_id}",
            "published_at": item["snippet"]["publishedAt"]
        },

        "pipeline": {
            "downloaded": False,
            "processed": False
        }
    }

def scrape():
    params_dir = youtube_params_dir()
    links_dir = youtube_links_dir()

    with open(str(params_dir / "params.json"), "r") as file:
        params = json.load(file)

    youtube = build(
        "youtube",
        "v3",
        developerKey=YOUTUBE_API_KEY
    )

    request = youtube.search().list(
        part="snippet",
        q=params["q"],
        type="video",
        order=params["order"],
        maxResults=params["maxResults"],
        videoDuration=params["videoDuration"],
        videoCaption=params["videoCaption"],
        videoLicense=params["videoLicense"]
    )

    response = request.execute()


    videos = []

    for item in response["items"]:
        video_id = item["id"]["videoId"]

        videos.append({
            "title": item["snippet"]["title"],
            "link": f"https://youtube.com/watch?v={video_id}"
        })


    with open(str(links_dir / "search-results.json"), "w", encoding="utf-8") as file:
        json.dump(videos, file, indent=4, ensure_ascii=False)

    print("links gathered...")
    return