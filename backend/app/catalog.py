"""Puja catalog helpers: search normalization, enrichment, resolution by slug/alias."""
from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import row_dict

# Common spelling normalizations for forgiving search
_ALIAS_EXPAND = {
    "pooja": "puja",
    "puja": "puja",
    "homam": "homam",
    "homa": "homam",
    "havan": "homam",
    "yagna": "homam",
    "yajna": "homam",
    "ganapati": "ganapathi",
    "ganesh": "ganapathi",
    "ganesha": "ganapathi",
    "vinayaka": "ganapathi",
    "griha": "griha",
    "gruha": "griha",
    "laxmi": "lakshmi",
    "vivaha": "marriage",
    "vivaham": "marriage",
    "muhurtham": "muhurta",
    "muhurtha": "muhurta",
}


def normalize_search(q: str) -> str:
    s = (q or "").strip().lower()
    s = re.sub(r"[^a-z0-9\s\-_/]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    parts = []
    for tok in s.split():
        parts.append(_ALIAS_EXPAND.get(tok, tok))
    return " ".join(parts)


def service_categories(db: Session, service_id: str) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT c.id, c.slug, c.name, c.sort_order
            FROM service_category_map m
            JOIN service_categories c ON c.id = m.category_id
            WHERE m.service_id = CAST(:sid AS uuid) AND c.active = TRUE
            ORDER BY c.sort_order, c.name
            """
        ),
        {"sid": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


def enrich_service(db: Session, row: Any, *, include_inactive_meta: bool = False) -> dict:
    data = row_dict(row)
    sid = str(data["id"])
    try:
        data["categories"] = service_categories(db, sid)
    except Exception:
        data["categories"] = []
    aliases = data.get("search_aliases") or []
    if isinstance(aliases, str):
        try:
            aliases = json.loads(aliases)
        except Exception:
            aliases = []
    data["search_aliases"] = aliases
    # Bookable only when active and priced
    priced = data.get("standard_price_paise") is not None and int(data.get("standard_price_paise") or 0) >= 0
    if data.get("pricing_status") == "awaiting_pricing" or data.get("standard_price_paise") is None:
        priced = False
    data["bookable"] = bool(data.get("active")) and priced
    if not include_inactive_meta and not data.get("active"):
        # still return for featured home cards
        pass
    return data


def resolve_service_by_slug(db: Session, slug: str, *, active_only: bool = True):
    row = db.execute(
        text("SELECT * FROM services WHERE slug = :s"),
        {"s": slug},
    ).mappings().first()
    if not row:
        alias = db.execute(
            text(
                """
                SELECT s.* FROM service_slug_aliases a
                JOIN services s ON s.id = a.service_id
                WHERE a.alias_slug = :s
                """
            ),
            {"s": slug},
        ).mappings().first()
        row = alias
    if not row:
        return None
    if active_only and not row["active"]:
        return None
    return row


def list_categories_public(db: Session) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT c.*, COUNT(m.service_id) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM services s
                WHERE s.id = m.service_id AND s.active = TRUE
              )
            ) AS service_count
            FROM service_categories c
            LEFT JOIN service_category_map m ON m.category_id = c.id
            WHERE c.active = TRUE
            GROUP BY c.id
            ORDER BY c.sort_order, c.name
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]
