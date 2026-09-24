"""Write raindrops.json from the public Raindrop collection."""

import io
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse

COLLECTION = (
    "https://luise-woehlke.raindrop.page/luises-favorite-things-74011177"
)
OUT = Path(__file__).resolve().parents[1] / "raindrops.json"
PER_PAGE = 50
HIDDEN_TAG = "hide from website"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "personal-website-feed"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def page_items(page):
    html = fetch(f"{COLLECTION}/sort=-sort&perpage={PER_PAGE}&page={page}")
    for match in re.finditer(r"<script[^>]*>(.*?)</script>", html, re.S):
        raw = match.group(1).strip()
        if not raw.startswith("{"):
            continue
        payload = json.loads(raw)
        drops = (payload.get("data") or {}).get("raindrops") or {}
        return drops.get("count") or 0, drops.get("items") or []
    return 0, []


def is_hidden(tags):
    return any(
        tag.strip().lstrip("#").strip().lower() == HIDDEN_TAG for tag in tags
    )


def cover_url(image):
    # Google place photos and Instagram CDN covers refuse to load on other sites.
    # Raindrop's renderer still has them.
    if not image or image.startswith("https://rdl.ink/"):
        return image
    host = urlparse(image).hostname or ""
    if host.endswith("googleusercontent.com") or host.endswith("cdninstagram.com"):
        return "https://rdl.ink/render/" + quote(image, safe="")
    return image


def hsl(red, green, blue):
    red, green, blue = red / 255, green / 255, blue / 255
    high, low = max(red, green, blue), min(red, green, blue)
    light = (high + low) / 2
    if high == low:
        return 0, 0, light
    span = high - low
    sat = span / (1 - abs(2 * light - 1))
    if high == red:
        hue = ((green - blue) / span) % 6
    elif high == green:
        hue = (blue - red) / span + 2
    else:
        hue = (red - green) / span + 4
    return hue * 60, sat, light


def quite_yellow(image_bytes):
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image.thumbnail((32, 32))
    pixels = list(image.getdata())
    if not pixels:
        return False
    yellow = 0
    for red, green, blue in pixels:
        hue, sat, light = hsl(red, green, blue)
        if 40 <= hue <= 70 and sat >= 0.35 and 0.28 <= light <= 0.92:
            yellow += 1
    return yellow / len(pixels) >= 0.4


def fetch_bytes(url):
    request = urllib.request.Request(url, headers={"User-Agent": "personal-website-feed"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def yellow_cache():
    if not OUT.exists():
        return {}
    try:
        previous = json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    cached = {}
    for item in previous:
        image = item.get("image") or ""
        if image and isinstance(item.get("yellow"), bool):
            cached[image] = item["yellow"]
    return cached


def apply_yellow(items):
    # A yellow cover clashes with the brown and rust card colors, so those
    # cards use the teal one instead. Cache by image URL so the hourly job
    # only downloads covers it has not already measured.
    cached = yellow_cache()
    pending = []
    for item in items:
        image = item.get("image") or ""
        if not image:
            continue
        if image in cached:
            item["yellow"] = cached[image]
        else:
            pending.append(item)
    if not pending:
        return
    try:
        import PIL  # noqa: F401
    except ImportError:
        return

    def measure(item):
        try:
            return quite_yellow(fetch_bytes(item["image"]))
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(measure, item): item for item in pending}
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                futures[future]["yellow"] = result


def normalize(item):
    link = item.get("link") or ""
    if not link:
        return None
    domain = item.get("domain") or ""
    if domain.startswith("www."):
        domain = domain[4:]
    tags = [
        tag.strip()
        for tag in (item.get("tags") or [])
        if isinstance(tag, str) and tag.strip()
    ]
    return {
        "title": (item.get("title") or domain or link).strip(),
        "note": " ".join((item.get("note") or "").split()),
        "tags": tags,
        "url": link,
        "image": cover_url(item.get("cover") or ""),
        "domain": domain,
        "type": item.get("type") or "",
    }


def main():
    seen = set()
    items = []
    hidden = 0
    total = None
    page = 0
    while total is None or len(items) < total:
        count, batch = page_items(page)
        if total is None:
            total = count
        if not batch:
            break
        fresh = 0
        for item in batch:
            saved = normalize(item)
            if not saved or saved["url"] in seen:
                continue
            seen.add(saved["url"])
            fresh += 1
            if is_hidden(saved["tags"]):
                hidden += 1
                continue
            items.append(saved)
        if fresh == 0:
            break
        page += 1
        if page > 20:
            break
    apply_yellow(items)
    OUT.write_text(
        json.dumps(items, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} raindrops ({hidden} hidden)")


if __name__ == "__main__":
    main()
