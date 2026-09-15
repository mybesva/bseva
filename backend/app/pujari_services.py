"""Pujari catalog: separate self-applied services vs admin-verified services (bookings use verified only)."""
from __future__ import annotations

import json
import logging

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting
from app.pricing import DEFAULT_DAKSHINA_SHARE_PERCENT, dakshina_share_percent

logger = logging.getLogger(__name__)

_APPLICATIONS_DDL = """
CREATE TABLE IF NOT EXISTS pujari_service_applications (
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pujari_id, service_id)
)
"""

_VERIFIED_DDL = """
CREATE TABLE IF NOT EXISTS pujari_verified_services (
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by UUID REFERENCES users(id),
  PRIMARY KEY (pujari_id, service_id)
)
"""

_LEGACY_OFFERS_DDL = """
CREATE TABLE IF NOT EXISTS pujari_service_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  UNIQUE (pujari_id, service_id)
)
"""


def ensure_service_tables(db: Session) -> None:
    try:
        db.execute(text("SELECT 1 FROM pujari_service_applications LIMIT 1"))
        db.execute(text("SELECT 1 FROM pujari_verified_services LIMIT 1"))
        return
    except Exception:
        db.rollback()
    try:
        db.execute(text(_APPLICATIONS_DDL))
        db.execute(text(_VERIFIED_DDL))
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_pujari_service_applications_pujari "
                "ON pujari_service_applications (pujari_id)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_pujari_verified_services_pujari "
                "ON pujari_verified_services (pujari_id)"
            )
        )
        db.commit()
        _migrate_legacy_offers(db)
    except Exception:
        db.rollback()
        logger.exception("Failed to ensure pujari service tables")
        raise HTTPException(503, "Services catalog is not ready. Please try again in a moment.")


