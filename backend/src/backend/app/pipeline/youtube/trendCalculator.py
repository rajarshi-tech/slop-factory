import json
from app.utils.storage import youtube_video_dir
from datetime import datetime, timezone
import math

def calculateAgeHours(published_at):

    published_time = datetime.fromisoformat(
        published_at.replace("Z", "+00:00")
    )

    now = datetime.now(timezone.utc)

    time_diff = now - published_time

    age_hours = time_diff.total_seconds() / 3600

    return age_hours

def calculateRank(view_count, age_hours, like_count, comment_count, subscriber_count):
        

        velocity = view_count / max(age_hours, 1)

        like_rate = like_count / view_count
        comment_rate = comment_count / view_count
        subscriber_velocity = view_count / subscriber_count
        
        engagement =  (0.5 * like_rate + 0.3 * comment_rate + 0.2 * subscriber_velocity)

        trend_score = math.log(velocity + 1) * engagement

        return trend_score

def updateMetadata(id, trend_score):
    video_dir = youtube_video_dir(id)
    with open(str(video_dir / "metadata.json"), "r", encoding="utf-8") as f:
        metadata = json.load(f)

    metadata["trend_score"] = trend_score

    with open(str(video_dir / "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)

def generateList(searchResults):
    """
    Calculate trend scores for videos and update their metadata.

    Args:
        searchResults: List of video dicts from scraper

    Returns:
        List of video dicts with trend_score added
    """
    videos_with_trends = []

    for item in searchResults:
        link = item["link"]
        video_id = item["id"]
        title = item["title"]
        channel = item["channel"]

        view_count = item["view_count"]
        like_count = item["like_count"]
        comment_count = item["comment_count"]
        subscriber_count = item["subscriber_count"]
        age_hours = calculateAgeHours(item["published_at"])

        trend_score = calculateRank(view_count, age_hours, like_count, comment_count, subscriber_count)

        updateMetadata(video_id, trend_score)

        videos_with_trends.append({
            "link": link,
            "video_id": video_id,
            "title": title,
            "channel": channel,
            "trend_score": trend_score
        })

    print(f"Trend scores calculated for {len(videos_with_trends)} videos...")
    return videos_with_trends
