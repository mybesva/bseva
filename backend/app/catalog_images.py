"""Resolve on-disk catalog cover images (same files the web app serves from /images/services)."""

from __future__ import annotations

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]

_DIRS = [
    _REPO_ROOT / "bseva-export" / "client" / "public" / "images" / "services",
    _REPO_ROOT / "client" / "public" / "images" / "services",
    Path(__file__).resolve().parent / "static" / "images" / "services",
]


def public_images_root() -> Path | None:
    for d in _DIRS:
        if d.is_dir():
            return d.parent
    return None


def catalog_image_file(slug: str | None, image_url: str | None, image_path: str | None) -> Path | None:
    names: list[str] = []
    for raw in (image_url, image_path):
        if not raw:
            continue
        name = Path(str(raw).split("?")[0]).name
        if name and name not in names:
            names.append(name)
    if slug:
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            names.append(f"{slug}{ext}")
    for directory in _DIRS:
        if not directory.is_dir():
            continue
        for name in names:
            path = directory / name
            if path.is_file():
                return path
    return None