def _migrate_legacy_offers(db: Session) -> None:
    """One-time import from pujari_service_offers if that table exists."""
    try:
        db.execute(text("SELECT 1 FROM pujari_service_offers LIMIT 1"))
    except Exception:
        db.rollback()
        return
    try:
        db.execute(
            text(
                """
                INSERT INTO pujari_verified_services (pujari_id, service_id, verified_at, verified_by)
                SELECT pujari_id, service_id, COALESCE(reviewed_at, requested_at, NOW()), reviewed_by
                FROM pujari_service_offers
                WHERE status = 'approved'
                ON CONFLICT (pujari_id, service_id) DO NOTHING
                """
            )
        )
        db.execute(
            text(
                """
                INSERT INTO pujari_service_applications (pujari_id, service_id, applied_at)
                SELECT pujari_id, service_id, COALESCE(requested_at, NOW())
                FROM pujari_service_offers
                WHERE status IN ('pending', 'rejected', 'approved', 'pending_removal')
                ON CONFLICT (pujari_id, service_id) DO NOTHING
                """
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Legacy pujari_service_offers migration failed")


# Reference catalog price when DB row has no pricing yet (₹5,000)
DEFAULT_CATALOG_BASE_PAISE = 500_000
# Minimum estimated Dakshina shown to pujaris when base is missing (₹500)
DEFAULT_MIN_DAKSHINA_PAISE = 50_000


def catalog_base_price_paise(row: dict) -> int:
    """Best available catalog base price for Dakshina estimate (paise)."""
    for key in (
        "main_puja_price_paise",
        "standard_price_paise",
        "premium_price_paise",
        "basic_price_paise",
    ):
        v = int(row.get(key) or 0)
        if v > 0:
            return v
    return 0


def dakshina_paise_for_service(db: Session, row: dict) -> int:
    base = catalog_base_price_paise(row)
    share = dakshina_share_percent(row)
    if base > 0:
        return max(DEFAULT_MIN_DAKSHINA_PAISE, int(round(base * share / 100)))
    min_display = int(get_setting(db, "min_dakshina_display_paise", DEFAULT_MIN_DAKSHINA_PAISE) or DEFAULT_MIN_DAKSHINA_PAISE)
    ref_base = int(get_setting(db, "default_catalog_base_paise", DEFAULT_CATALOG_BASE_PAISE) or DEFAULT_CATALOG_BASE_PAISE)
    return max(min_display, int(round(ref_base * share / 100)))


def list_catalog_services_for_offers(db: Session) -> list[dict]:
    try:
        rows = db.execute(
            text(
                """
                SELECT id, name, slug, short_description, description, category,
                       basic_price_paise, standard_price_paise, premium_price_paise,
                       main_puja_price_paise, duration_minutes, active, pricing_status,
                       display_order, dakshina_share_percent
                FROM services
                WHERE active = TRUE
                   OR COALESCE(pricing_status, 'priced') = 'awaiting_pricing'
                ORDER BY display_order NULLS LAST, name
                """
            )
        ).mappings().all()
    except Exception:
        db.rollback()
        rows = db.execute(
            text(
                """
                SELECT id, name, slug, description, category,
                       standard_price_paise, premium_price_paise,
                       duration_minutes, active
                FROM services
                WHERE active = TRUE
                ORDER BY name
                """
            )
        ).mappings().all()
    return [dict(r) for r in rows]


def _offer_sections(db: Session) -> list[dict]:
    try:
        from app.catalog import list_categories_public

        cats = list_categories_public(db)
        return [{"slug": c["slug"], "name": c["name"], "sort_order": c.get("sort_order", 0)} for c in cats]
    except Exception:
        db.rollback()
        return []


def _load_application_ids(db: Session, pujari_id: str) -> set[str]:
    rows = db.execute(
        text(
            """
            SELECT service_id::text AS service_id
            FROM pujari_service_applications
            WHERE pujari_id = CAST(:pid AS uuid)
            """
        ),
        {"pid": pujari_id},
    ).scalars().all()
    return {str(r) for r in rows}


def _load_verified_ids(db: Session, pujari_id: str) -> set[str]:
    rows = db.execute(
        text(
            """
            SELECT service_id::text AS service_id
            FROM pujari_verified_services
            WHERE pujari_id = CAST(:pid AS uuid)
            """
        ),
        {"pid": pujari_id},
    ).scalars().all()
    return {str(r) for r in rows}


def sync_specializations_from_verified(db: Session, pujari_id: str) -> None:
    names = db.execute(
        text(
            """
            SELECT s.name
            FROM pujari_verified_services v
            JOIN services s ON s.id = v.service_id
            WHERE v.pujari_id = CAST(:pid AS uuid)
            ORDER BY s.name
            """
        ),
        {"pid": pujari_id},
    ).scalars().all()
    db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET specializations = :specs
            WHERE user_id = CAST(:pid AS uuid)
            """
        ),
        {"specs": json.dumps(list(names)), "pid": pujari_id},
    )


def pujari_has_verified_service(db: Session, pujari_id: str, service_id: str) -> bool:
    ensure_service_tables(db)
    row = db.execute(
        text(
            """
            SELECT 1 FROM pujari_verified_services
            WHERE pujari_id = CAST(:pid AS uuid) AND service_id = CAST(:sid AS uuid)
            LIMIT 1
            """
        ),
        {"pid": pujari_id, "sid": service_id},
    ).first()
    return row is not None


def pujari_has_any_application(db: Session, pujari_id: str) -> bool:
    ensure_service_tables(db)
    row = db.execute(
        text(
            """
            SELECT 1 FROM pujari_service_applications
            WHERE pujari_id = CAST(:pid AS uuid)
            LIMIT 1
            """
        ),
        {"pid": pujari_id},
    ).first()
    return row is not None


def _service_row_payload(db: Session, s: dict, applied_ids: set[str]) -> dict:
    from app.catalog import service_categories

    sid = str(s["id"])
    base = catalog_base_price_paise(s)
    try:
        cats = service_categories(db, sid)
    except Exception:
        db.rollback()
        cats = []
    if not cats and s.get("category"):
        cats = [{"slug": str(s["category"]), "name": str(s["category"]).replace("_", " ").title()}]
    return {
        "id": sid,
        "name": s.get("name"),
        "slug": s.get("slug"),
        "short_description": s.get("short_description") or s.get("description"),
        "duration_minutes": s.get("duration_minutes"),
        "standard_price_paise": int(s.get("standard_price_paise") or 0),
        "catalog_price_paise": base if base > 0 else DEFAULT_CATALOG_BASE_PAISE,
        "dakshina_paise": dakshina_paise_for_service(db, s),
        "dakshina_share_percent": dakshina_share_percent(s),
        "applied": sid in applied_ids,
        "categories": cats,
        "section_slugs": [c.get("slug") for c in cats if c.get("slug")],
    }


def get_offers_payload(db: Session, pujari_id: str) -> dict:
    """Pujari-facing catalog — applied flag only (no approval status)."""
    ensure_service_tables(db)
    services = list_catalog_services_for_offers(db)
    sections = _offer_sections(db)
    applied_ids = _load_application_ids(db, pujari_id)
    out = [_service_row_payload(db, s, applied_ids) for s in services]
    applied_count = sum(1 for x in out if x["applied"])
    return {
        "share_percent": DEFAULT_DAKSHINA_SHARE_PERCENT,
        "sections": [{"slug": "all", "name": "All"}] + sections,
        "services": out,
        "applied_count": applied_count,
        "note": (
            "Browse catalog pujas and tap Apply for each service you can perform. "
            "Applied stays on your profile; BSeva Admin verifies separately before you receive bookings."
        ),
    }


def apply_for_service(db: Session, pujari_id: str, service_id: str, *, commit: bool = True) -> dict:
    ensure_service_tables(db)
    catalog = {str(s["id"]) for s in list_catalog_services_for_offers(db)}
    sid = str(service_id).strip()
    if sid not in catalog:
        raise HTTPException(400, "Unknown or inactive service")
    db.execute(
        text(
            """
            INSERT INTO pujari_service_applications (pujari_id, service_id, applied_at)
            VALUES (CAST(:pid AS uuid), CAST(:sid AS uuid), NOW())
            ON CONFLICT (pujari_id, service_id) DO NOTHING
            """
        ),
        {"pid": pujari_id, "sid": sid},
    )
    if commit:
        db.commit()
        return get_offers_payload(db, pujari_id)
    return {}


def submit_service_selection(db: Session, pujari_id: str, service_ids: list[str]) -> dict:
    """Bulk apply (add-only) — used by onboarding; never removes applications."""
    ensure_service_tables(db)
    catalog = {str(s["id"]) for s in list_catalog_services_for_offers(db)}
    for raw in service_ids or []:
        sid = str(raw).strip()
        if not sid or sid not in catalog:
            continue
        db.execute(
            text(
                """
                INSERT INTO pujari_service_applications (pujari_id, service_id, applied_at)
                VALUES (CAST(:pid AS uuid), CAST(:sid AS uuid), NOW())
                ON CONFLICT (pujari_id, service_id) DO NOTHING
                """
            ),
            {"pid": pujari_id, "sid": sid},
        )
    db.commit()
    return get_offers_payload(db, pujari_id)


def get_admin_services_payload(db: Session, pujari_id: str) -> dict:
    ensure_service_tables(db)
    services = list_catalog_services_for_offers(db)
    applied_ids = _load_application_ids(db, pujari_id)
    verified_ids = _load_verified_ids(db, pujari_id)
    catalog = []
    for s in services:
        row = _service_row_payload(db, s, applied_ids)
        row["verified"] = row["id"] in verified_ids
        catalog.append(row)
    applied_services = [x for x in catalog if x["applied"]]
    verified_services = [x for x in catalog if x["verified"]]
    pending_review = [x for x in catalog if x["applied"] and not x["verified"]]
    return {
        "share_percent": DEFAULT_DAKSHINA_SHARE_PERCENT,
        "sections": [{"slug": "all", "name": "All"}] + _offer_sections(db),
        "services": catalog,
        "applied_service_ids": sorted(applied_ids),
        "verified_service_ids": sorted(verified_ids),
        "applied_services": applied_services,
        "verified_services": verified_services,
        "pending_review_services": pending_review,
        "pending_review_count": len(pending_review),
        "verified_count": len(verified_services),
        "applied_count": len(applied_services),
    }


def pending_review_count(db: Session, pujari_id: str) -> int:
    ensure_service_tables(db)
    applied = _load_application_ids(db, pujari_id)
    verified = _load_verified_ids(db, pujari_id)
    return len(applied - verified)


def enrich_pujari_rows_with_service_counts(db: Session, rows: list[dict]) -> list[dict]:
    ensure_service_tables(db)
    out: list[dict] = []
    for r in rows:
        pid = str(r.get("id") or "")
        if not pid:
            out.append(r)
            continue
        applied = _load_application_ids(db, pid)
        verified = _load_verified_ids(db, pid)
        item = dict(r)
        item["applied_service_count"] = len(applied)
        item["verified_service_count"] = len(verified)
        item["pending_service_review_count"] = len(applied - verified)
        out.append(item)
    return out


def save_verified_services(db: Session, pujari_id: str, service_ids: list[str], admin_id: str) -> dict:
    ensure_service_tables(db)
    catalog = {str(s["id"]) for s in list_catalog_services_for_offers(db)}
    wanted: list[str] = []
    for raw in service_ids or []:
        sid = str(raw).strip()
        if sid and sid in catalog and sid not in wanted:
            wanted.append(sid)

    current = _load_verified_ids(db, pujari_id)
    wanted_set = set(wanted)
    to_remove = current - wanted_set
    to_add = wanted_set - current

    for sid in to_remove:
        db.execute(
            text(
                """
                DELETE FROM pujari_verified_services
                WHERE pujari_id = CAST(:pid AS uuid) AND service_id = CAST(:sid AS uuid)
                """
            ),
            {"pid": pujari_id, "sid": sid},
        )
    for sid in to_add:
        db.execute(
            text(
                """
                INSERT INTO pujari_verified_services (pujari_id, service_id, verified_at, verified_by)
                VALUES (CAST(:pid AS uuid), CAST(:sid AS uuid), NOW(), CAST(:aid AS uuid))
                ON CONFLICT (pujari_id, service_id) DO UPDATE
                  SET verified_at = NOW(), verified_by = CAST(:aid AS uuid)
                """
            ),
            {"pid": pujari_id, "sid": sid, "aid": admin_id},
        )

    sync_specializations_from_verified(db, pujari_id)
    db.commit()
    return get_admin_services_payload(db, pujari_id)


# --- Legacy admin helpers (map to verified list) ---


def revoke_service_offer(db: Session, pujari_id: str, service_id: str) -> dict:
    ensure_service_tables(db)
    db.execute(
        text(
            """
            DELETE FROM pujari_verified_services
            WHERE pujari_id = CAST(:pid AS uuid) AND service_id = CAST(:sid AS uuid)
            """
        ),
        {"pid": pujari_id, "sid": service_id},
    )
    sync_specializations_from_verified(db, pujari_id)
    db.commit()
    return get_admin_services_payload(db, pujari_id)


def apply_pending_offers(db: Session, pujari_id: str, admin_id: str) -> dict:
    """Legacy: approve all applications into verified list."""
    ensure_service_tables(db)
    applied = _load_application_ids(db, pujari_id)
    return save_verified_services(db, pujari_id, list(applied), admin_id)


def reject_pending_offers(db: Session, pujari_id: str, admin_id: str) -> dict:
    """Legacy no-op for applications; returns admin payload."""
    ensure_service_tables(db)
    return get_admin_services_payload(db, pujari_id)


def ensure_offers_table(db: Session) -> None:
    ensure_service_tables(db)
