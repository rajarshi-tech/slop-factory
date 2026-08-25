import json
from app.utils.storage import youtube_links_dir

# update logic later
def determineRank(searchResults):
    links = []
    for item in searchResults:
        links.append({
            "link": item["link"]
        })
    return links

def calculateTrend():
    links_dir = youtube_links_dir()
    with open(str(links_dir / "search-results.json"), "r", encoding="utf-8") as file:
        searchResults = json.load(file)
    links = determineRank(searchResults)
    with open(str(links_dir / "ranked-videos.json"), "w", encoding="utf-8") as file:
        json.dump(links, file, indent=4, ensure_ascii=False)
    print("trends ranked...")
