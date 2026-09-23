"""Write posts.json from the Substack RSS feed."""

import json
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED = "https://luisew.substack.com/feed"
OUT = Path(__file__).resolve().parents[1] / "posts.json"


def text(element, tag):
    child = element.find(tag)
    return (child.text or "").strip() if child is not None else ""


def main():
    request = urllib.request.Request(
        FEED,
        headers={"User-Agent": "personal-website-feed"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())

    posts = []
    for item in root.findall("./channel/item"):
        enclosure = item.find("enclosure")
        published = text(item, "pubDate")
        try:
            published = parsedate_to_datetime(published).isoformat()
        except (TypeError, ValueError, IndexError):
            pass
        posts.append(
            {
                "title": text(item, "title"),
                "subtitle": text(item, "description"),
                "url": text(item, "link"),
                "date": published,
                "image": enclosure.get("url", "") if enclosure is not None else "",
            }
        )

    OUT.write_text(
        json.dumps(posts, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(posts)} posts")


if __name__ == "__main__":
    main()
