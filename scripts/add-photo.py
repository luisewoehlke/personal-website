"""Add images to the feed (photos.json), backdated from their file names.

Usage:
  python scripts/add-photo.py "images/img posts/PXL_20260806_171101013.MP.jpg"
  python scripts/add-photo.py some.jpg --date 2024-05-01 --caption "a caption"
  python scripts/add-photo.py --refresh   (after editing/cropping originals)

The date is read from names like PXL_20260806_171101013, IMG_20160615_153135,
20160411_204910 or IMG-20230717-WA0000. Use --date to set or override it.
Use --pile NAME to stack images into one feed item dated by the newest one.
"""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "images" / "feed"
SOURCE_DIR = ROOT / "images" / "img posts"
PHOTOS = ROOT / "photos.json"
MAX_SIDE = 1600

NAME_PATTERNS = [
    re.compile(r"(?P<d>\d{8})_(?P<t>\d{6})(?P<f>\d*)"),
    re.compile(r"(?P<d>\d{8})-WA\d+"),
]


def date_from_name(name: str) -> datetime | None:
    for pattern in NAME_PATTERNS:
        match = pattern.search(name)
        if not match:
            continue
        groups = match.groupdict()
        stamp = match.group("d") + (groups.get("t") or "120000")
        try:
            when = datetime.strptime(stamp, "%Y%m%d%H%M%S")
        except ValueError:
            continue
        micro = int(((groups.get("f") or "") + "000000")[:6])
        return when.replace(microsecond=micro, tzinfo=timezone.utc)
    return None


def parse_date(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def web_stem(source: Path) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", source.stem.split(".")[0]).strip("-")


def web_copy(source: Path) -> tuple[Path, int, int]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / f"{web_stem(source)}.jpg"
    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        img.save(target, "JPEG", quality=82, optimize=True, progressive=True)
        return target, img.width, img.height


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="rebuild every web copy in photos.json from images/img posts, keeping its settings",
    )
    parser.add_argument("--date", help="ISO date/time, e.g. 2024-05-01 or 2024-05-01T18:30")
    parser.add_argument("--caption", default="")
    parser.add_argument("--pile", help="group images with the same pile name into one stack")
    parser.add_argument("--front", action="store_true", help="show this image on top of its pile")
    parser.add_argument("--scale", type=float, help="display size in the feed, e.g. 0.5 for half")
    parser.add_argument("--order", type=int, help="position in its pile, 0 = top")
    args = parser.parse_args()

    photos = json.loads(PHOTOS.read_text(encoding="utf-8")) if PHOTOS.exists() else []

    if args.refresh:
        sources = {web_stem(path): path for path in SOURCE_DIR.iterdir() if path.is_file()}
        for photo in photos:
            source = sources.get(Path(photo["src"]).stem)
            if source is None:
                print(f"Skipped {photo['src']}: no original in {SOURCE_DIR.name}")
                continue
            _, photo["width"], photo["height"] = web_copy(source)
            print(f"Refreshed {photo['src']} ({photo['width']}x{photo['height']})")

    for source in args.files:
        when = parse_date(args.date) if args.date else date_from_name(source.name)
        if when is None:
            raise SystemExit(f"No date in {source.name!r}; pass --date YYYY-MM-DD")
        target, width, height = web_copy(source)
        src = target.relative_to(ROOT).as_posix()
        photos = [photo for photo in photos if photo.get("src") != src]
        entry = {
            "src": src,
            "date": when.isoformat().replace("+00:00", "Z"),
            "width": width,
            "height": height,
        }
        if args.caption:
            entry["caption"] = args.caption
        if args.pile:
            entry["pile"] = args.pile
        if args.front:
            entry["front"] = True
        if args.scale:
            entry["scale"] = args.scale
        if args.order is not None:
            entry["order"] = args.order
        photos.append(entry)
        print(f"Added {src} dated {entry['date']}")

    photos.sort(key=lambda photo: photo["date"], reverse=True)
    PHOTOS.write_text(json.dumps(photos, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
