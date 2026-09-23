"""Write posts.json from the Substack archive, including likes and comments."""

import json
import urllib.request
from pathlib import Path

ARCHIVE = "https://luisew.substack.com/api/v1/archive?sort=new&limit=20"
OUT = Path(__file__).resolve().parents[1] / "posts.json"


def main():
    request = urllib.request.Request(
        ARCHIVE,
        headers={"User-Agent": "personal-website-feed"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        posts = json.load(response)

    cleaned = [
        {
            "title": post.get("title") or "",
            "subtitle": post.get("subtitle") or post.get("description") or "",
            "url": post.get("canonical_url") or "",
            "date": post.get("post_date") or "",
            "image": post.get("cover_image") or "",
            "likes": post.get("reaction_count") or 0,
            "comments": post.get("comment_count") or 0,
        }
        for post in posts
    ]

    OUT.write_text(
        json.dumps(cleaned, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(cleaned)} posts")


if __name__ == "__main__":
    main()
