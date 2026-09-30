"""Local page for adding pictures to the feed.

Usage:
  python scripts/upload-form.py

Opens http://127.0.0.1:8765 on this computer only. Pictures are resized into
images/feed, originals are kept in images/img posts, and photos.json is updated.
Commit and push to main when you want them on the site.
"""

import argparse
import html
import importlib.util
import json
import re
import sys
import threading
import traceback
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MAX_FILES = 24
MAX_FILE_BYTES = 30 * 1024 * 1024
MAX_BODY_BYTES = 120 * 1024 * 1024
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp", ".heic", ".heif"}
LOCK = threading.Lock()

PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Add pictures</title>
  <style>
    :root {
      --bg: #ffccac;
      --ink: #1c1916;
      --muted: #5c564e;
      --card: #fffdf9;
      --line: #e4cbb8;
      --accent: #009691;
      --warn: #9a3412;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.5;
    }
    main {
      width: min(40rem, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2.5rem 0 4rem;
    }
    h1 { font-weight: 500; font-size: 2.4rem; margin: 0 0 0.4rem; }
    .lede, .hint, .path, .shows { color: var(--muted); }
    .lede { margin: 0 0 1.5rem; }
    form {
      background: var(--card);
      border-radius: 1.25rem;
      padding: 1.25rem;
      display: grid;
      gap: 1rem;
    }
    .drop {
      position: relative;
      border: 1.5px dashed #b67a58;
      border-radius: 1rem;
      min-height: 7.5rem;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 1rem;
    }
    .drop.is-over { background: #fff3ea; }
    .drop input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }
    .drop p { margin: 0; pointer-events: none; }
    .fields { display: grid; gap: 0.8rem; }
    label { display: grid; gap: 0.25rem; }
    .check { display: flex; align-items: center; gap: 0.5rem; }
    input[type="text"], input[type="number"], input[type="datetime-local"] {
      width: 100%;
      font: inherit;
      color: inherit;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 0.6rem;
      padding: 0.45rem 0.6rem;
    }
    input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    input:disabled { color: var(--muted); background: #f6f1ea; }
    .pile-picks { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .pile-picks:empty { display: none; }
    .pile-chip, .file-actions button, .submit {
      font: inherit;
      cursor: pointer;
      border-radius: 999px;
    }
    .pile-chip, .file-actions button {
      background: #fff;
      border: 1px solid var(--line);
      color: inherit;
      padding: 0.2rem 0.65rem;
    }
    .pile-chip span { color: var(--muted); }
    .hint, .shows { margin: 0; font-size: 0.95rem; }
    .shows.is-missing { color: var(--warn); }
    .files { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
    .files:empty { display: none; }
    .file, .keep {
      display: grid;
      grid-template-columns: 4.5rem 1fr auto;
      gap: 0.75rem;
      align-items: center;
      padding-top: 0.7rem;
      border-top: 1px solid var(--line);
    }
    .keep { grid-template-columns: 1fr; }
    .file img {
      width: 4.5rem;
      height: 4.5rem;
      object-fit: cover;
      border-radius: 0.5rem;
      background: #f6f1ea;
    }
    .file-name {
      margin: 0 0 0.35rem;
      word-break: break-word;
    }
    .file-actions { display: grid; gap: 0.35rem; }
    .front { display: flex; align-items: center; gap: 0.35rem; }
    form:not(.show-front) .front, form:not(.show-front) .keep { display: none; }
    .submit {
      justify-self: start;
      background: var(--ink);
      color: var(--bg);
      border: 0;
      padding: 0.65rem 1.1rem;
    }
    .submit:disabled { cursor: default; opacity: 0.45; }
    #status:empty { display: none; }
    #status.is-error { color: var(--warn); }
    .path { margin: 1rem 0 0; font-size: 0.85rem; word-break: break-all; }
    @media (max-width: 640px) {
      .file { grid-template-columns: 4rem 1fr; }
      .file-actions { grid-column: 2; grid-auto-flow: column; justify-content: start; }
      .submit { justify-self: stretch; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Add pictures</h1>
    <p class="lede">Drop in photos, put a date on them, and stack a pile when they belong together. This only changes files on this computer. Commit and push to main when you want them on the site.</p>
    <form id="add" autocomplete="off">
      <div class="drop" id="drop">
        <input id="files" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.bmp,.heic,.heif" multiple aria-label="Choose pictures">
        <p>Drop pictures here, or click to choose</p>
      </div>
      <div class="fields">
        <label>Pile name
          <input id="pile" name="pile" type="text" list="pile-options" maxlength="41" spellcheck="false" placeholder="Blank leaves each picture on its own">
        </label>
        <div id="pile-picks" class="pile-picks"></div>
        <datalist id="pile-options"></datalist>
        <label>Caption
          <input id="caption" name="caption" type="text" maxlength="400">
        </label>
        <label>Size in the feed
          <input id="scale" name="scale" type="number" inputmode="decimal" min="0.15" max="1.5" step="0.05" placeholder="1">
        </label>
      </div>
      <div class="one-date">
        <label class="check"><input id="one-date" type="checkbox"> Use one date for every picture</label>
        <label>Date
          <input id="batch-date" type="datetime-local" step="1" disabled>
        </label>
        <p id="batch-shows" class="shows"></p>
      </div>
      <p id="hint" class="hint">Each picture keeps the date in its file name. Set one date when a whole batch should sit on a day you choose.</p>
      <ul id="list" class="files"></ul>
      <button class="submit" type="submit" disabled>Add to the feed</button>
      <p id="status" role="status"></p>
    </form>
    <p class="path">{{ROOT}}</p>
  </main>
  <script>
    const filesInput = document.querySelector("#files");
    const drop = document.querySelector("#drop");
    const form = document.querySelector("#add");
    const pileInput = document.querySelector("#pile");
    const pilePicks = document.querySelector("#pile-picks");
    const pileOptions = document.querySelector("#pile-options");
    const oneDate = document.querySelector("#one-date");
    const batchDate = document.querySelector("#batch-date");
    const batchShows = document.querySelector("#batch-shows");
    const hint = document.querySelector("#hint");
    const list = document.querySelector("#list");
    const submitButton = document.querySelector(".submit");
    const status = document.querySelector("#status");
    const files = [];
    let piles = [];
    let nextId = 1;
    let frontId = null;
    let sending = false;
    const MAX_FILES = 24;
    const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "bmp", "heic", "heif"];

    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

    const pileName = () => pileInput.value.trim();

    const matchingPile = (name) => {
      const key = name.trim().toLowerCase();
      return piles.find((pile) => pile.name.toLowerCase() === key) || null;
    };

    const feedLabel = (iso) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };

    const isoFromLocal = (value) => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    };

    const dateFromName = (name) => {
      const timed = name.match(/(\d{8})_(\d{6})(\d*)/);
      const wa = name.match(/(\d{8})-WA\d+/);
      let ymd = "";
      let hms = "120000";
      let frac = "";
      if (timed) {
        ymd = timed[1];
        hms = timed[2];
        frac = timed[3] || "";
      } else if (wa) {
        ymd = wa[1];
      } else {
        return null;
      }
      const year = Number(ymd.slice(0, 4));
      const month = Number(ymd.slice(4, 6));
      const day = Number(ymd.slice(6, 8));
      const hour = Number(hms.slice(0, 2));
      const minute = Number(hms.slice(2, 4));
      const second = Number(hms.slice(4, 6));
      if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
      const local = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}`;
      const ms = Number((frac + "000").slice(0, 3));
      const date = new Date(year, month - 1, day, hour, minute, second, ms);
      if (Number.isNaN(date.getTime()) || date.getDate() !== day) return null;
      return { local, precise: date.toISOString() };
    };

    const chosenIso = (file) => {
      if (oneDate.checked) return isoFromLocal(batchDate.value);
      if (!file.touched && file.precise) return file.precise;
      return isoFromLocal(file.local);
    };

    const effectiveFrontId = () => {
      const pile = pileName();
      if (!pile || !files.length) return null;
      if (frontId && files.some((file) => file.id === frontId)) return frontId;
      if (matchingPile(pile)) return null;
      return files[0].id;
    };

    const setStatus = (message, isError) => {
      status.textContent = message;
      status.classList.toggle("is-error", Boolean(isError));
    };

    const newestOf = (isos) => isos.filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) || "";

    const updateHint = () => {
      const pile = pileName();
      const known = matchingPile(pile);
      const label = known ? known.name : pile;
      if (!files.length) {
        hint.textContent = pile
          ? `Pictures you add will stack as “${label}”.`
          : "Each picture keeps the date in its file name. Set one date when a whole batch should sit on a day you choose.";
        return;
      }
      if (files.some((file) => !chosenIso(file))) {
        hint.textContent = oneDate.checked
          ? "Pick the date to use for every picture."
          : pile
            ? `Stacked as “${label}”. Pick the missing dates.`
            : "Each picture stays separate. Pick the missing dates.";
        return;
      }
      if (!pile) {
        const shared = oneDate.checked ? isoFromLocal(batchDate.value) : "";
        hint.textContent = shared
          ? `Each picture stays separate, showing on ${feedLabel(shared)}.`
          : "Each picture stays separate, on its own date.";
        return;
      }
      const batchNewest = newestOf(files.map(chosenIso));
      const feedIso = newestOf([batchNewest, known && known.newest]);
      if (known && known.newest && Date.parse(known.newest) > Date.parse(batchNewest)) {
        hint.textContent = `These join “${label}”. The pile still shows on ${feedLabel(known.newest)}, because a picture already in it is newer.`;
        return;
      }
      const joined = known ? "Added to the existing pile. " : "";
      hint.textContent = `${joined}Stacked as “${label}”, showing on ${feedLabel(feedIso)}.`;
    };

    const refreshDates = () => {
      list.querySelectorAll(".file").forEach((row) => {
        const file = files.find((item) => item.id === row.dataset.id);
        const iso = file ? chosenIso(file) : "";
        const shows = row.querySelector(".shows");
        shows.textContent = iso ? `Shows as ${feedLabel(iso)}` : "Pick a date";
        shows.classList.toggle("is-missing", !iso);
      });
      const batchIso = oneDate.checked ? isoFromLocal(batchDate.value) : "";
      batchShows.textContent = batchIso ? `Shows as ${feedLabel(batchIso)}` : "";
      updateHint();
      submitButton.disabled = sending || !files.length;
    };

    const renderPiles = () => {
      pileOptions.innerHTML = piles.map((pile) => `<option value="${escapeHtml(pile.name)}"></option>`).join("");
      pilePicks.innerHTML = piles.map((pile) =>
        `<button type="button" class="pile-chip" data-pile="${escapeHtml(pile.name)}">${escapeHtml(pile.name)} <span>${pile.count}</span></button>`
      ).join("");
    };

    const renderList = () => {
      const pile = pileName();
      const showFront = files.length > 0 && Boolean(pile) && (files.length > 1 || matchingPile(pile));
      form.classList.toggle("show-front", showFront);
      const front = effectiveFrontId();
      const keep = showFront && matchingPile(pile)
        ? `<li class="keep"><label class="check"><input type="radio" name="front" value="" ${front ? "" : "checked"}> Keep the current front</label></li>`
        : "";
      list.innerHTML = keep + files.map((file) => `<li class="file" data-id="${file.id}">
          <img src="${file.url}" alt="">
          <div>
            <p class="file-name">${escapeHtml(file.file.name)}</p>
            <label>Date
              <input class="date" type="datetime-local" step="1" value="${escapeHtml(file.local)}" ${oneDate.checked ? "disabled" : ""}>
            </label>
            <p class="shows"></p>
          </div>
          <div class="file-actions">
            <label class="front"><input type="radio" name="front" value="${file.id}" ${front === file.id ? "checked" : ""}> On top</label>
            <button type="button" class="up">Up</button>
            <button type="button" class="down">Down</button>
            <button type="button" class="remove">Remove</button>
          </div>
        </li>`).join("");
      refreshDates();
    };

    const addFiles = (incoming) => {
      const skipped = [];
      const accepted = [];
      for (const file of incoming) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (file.type.startsWith("image/") || imageExts.includes(ext)) accepted.push(file);
        else skipped.push(file.name);
      }
      const room = MAX_FILES - files.length;
      if (accepted.length > room) {
        skipped.push(...accepted.slice(room).map((file) => file.name));
        accepted.splice(room);
      }
      for (const file of accepted) {
        const found = dateFromName(file.name);
        files.push({
          id: String(nextId++),
          file,
          url: URL.createObjectURL(file),
          local: found ? found.local : "",
          precise: found ? found.precise : "",
          touched: false,
        });
      }
      renderList();
      if (skipped.length) setStatus(`Skipped ${skipped.join(", ")}.`, true);
      else setStatus("");
    };

    filesInput.addEventListener("change", () => {
      addFiles(filesInput.files);
      filesInput.value = "";
    });
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("is-over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("is-over");
      addFiles(event.dataTransfer.files);
    });
    pilePicks.addEventListener("click", (event) => {
      const chip = event.target.closest(".pile-chip");
      if (!chip) return;
      pileInput.value = chip.dataset.pile;
      renderList();
    });
    pileInput.addEventListener("input", renderList);
    oneDate.addEventListener("change", () => {
      batchDate.disabled = !oneDate.checked;
      if (oneDate.checked) batchDate.focus();
      renderList();
    });
    batchDate.addEventListener("input", refreshDates);
    list.addEventListener("input", (event) => {
      if (!event.target.classList.contains("date")) return;
      const row = event.target.closest(".file");
      const file = files.find((item) => item.id === row.dataset.id);
      if (!file) return;
      file.local = event.target.value;
      file.touched = true;
      refreshDates();
    });
    list.addEventListener("change", (event) => {
      if (event.target.name !== "front") return;
      frontId = event.target.value || null;
      updateHint();
    });
    list.addEventListener("click", (event) => {
      const row = event.target.closest(".file");
      if (!row) return;
      const index = files.findIndex((file) => file.id === row.dataset.id);
      if (index < 0) return;
      if (event.target.closest(".remove")) {
        URL.revokeObjectURL(files[index].url);
        if (frontId === files[index].id) frontId = null;
        files.splice(index, 1);
        renderList();
        return;
      }
      if (event.target.closest(".up") && index > 0) {
        [files[index - 1], files[index]] = [files[index], files[index - 1]];
        renderList();
      } else if (event.target.closest(".down") && index < files.length - 1) {
        [files[index + 1], files[index]] = [files[index], files[index + 1]];
        renderList();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!files.length || sending) return;
      if (files.some((file) => !chosenIso(file))) {
        setStatus("Pick a date for every picture.", true);
        return;
      }
      const scale = document.querySelector("#scale").value.trim();
      if (scale && (Number(scale) < 0.15 || Number(scale) > 1.5)) {
        setStatus("Size should be between 0.15 and 1.5.", true);
        return;
      }
      const front = effectiveFrontId();
      const body = new FormData();
      body.append("pile", pileName());
      body.append("caption", document.querySelector("#caption").value);
      body.append("scale", scale);
      body.append("meta", JSON.stringify(files.map((file) => ({
        filename: file.file.name,
        date: chosenIso(file),
        front: Boolean(front) && file.id === front,
      }))));
      for (const file of files) body.append("file", file.file, file.file.name);
      sending = true;
      submitButton.disabled = true;
      setStatus("Adding…");
      try {
        const response = await fetch("/api/add", { method: "POST", body });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Couldn’t add those pictures.");
        const count = payload.added.length;
        const pictures = count === 1 ? "1 picture" : `${count} pictures`;
        const replaced = payload.added.filter((item) => item.replaced).length;
        let message;
        if (payload.pile) {
          message = `Added ${pictures} to “${payload.pile}”. That pile shows on ${feedLabel(payload.feedDate)}.`;
        } else {
          const days = [...new Set(payload.added.map((item) => feedLabel(item.date)))];
          message = `Added ${pictures}, showing on ${days.join(" and ")}.`;
        }
        if (replaced) message += replaced === 1 ? " Replaced 1 picture already in the feed." : ` Replaced ${replaced} pictures already in the feed.`;
        message += " Commit and push to main when you want this on the site.";
        for (const file of files) URL.revokeObjectURL(file.url);
        files.splice(0, files.length);
        frontId = null;
        const pilesResponse = await fetch("/api/piles");
        if (pilesResponse.ok) piles = await pilesResponse.json();
        renderPiles();
        renderList();
        setStatus(message);
      } catch (error) {
        setStatus(error.message || "The local server didn’t answer.", true);
        submitButton.disabled = false;
      } finally {
        sending = false;
        submitButton.disabled = !files.length;
      }
    });

    fetch("/api/piles")
      .then((response) => response.json())
      .then((data) => {
        piles = data;
        renderPiles();
      })
      .catch(() => setStatus("Couldn’t load the existing piles.", true));
  </script>
</body>
</html>
"""


def load_add_photo():
    path = Path(__file__).resolve().with_name("add-photo.py")
    spec = importlib.util.spec_from_file_location("add_photo", path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except ModuleNotFoundError as exc:
        if exc.name == "PIL":
            raise SystemExit("Install Pillow first: python -m pip install pillow") from exc
        raise
    return module


add_photo = load_add_photo()
PAGE_HTML = PAGE.replace("{{ROOT}}", html.escape(str(add_photo.ROOT))).encode("utf-8")


def parse_multipart(content_type: str, body: bytes):
    match = re.search(r'boundary="([^"]+)"', content_type) or re.search(r"boundary=([^;]+)", content_type)
    if not match:
        raise ValueError("Expected a multipart upload.")
    marker = b"--" + match.group(1).strip().encode("utf-8")
    fields: dict[str, list[str]] = {}
    files = []
    for part in body.split(marker)[1:]:
        if part.startswith(b"--"):
            break
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        header_blob, separator, data = part.partition(b"\r\n\r\n")
        if not separator:
            continue
        disposition = ""
        for line in header_blob.split(b"\r\n"):
            decoded = line.decode("utf-8", "replace")
            if decoded.lower().startswith("content-disposition:"):
                disposition = decoded.split(":", 1)[1]
        name = re.search(r'name="([^"]*)"', disposition)
        filename = re.search(r'filename="([^"]*)"', disposition)
        if not name:
            continue
        if filename and filename.group(1):
            files.append({"filename": Path(filename.group(1)).name, "data": data})
        else:
            fields.setdefault(name.group(1), []).append(data.decode("utf-8"))
    return fields, files


def field(fields: dict, name: str) -> str:
    values = fields.get(name) or [""]
    return values[0]


def clean_scale(value: str):
    text = value.strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError as exc:
        raise ValueError("Size should be between 0.15 and 1.5.") from exc
    if not 0.15 <= number <= 1.5:
        raise ValueError("Size should be between 0.15 and 1.5.")
    if abs(number - 1) < 1e-6:
        return None
    return round(number, 3)


def clean_pile(value: str, photos: list):
    pile = re.sub(r"\s+", " ", value.strip())
    if not pile:
        return None
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _-]{0,40}", pile):
        raise ValueError("Use letters, numbers, spaces, and hyphens in the pile name.")
    for photo in photos:
        existing = photo.get("pile")
        if isinstance(existing, str) and existing.lower() == pile.lower():
            return existing
    return pile


def clean_caption(value: str) -> str:
    caption = re.sub(r"\s+", " ", value).strip()
    if len(caption) > 400:
        raise ValueError("Caption should be 400 characters or fewer.")
    return caption


def stored_date(value: str, filename: str) -> str:
    try:
        when = add_photo.parse_date(value)
    except ValueError as exc:
        raise ValueError(f"Pick a date for {filename}.") from exc
    if not 1990 <= when.year <= 2100:
        raise ValueError(f"Pick a date for {filename}.")
    return when.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def allocated_names(filenames: list[str]) -> list[tuple[str, str]]:
    used = set()
    names = []
    for filename in filenames:
        stem = add_photo.web_stem(Path(Path(filename).name)) or "photo"
        ext = Path(filename).suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        if ext not in IMAGE_EXTS:
            ext = ".jpg"
        candidate = stem
        number = 2
        while candidate.lower() in used:
            candidate = f"{stem}-{number}"
            number += 1
        used.add(candidate.lower())
        names.append((f"{candidate}{ext}", candidate))
    return names


def write_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


def pile_summary() -> list[dict]:
    counts: dict[str, dict] = {}
    for photo in add_photo.load_photos():
        name = photo.get("pile")
        when = photo.get("date")
        if not name or not when:
            continue
        try:
            parsed = add_photo.parse_date(when)
        except ValueError:
            continue
        entry = counts.setdefault(name, {"name": name, "count": 0, "newest": when, "stamp": parsed})
        entry["count"] += 1
        if parsed > entry["stamp"]:
            entry["newest"] = when
            entry["stamp"] = parsed
    piles = sorted(counts.values(), key=lambda item: item["name"].lower())
    for pile in piles:
        pile.pop("stamp", None)
    return piles


def add_batch(files: list[dict], meta: list, pile_text: str, caption_text: str, scale_text: str) -> dict:
    if not files:
        raise ValueError("Choose at least one picture.")
    if len(files) > MAX_FILES:
        raise ValueError(f"Add up to {MAX_FILES} pictures at a time.")
    if len(meta) != len(files):
        raise ValueError("The picture details didn’t match the files.")
    for item in files:
        if len(item["data"]) > MAX_FILE_BYTES:
            raise ValueError(f"{item['filename']} is larger than 30MB.")

    prepared = []
    names = allocated_names([item["filename"] for item in files])
    for item, (saved_name, stem), details in zip(files, names, meta):
        filename = details.get("filename") or item["filename"]
        if not isinstance(details.get("date"), str) or not details["date"].strip():
            raise ValueError(f"Pick a date for {filename}.")
        try:
            jpeg, width, height = add_photo.encode_image(item["data"])
        except Exception as exc:
            print(f"Could not read {filename}: {exc}")
            raise ValueError(f"Couldn’t read {filename}. Save it as a JPEG and try again.") from exc
        prepared.append(
            {
                "filename": filename,
                "saved_name": saved_name,
                "stem": stem,
                "original": item["data"],
                "jpeg": jpeg,
                "width": width,
                "height": height,
                "date": stored_date(details["date"], filename),
                "front": details.get("front") is True,
            }
        )

    with LOCK:
        photos = add_photo.load_photos()
        pile = clean_pile(pile_text, photos)
        caption = clean_caption(caption_text)
        scale = clean_scale(scale_text)
        existing = {photo.get("src") for photo in photos}
        orders = [
            photo.get("order")
            for photo in photos
            if pile and photo.get("pile") == pile and isinstance(photo.get("order"), int)
        ]
        start = max(orders) + 1 if orders else 0
        entries = []
        for index, item in enumerate(prepared):
            src = f"images/feed/{item['stem']}.jpg"
            entry = {
                "src": src,
                "date": item["date"],
                "width": item["width"],
                "height": item["height"],
            }
            if caption:
                entry["caption"] = caption
            if pile:
                entry["pile"] = pile
                entry["order"] = start + index
                if item["front"]:
                    entry["front"] = True
            if scale is not None:
                entry["scale"] = scale
            item["src"] = src
            item["replaced"] = src in existing
            entries.append(entry)

        for item in prepared:
            write_file(add_photo.SOURCE_DIR / item["saved_name"], item["original"])
            write_file(add_photo.OUT_DIR / f"{item['stem']}.jpg", item["jpeg"])

        if pile and any(item["front"] for item in prepared):
            for photo in photos:
                if photo.get("pile") == pile:
                    photo.pop("front", None)
        srcs = {entry["src"] for entry in entries}
        photos = [photo for photo in photos if photo.get("src") not in srcs]
        photos.extend(entries)
        add_photo.save_photos(photos)

        feed_date = None
        if pile:
            feed_date = max(
                (photo["date"] for photo in photos if photo.get("pile") == pile),
                key=add_photo.parse_date,
            )
        for item in prepared:
            print(f"Added {item['src']} dated {item['date']}")
        return {
            "pile": pile,
            "feedDate": feed_date,
            "added": [
                {"src": item["src"], "date": item["date"], "replaced": item["replaced"]}
                for item in prepared
            ],
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "feed-form"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.respond(200, PAGE_HTML, "text/html; charset=utf-8")
        elif path == "/api/piles":
            self.respond(200, json.dumps(pile_summary()).encode("utf-8"), "application/json; charset=utf-8")
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        else:
            self.respond(404, b'{"error":"Not found"}', "application/json; charset=utf-8")

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/add":
            self.respond(404, b'{"error":"Not found"}', "application/json; charset=utf-8")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            self.respond(400, b'{"error":"That upload is too large."}', "application/json; charset=utf-8")
            return
        try:
            fields, files = parse_multipart(self.headers.get("Content-Type", ""), self.rfile.read(length))
            meta = json.loads(field(fields, "meta") or "[]")
            if not isinstance(meta, list):
                raise ValueError("The picture details didn’t match the files.")
            result = add_batch(files, meta, field(fields, "pile"), field(fields, "caption"), field(fields, "scale"))
        except ValueError as exc:
            self.respond(400, json.dumps({"error": str(exc)}).encode("utf-8"), "application/json; charset=utf-8")
            return
        except Exception:
            traceback.print_exc()
            self.respond(500, b'{"error":"Couldn\u2019t save those pictures."}', "application/json; charset=utf-8")
            return
        self.respond(200, json.dumps(result).encode("utf-8"), "application/json; charset=utf-8")

    def respond(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def bind(port: int | None) -> ThreadingHTTPServer:
    if port:
        return ThreadingHTTPServer(("127.0.0.1", port), Handler)
    last_error = None
    for candidate in range(8765, 8775):
        try:
            return ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
        except OSError as exc:
            last_error = exc
    raise SystemExit(f"No free port between 8765 and 8774 ({last_error})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Open a local form for adding pictures to the feed.")
    parser.add_argument("--port", type=int, help="port to listen on (default: 8765, or the next free one)")
    parser.add_argument("--no-browser", action="store_true", help="don’t open a browser window")
    args = parser.parse_args()
    if args.port is not None and not 1 <= args.port <= 65535:
        raise SystemExit("Port should be between 1 and 65535.")
    server = bind(args.port)
    host, port = server.server_address[:2]
    url = f"http://{host}:{port}"
    print(f"Add pictures at {url}", flush=True)
    print("Ctrl+C to stop. Commit and push to main when you want them on the site.", flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
