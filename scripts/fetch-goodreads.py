"""Write books.json from the public Goodreads RSS feed of Luise's "read" shelf."""

import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from email.utils import parsedate_to_datetime
from pathlib import Path

USER_ID = "110358691"
FEED = (
    "https://www.goodreads.com/review/list_rss/{user}"
    "?shelf=read&sort=date_read&per_page=100&page={page}"
)
OUT = Path(__file__).resolve().parents[1] / "books.json"
MAX_PAGES = 20
# Books without a finish date fall back to the date they were added; days where
# more than this many undated books were added are bulk imports and are skipped.
BULK_DAY = 3
REVIEW_CHARS = 400


def fetch_items():
    items = []
    for page in range(1, MAX_PAGES + 1):
        request = urllib.request.Request(
            FEED.format(user=USER_ID, page=page),
            headers={"User-Agent": "Mozilla/5.0 (personal website feed)"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            root = ET.fromstring(response.read())
        batch = root.findall("./channel/item")
        items.extend(batch)
        if len(batch) < 100:
            break
    return items


def text(item, tag):
    return (item.findtext(tag) or "").strip()


def plain(markup):
    markup = re.sub(r"<br\s*/?>", " ", markup, flags=re.I)
    markup = re.sub(r"<[^>]+>", "", markup)
    return re.sub(r"\s+", " ", html.unescape(markup)).strip()


def parse_date(value):
    try:
        return parsedate_to_datetime(value) if value else None
    except (TypeError, ValueError):
        return None


def clean_url(url):
    return url.split("?")[0]


def main():
    items = fetch_items()
    undated_days = Counter(
        parse_date(text(item, "user_date_added")).date()
        for item in items
        if not text(item, "user_read_at") and parse_date(text(item, "user_date_added"))
    )

    books = []
    for item in items:
        rating = int(text(item, "user_rating") or 0)
        review = plain(text(item, "user_review"))
        if not rating and not review:
            continue
        read_at = parse_date(text(item, "user_read_at"))
        when = read_at
        if when is None:
            added = parse_date(text(item, "user_date_added"))
            if added is None or undated_days[added.date()] > BULK_DAY:
                continue
            when = added
        if len(review) > REVIEW_CHARS:
            review = review[:REVIEW_CHARS].rsplit(" ", 1)[0] + "…"
        books.append(
            {
                "title": text(item, "title"),
                "author": text(item, "author_name"),
                "url": clean_url(text(item, "link")),
                "rating": rating,
                "review": review,
                "date": when.isoformat(),
            }
        )

    books.sort(key=lambda book: book["date"], reverse=True)
    OUT.write_text(json.dumps(books, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(books)} books to {OUT.name}")


if __name__ == "__main__":
    main()
