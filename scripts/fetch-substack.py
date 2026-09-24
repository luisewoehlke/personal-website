"""Write posts.json from Substack, the EA Forum, and LessWrong."""

import json
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

SUBSTACK = "https://luisew.substack.com/api/v1/archive?sort=new&limit=20"
SUBSTACK_RSS = "https://luisew.substack.com/feed"
EA_FORUM = "https://forum.effectivealtruism.org/graphql"
EA_USER_ID = "QSRzNmgN7ite2ibbr"
LESSWRONG = "https://www.lesswrong.com/graphql"
LESSWRONG_USER_ID = "5K3whaNkEi8qKDMw4"
OUT = Path(__file__).resolve().parents[1] / "posts.json"
EA_FORUM_LOGO = "images/ea-forum-logo.png"
LESSWRONG_LOGO = "images/lesswrong-logo.svg"
RESEARCH_URLS = {
    "https://forum.effectivealtruism.org/posts/4cxtbsdA7DGKyjdKA/will-the-us-government-control-the-first-agi-finding-base",
    "https://forum.effectivealtruism.org/posts/L9pixdGZpJrBicYsS/could-regulatory-cost-benefit-analysis-stop-frontier-ai-1",
}
SKIP_URLS = {
    "https://www.lesswrong.com/posts/3CdKcgo8vrb2hxEFd/5-things-i-learned-about-people-from-doing-stand-up-comedy-1",
    "https://forum.effectivealtruism.org/posts/Ev5iSTJnniCrsSDKm/i-made-a-judgment-calibration-game-for-beginners-calibrate",
    "https://www.lesswrong.com/posts/H3rjMpndZkqEQhS6k/in-defence-of-epistemic-modesty-distillation",
    "https://forum.effectivealtruism.org/posts/MSq9u6ZtbNTrptQy7/consciousness-research-as-a-cause-asking-for-advice",
}

FORUM_QUERY = """
{
  posts(input: {terms: {view: "userPosts", userId: "%s", limit: %s, offset: %s}}) {
    results {
      title
      postedAt
      baseScore
      commentCount
      pageUrl
      socialPreviewImageUrl
      contents { plaintextDescription }
    }
  }
}
"""

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, application/xml, text/xml, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_bytes(url, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    request_headers = dict(BROWSER_HEADERS)
    if headers:
        request_headers.update(headers)
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def fetch_json(url, body=None):
    return json.loads(fetch_bytes(url, body=body))


def subtitle_from(text):
    words = " ".join((text or "").split())
    if not words:
        return ""
    for index, char in enumerate(words):
        if char in ".!?" and index >= 40:
            words = words[: index + 1]
            break
    if len(words) <= 110:
        preview = words
    else:
        preview = words[:110].rsplit(" ", 1)[0]
    preview = preview.rstrip(".,;:—-… ")
    return f"{preview}…" if preview else ""


def excerpt(text, limit=80):
    words = " ".join((text or "").split())
    if not words or len(words) <= limit:
        return words
    cut = words[:limit].rsplit(" ", 1)[0].rstrip(".,;:—-")
    return f"{cut}…"


def substack_from_api():
    posts = fetch_json(SUBSTACK)
    return [
        {
            "title": (post.get("title") or "").strip(),
            "subtitle": post.get("subtitle") or post.get("description") or "",
            "url": post.get("canonical_url") or "",
            "date": post.get("post_date") or "",
            "image": post.get("cover_image") or "",
            "likes": post.get("reaction_count") or 0,
            "comments": post.get("comment_count") or 0,
            "excerpt": excerpt(post.get("truncated_body_text")),
            "category": "stand-up",
        }
        for post in posts
    ]


def substack_from_rss():
    root = ET.fromstring(fetch_bytes(SUBSTACK_RSS))
    cleaned = []
    for item in root.findall("./channel/item"):
        link = (item.findtext("link") or "").strip()
        if not link:
            continue
        pub = item.findtext("pubDate") or ""
        try:
            date = parsedate_to_datetime(pub).isoformat()
        except (TypeError, ValueError, IndexError):
            date = pub
        enclosure = item.find("enclosure")
        image = enclosure.get("url") if enclosure is not None else ""
        description = item.findtext("description") or ""
        cleaned.append(
            {
                "title": (item.findtext("title") or "").strip(),
                "subtitle": description.strip(),
                "url": link,
                "date": date,
                "image": image or "",
                "likes": 0,
                "comments": 0,
                "excerpt": excerpt(description),
                "category": "stand-up",
            }
        )
    return cleaned


def substack_posts():
    try:
        return substack_from_api()
    except urllib.error.HTTPError as error:
        print(f"Substack API {error.code}; falling back to RSS")
        return substack_from_rss()


def forum_posts(endpoint, user_id, logo):
    cleaned = []
    offset = 0
    limit = 20
    while True:
        payload = fetch_json(
            endpoint,
            {"query": FORUM_QUERY % (user_id, limit, offset)},
        )
        posts = (payload.get("data") or {}).get("posts", {}).get("results") or []
        for post in posts:
            description = (post.get("contents") or {}).get("plaintextDescription") or ""
            url = post.get("pageUrl") or ""
            if not url:
                continue
            cleaned.append(
                {
                    "title": (post.get("title") or "").strip(),
                    "subtitle": subtitle_from(description),
                    "url": url,
                    "date": post.get("postedAt") or "",
                    "image": post.get("socialPreviewImageUrl") or logo,
                    "likes": post.get("baseScore") or 0,
                    "comments": post.get("commentCount") or 0,
                    "excerpt": excerpt(description),
                    "category": "blog",
                }
            )
        if len(posts) < limit:
            break
        offset += limit
    return cleaned


def safe_source(label, loader):
    try:
        posts = loader()
        print(f"{label}: {len(posts)} posts")
        return posts
    except Exception as error:
        print(f"{label} failed: {error}")
        return []


def main():
    posts = (
        safe_source("Substack", substack_posts)
        + safe_source("EA Forum", lambda: forum_posts(EA_FORUM, EA_USER_ID, EA_FORUM_LOGO))
        + safe_source(
            "LessWrong",
            lambda: forum_posts(LESSWRONG, LESSWRONG_USER_ID, LESSWRONG_LOGO),
        )
    )
    if not posts:
        raise SystemExit("No posts fetched from any source")
    posts = [post for post in posts if post["url"] not in SKIP_URLS]
    for post in posts:
        if post["url"] in RESEARCH_URLS:
            post["category"] = "research"
    posts.sort(key=lambda post: post["date"], reverse=True)
    OUT.write_text(
        json.dumps(posts, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(posts)} posts")


if __name__ == "__main__":
    main()
