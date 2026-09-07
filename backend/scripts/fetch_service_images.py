#!/usr/bin/env python3
"""Download curated Commons images into frontend public/images/services/ and write attribution JSON.

Usage:
  cd backend && python scripts/fetch_service_images.py
"""
from __future__ import annotations

import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).resolve().parent / "service_images_manifest.json"
OUT_DIR = ROOT / "bseva-export" / "client" / "public" / "images" / "services"
ATTRIB = OUT_DIR / "ATTRIBUTION.json"
MAX_EDGE = 1400
JPEG_QUALITY = 82

try:
    import certifi

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()

UA = {"User-Agent": "BSevaCatalogBot/1.0 (service catalog images; https://bseva.app)"}


def api(params: dict) -> dict:
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
        return json.load(r)


def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


def fetch_meta(titles: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 20):
        batch = titles[i : i + 20]
        time.sleep(0.35)
        data = api(
            {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|size|mime",
                "format": "json",
            }
        )
        for p in data.get("query", {}).get("pages", {}).values():
            if "missing" in p:
                continue
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            em = ii.get("extmetadata") or {}
            out[p["title"]] = {
                "title": p["title"],
                "url": (ii.get("url") or "").split("?")[0],
                "license": (em.get("LicenseShortName") or {}).get("value", "?"),
                "license_url": (em.get("LicenseUrl") or {}).get("value", ""),
                "artist": strip_html((em.get("Artist") or {}).get("value", ""))[:120],
                "page": ii.get("descriptionurl"),
                "width": ii.get("width"),
                "height": ii.get("height"),
            }
    return out


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as r:
        return r.read()


def optimize_jpeg(data: bytes, dest: Path) -> None:
    img = Image.open(BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")
    w, h = img.size
    scale = min(1.0, MAX_EDGE / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    services = manifest["services"]
    titles = sorted(
        {
            s["commons_title"]
            for s in services.values()
            if s.get("commons_title") and not s.get("image_needed")
        }
    )
    print(f"Resolving {len(titles)} Commons files…")
    meta = fetch_meta(titles)
    attribution: dict[str, dict] = {}
    ok = 0
    failed: list[str] = []

    for slug, cfg in sorted(services.items()):
        if cfg.get("image_needed") or not cfg.get("commons_title"):
            continue
        title = cfg["commons_title"]
        m = meta.get(title)
        if not m or not m.get("url"):
            print(f"MISS {slug}: {title}")
            failed.append(slug)
            continue
        dest = OUT_DIR / f"{slug}.jpg"
        try:
            print(f"GET  {slug} ← {title}")
            raw = download(m["url"])
            optimize_jpeg(raw, dest)
            attribution[slug] = {
                "slug": slug,
                "stored": f"/images/services/{slug}.jpg",
                "source": "Wikimedia Commons",
                "commons_title": title,
                "source_page": m.get("page"),
                "artist": m.get("artist"),
                "license": m.get("license"),
                "license_url": m.get("license_url"),
                "relevance": cfg.get("relevance"),
                "needs_review": bool(cfg.get("needs_review")),
                "review_note": cfg.get("review_note"),
            }
            ok += 1
            time.sleep(0.25)
        except Exception as e:
            print(f"FAIL {slug}: {e}")
            failed.append(slug)

    ATTRIB.write_text(json.dumps(attribution, indent=2))
    print(f"\nDone: {ok} images → {OUT_DIR}")
    print(f"Attribution → {ATTRIB}")
    if failed:
        print("Failed:", ", ".join(failed))


if __name__ == "__main__":
    main()
