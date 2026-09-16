"""Puja catalog helpers: search normalization, enrichment, resolution by slug/alias."""
from __future__ import annotations

import json
import re
import unicodedata
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import row_dict
from app.i18n import normalize_lang

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
    # Keep Unicode letters *and combining marks* used by Indic scripts. Python
    # ``\w`` excludes some vowel signs, so filtering with a regex corrupts words.
    s = (q or "").strip().casefold()
    s = "".join(
        ch if (ch.isspace() or ch in "-_/" or unicodedata.category(ch)[0] in {"L", "M", "N"}) else " "
        for ch in s
    )
    s = re.sub(r"\s+", " ", s).strip()
    parts = []
    for tok in s.split():
        parts.append(_ALIAS_EXPAND.get(tok, tok))
    return " ".join(parts)


def localized_service_name(db: Session, service_id: str, lang: str | None, fallback: str = "Puja") -> str:
    """Resolve a customer-facing service name without changing the canonical row."""
    code = normalize_lang(lang)
    try:
        name = db.execute(
            text(
                """
                SELECT COALESCE(NULLIF(st.name, ''), s.name)
                FROM services s
                LEFT JOIN service_translations st
                  ON st.service_id = s.id AND st.language_code = :lang
                WHERE s.id = CAST(:id AS uuid)
                """
            ),
            {"id": service_id, "lang": code},
        ).scalar()
        return str(name or fallback)
    except Exception:
        try:
            name = db.execute(
                text("SELECT name FROM services WHERE id = CAST(:id AS uuid)"),
                {"id": service_id},
            ).scalar()
            return str(name or fallback)
        except Exception:
            return fallback


def service_categories(db: Session, service_id: str, lang: str | None = None) -> list[dict]:
    code = normalize_lang(lang)
    rows = db.execute(
        text(
            """
            SELECT c.id, c.slug, COALESCE(ct.name, c.name) AS name, c.sort_order
            FROM service_category_map m
            JOIN service_categories c ON c.id = m.category_id
            LEFT JOIN category_translations ct
              ON ct.category_id = c.id AND ct.language_code = :lang
            WHERE m.service_id = CAST(:sid AS uuid) AND c.active = TRUE
            ORDER BY c.sort_order, c.name
            """
        ),
        {"sid": service_id, "lang": code},
    ).mappings().all()
    return [row_dict(r) for r in rows]


def enrich_service(
    db: Session,
    row: Any,
    *,
    include_inactive_meta: bool = False,
    lang: str | None = None,
) -> dict:
    data = row_dict(row)
    sid = str(data["id"])
    try:
        data["categories"] = service_categories(db, sid, lang)
    except Exception:
        data["categories"] = []
    aliases = data.get("search_aliases") or []
    if isinstance(aliases, str):
        try:
            aliases = json.loads(aliases)
        except Exception:
            aliases = []
    data["search_aliases"] = aliases
    for key in ("process_steps", "languages"):
        val = data.get(key)
        if isinstance(val, str):
            try:
                data[key] = json.loads(val)
            except Exception:
                data[key] = [] if key == "process_steps" else ["en"]
    # Overlay translated marketing fields without duplicating the service row
    code = normalize_lang(lang)
    data["locale"] = code
    if code != "en":
        try:
            tr = db.execute(
                text(
                    """
                    SELECT name, short_description, full_description, spiritual_meaning,
                           common_occasions, benefits, whats_included,
                           customer_instructions, pujari_instructions
                    FROM service_translations
                    WHERE service_id = CAST(:id AS uuid) AND language_code = :lang
                    LIMIT 1
                    """
                ),
                {"id": sid, "lang": code},
            ).mappings().first()
            if tr:
                for k in (
                    "name",
                    "short_description",
                    "full_description",
                    "spiritual_meaning",
                    "common_occasions",
                    "benefits",
                    "whats_included",
                    "customer_instructions",
                    "pujari_instructions",
                ):
                    if tr.get(k):
                        data[k] = tr[k]
        except Exception:
            pass
    # Bookable only when active and priced
    priced = data.get("standard_price_paise") is not None and int(data.get("standard_price_paise") or 0) >= 0
    if data.get("pricing_status") == "awaiting_pricing" or data.get("standard_price_paise") is None:
        priced = False
    data["bookable"] = bool(data.get("active")) and priced
    try:
        from app.service_addons import customer_samagri_price_paise

        data["customer_samagri_price_paise"] = customer_samagri_price_paise(db, data)
    except Exception:
        data["customer_samagri_price_paise"] = int(data.get("samagri_price_paise") or 0)
    if not include_inactive_meta and not data.get("active"):
        # still return for featured home cards
        pass
    try:
        from app.pujari_team import package_pujaris_map

        data["package_pujaris"] = package_pujaris_map(data)
    except Exception:
        data["package_pujaris"] = {"basic": 1, "standard": 1, "premium": 1}
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


def list_categories_public(db: Session, lang: str | None = None) -> list[dict]:
    code = normalize_lang(lang)
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
    out = [row_dict(r) for r in rows]
    if code == "en" or not out:
        return out
    try:
        ids = [str(r["id"]) for r in out]
        tr_rows = db.execute(
            text(
                """
                SELECT category_id::text AS category_id, name
                FROM category_translations
                WHERE language_code = :lang
                  AND category_id = ANY(CAST(:ids AS uuid[]))
                """
            ),
            {"lang": code, "ids": ids},
        ).mappings().all()
        names = {str(r["category_id"]): r["name"] for r in tr_rows if r.get("name")}
        for item in out:
            translated = names.get(str(item["id"]))
            if translated:
                item["name"] = translated
    except Exception:
        pass
    return out
