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


     # Get all video IDs
    video_ids = []
    for item in response["items"]:
        video_ids.append(item["id"]["videoId"])


    # 2. Get statistics for those videos
    stats_response = youtube.videos().list(
        part="statistics",
        id=",".join(video_ids)
    ).execute()

    # Create a lookup dictionary:
    # video_id -> statistics
    statistics = {}
        
    for item in stats_response["items"]:
        statistics[item["id"]] = item["statistics"]

    videos = []

    # 3. Combine search data + statistics
    for item in response["items"]:
        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        stats = statistics.get(video_id, {})

        videos.append({
            "id": video_id,

            "title": snippet["title"],

            "channel": snippet["channelTitle"],

            "link": f"https://youtube.com/watch?v={video_id}",

            # Upload date
            "published_at": snippet["publishedAt"],

            # View count
            "view_count": int(stats.get("viewCount", 0)),

            # Optional statistics
            "like_count": int(stats.get("likeCount", 0)),
            "comment_count": int(stats.get("commentCount", 0))
        })

    # 4. Save to JSON
    with open(
        str(links_dir / "search-results.json"),
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            videos,
            file,
            indent=4,
            ensure_ascii=False
        )

    print(f"{len(videos)} videos gathered...")