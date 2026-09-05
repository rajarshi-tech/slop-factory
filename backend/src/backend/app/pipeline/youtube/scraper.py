from app.core.config import YOUTUBE_API_KEY
from googleapiclient.discovery import build
from app.utils.storage import youtube_video_dir, load_config
import json
import isodate

def scrape(params: dict = None):
    """
    Search YouTube and return video data.

    Args:
        params: Optional dict of search parameters. If None, loads from config.json

    Returns:
        List of video dicts with metadata
    """
    if params is None:
        config = load_config()
        params = config["params"]

    youtube = build(
        "youtube",
        "v3",
        developerKey=YOUTUBE_API_KEY
    )

    request_params = {
        "part": "snippet",
        "q": params["q"],
        "type": "video",
        "order": params["order"],
        "maxResults": int(params["maxResults"]),
        "videoDuration": params["videoDuration"],
        "videoCaption": params["videoCaption"],
        "videoLicense": params["videoLicense"],
        "relevanceLanguage": "en"
    }

    # Only include date filters if they are valid ISO 8601 strings with timezone
    if params.get("publishedAfter"):
        date_str = params["publishedAfter"]
        # Ensure it ends with Z or has timezone info
        if date_str and (date_str.endswith('Z') or '+' in date_str or date_str.count(':') >= 3):
            request_params["publishedAfter"] = date_str

    if params.get("publishedBefore"):
        date_str = params["publishedBefore"]
        if date_str and (date_str.endswith('Z') or '+' in date_str or date_str.count(':') >= 3):
            request_params["publishedBefore"] = date_str

    if params.get("videoCategoryId"):
            request_params["videoCategoryId"] = params["videoCategoryId"]


    # get video links
    request = youtube.search().list(**request_params)

    response = request.execute()


     # get all video IDs and channel IDs
    video_ids = []
    channel_ids = []
    for item in response["items"]:
        video_ids.append(item["id"]["videoId"])
        channel_ids.append(item["snippet"]["channelId"])


    # get statistics for videos
    stats_response = youtube.videos().list(
        part="statistics",
        id=",".join(video_ids)
    ).execute()

    # Create a lookup dictionary:
    # video_id -> statistics
    statistics = {}
        
    for item in stats_response["items"]:
        statistics[item["id"]] = item["statistics"]


    #get content details for videos
    details_response = youtube.videos().list(
        part="contentDetails",
        id=",".join(video_ids)
    ).execute()

    # Create a lookup dictionary:
    # video_id -> content details
    details = {}

    for item in details_response["items"]:
        details[item["id"]] = isodate.parse_duration(
            item["contentDetails"]["duration"]
        ).total_seconds()


    # Create a lookup dictionary:
    # channel_id -> channel_response
    channel_response = youtube.channels().list(
        part="statistics",
        id=",".join(channel_ids)
    ).execute()

    channel_statistics = {}

    for item in channel_response["items"]:
        channel_statistics[item["id"]] = item["statistics"]

    videos = []


    
    # 3. Combine search data + statistics
    for item in response["items"]:

        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        stats = statistics.get(video_id, {})
        deets = details.get(video_id, 0)
        channel_id = snippet["channelId"]
        channel_stats = channel_statistics.get(channel_id, {})

        videos.append({
            "id": video_id,

            "title": snippet["title"],

            "channel": snippet["channelTitle"],

            "channel_id": channel_id,

            "subscriber_count": int(
                channel_stats.get("subscriberCount", 0)
            ),

            "link": f"https://youtube.com/watch?v={video_id}",

            "published_at": snippet["publishedAt"],

            "view_count": int(stats.get("viewCount", 0)),

            "like_count": int(stats.get("likeCount", 0)),

            "comment_count": int(stats.get("commentCount", 0))
        })

        metadata = {

            "id": video_id,

            "title": snippet["title"],

            "channel": {

                "name": snippet["channelTitle"],

                "id": channel_id,

                "subscriber_count": int(
                    channel_stats.get("subscriberCount", 0)
                ),

            },

    
            "url": f"https://youtube.com/watch?v={video_id}",

            "published_at": snippet["publishedAt"],

            "statistics" : {
                    
                "views": int(stats.get("viewCount", 0)),

                "likes": int(stats.get("likeCount", 0)),

                "comments": int(stats.get("commentCount", 0))

            },

            "details" : {
                "duration": float(deets)
            },

            "pipeline" : {
                "downloaded": False,
                "transcript-analysed": False,
                "clips-processed": False
            }

        }

        video_dir = youtube_video_dir(video_id)

        with open(str(video_dir / "metadata.json"), "w", encoding="utf-8") as file:
            json.dump(metadata, file, indent=4, ensure_ascii=False)

    print(f"{len(videos)} videos gathered...")

    return videos