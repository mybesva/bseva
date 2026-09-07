"""Apply curated service catalog image_url values from public/images/services/*.jpg."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ATTRIB = (
    _REPO_ROOT
    / "bseva-export"
    / "client"
    / "public"
    / "images"
    / "services"
    / "ATTRIBUTION.json"
)


def apply_service_images(conn_or_session: Session, *, only_if_empty: bool = True) -> int:
    """Set services.image_url from downloaded ATTRIBUTION.json. Returns rows updated."""
    if not _ATTRIB.is_file():
        return 0
    data = json.loads(_ATTRIB.read_text())
    updated = 0
    for slug, meta in data.items():
        stored = meta.get("stored")
        if not stored:
            continue
        if only_if_empty:
            sql = text(
                """
                UPDATE services
                SET image_url = :u, image_path = :u
                WHERE slug = :s
                  AND (image_url IS NULL OR btrim(image_url) = '')
                """
            )
        else:
            sql = text(
                """
                UPDATE services
                SET image_url = :u, image_path = :u
                WHERE slug = :s
                """
            )
        res = conn_or_session.execute(sql, {"u": stored, "s": slug})
        updated += res.rowcount or 0
    return updated
