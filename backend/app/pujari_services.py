"""Pujari catalog service offers — selection requires admin approval before going live."""
from __future__ import annotations

import json
import logging

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting

logger = logging.getLogger(__name__)

_OFFERS_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS pujari_service_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'pending_removal')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  UNIQUE (pujari_id, service_id)
)
"""


def ensure_offers_table(db: Session) -> None:
    """Create pujari_service_offers if missing (prod does not auto-migrate on cold start)."""
    try:
        db.execute(text("SELECT 1 FROM pujari_service_offers LIMIT 1"))
        return
    except Exception:
        db.rollback()
    try:
        db.execute(text(_OFFERS_TABLE_DDL))
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_pujari_service_offers_pujari ON pujari_service_offers (pujari_id)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_pujari_service_offers_status ON pujari_service_offers (status)"
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to ensure pujari_service_offers table")
        raise HTTPException(503, "Services catalog is not ready. Please try again in a moment.")


def dakshina_paise_for_service(db: Session, row: dict) -> int:
    """Estimated Dakshina from catalog main/standard price × pujari share %."""
    base = int(row.get("main_puja_price_paise") or row.get("standard_price_paise") or 0)
    if base <= 0:
        return 0
    share = float(get_setting(db, "pujari_share_percent", 85) or 85)
    return int(round(base * share / 100))


def list_catalog_services_for_offers(db: Session) -> list[dict]:
    """Active priced services pujaris can opt into (not drafts awaiting pricing)."""
    try:
        rows = db.execute(
            text(
                """
                SELECT id, name, slug, short_description, description,
                       basic_price_paise, standard_price_paise, premium_price_paise,
                       main_puja_price_paise, duration_minutes, active, pricing_status
                FROM services
                WHERE active = TRUE
                  AND standard_price_paise IS NOT NULL
                  AND COALESCE(pricing_status, 'priced') <> 'awaiting_pricing'
                ORDER BY display_order NULLS LAST, name
                """
            )
        ).mappings().all()
    except Exception:
        rows = db.execute(
            text(
                """
                SELECT id, name, slug, description, standard_price_paise, premium_price_paise,
                       duration_minutes, active
                FROM services
                WHERE active = TRUE
                ORDER BY name
                """
            )
        ).mappings().all()
    return [dict(r) for r in rows]


def sync_specializations_from_approved(db: Session, pujari_id: str) -> None:
    """Keep legacy specializations text in sync with approved catalog offers."""
    names = db.execute(
        text(
            """
            SELECT s.name
            FROM pujari_service_offers o
            JOIN services s ON s.id = o.service_id
            WHERE o.pujari_id = CAST(:pid AS uuid) AND o.status = 'approved'
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


def get_offers_payload(db: Session, pujari_id: str) -> dict:
    ensure_offers_table(db)
    services = list_catalog_services_for_offers(db)
    offer_rows = db.execute(
        text(
            """
            SELECT service_id::text AS service_id, status
            FROM pujari_service_offers
            WHERE pujari_id = CAST(:pid AS uuid)
            """
        ),
        {"pid": pujari_id},
    ).mappings().all()
    by_id = {str(r["service_id"]): r["status"] for r in offer_rows}
    share = float(get_setting(db, "pujari_share_percent", 85) or 85)
    out = []
    pending_count = 0
    approved_count = 0
    for s in services:
        sid = str(s["id"])
        status = by_id.get(sid) or "none"
        if status in ("pending", "pending_removal"):
            pending_count += 1
        if status == "approved":
            approved_count += 1
        base = int(s.get("main_puja_price_paise") or s.get("standard_price_paise") or 0)
        dakshina = dakshina_paise_for_service(db, s)
        out.append(
            {
                "id": sid,
                "name": s.get("name"),
                "slug": s.get("slug"),
                "short_description": s.get("short_description") or s.get("description"),
                "duration_minutes": s.get("duration_minutes"),
                "standard_price_paise": int(s.get("standard_price_paise") or 0),
                "basic_price_paise": s.get("basic_price_paise"),
                "premium_price_paise": s.get("premium_price_paise"),
                "main_puja_price_paise": s.get("main_puja_price_paise"),
                "catalog_price_paise": base,
                "dakshina_paise": dakshina,
                "status": status,
                # Checked in UI if currently offered or requested (not pending_removal)
                "selected": status in ("approved", "pending"),
            }
        )
    return {
        "share_percent": share,
        "services": out,
        "pending_count": pending_count,
        "approved_count": approved_count,
        "note": "Selecting or changing services requires Admin approval before they go live. You cannot create new pujas — choose from the BSeva catalog.",
    }


def submit_service_selection(db: Session, pujari_id: str, service_ids: list[str]) -> dict:
    ensure_offers_table(db)
    catalog = {str(s["id"]) for s in list_catalog_services_for_offers(db)}
    desired = []
    for raw in service_ids or []:
        sid = str(raw).strip()
        if not sid:
            continue
        if sid not in catalog:
            raise HTTPException(400, f"Unknown or inactive service: {sid}")
        if sid not in desired:
            desired.append(sid)
    desired_set = set(desired)

    existing = {
        str(r["service_id"]): r["status"]
        for r in db.execute(
            text(
                """
                SELECT service_id::text AS service_id, status
                FROM pujari_service_offers
                WHERE pujari_id = CAST(:pid AS uuid)
                """
            ),
            {"pid": pujari_id},
        ).mappings().all()
    }

    # Upsert desired services without auto-approving
    for sid in desired_set:
        cur = existing.get(sid)
        if cur == "approved":
            continue  # already live — no change
        if cur == "pending":
            continue
        # pending_removal / rejected / none → request again as pending
        db.execute(
            text(
                """
                INSERT INTO pujari_service_offers (pujari_id, service_id, status, requested_at)
                VALUES (CAST(:pid AS uuid), CAST(:sid AS uuid), 'pending', NOW())
                ON CONFLICT (pujari_id, service_id) DO UPDATE
                  SET status = 'pending',
                      requested_at = NOW(),
                      reviewed_at = NULL,
                      reviewed_by = NULL
                """
            ),
            {"pid": pujari_id, "sid": sid},
        )

    # Approved but unchecked → pending_removal (stays live until admin approves removal)
    for sid, status in existing.items():
        if sid in desired_set:
            continue
        if status == "approved":
            db.execute(
                text(
                    """
                    UPDATE pujari_service_offers
                    SET status = 'pending_removal', requested_at = NOW(), reviewed_at = NULL, reviewed_by = NULL
                    WHERE pujari_id = CAST(:pid AS uuid) AND service_id = CAST(:sid AS uuid)
                    """
                ),
                {"pid": pujari_id, "sid": sid},
            )
        elif status in ("pending", "rejected"):
            db.execute(
                text(
                    """
                    DELETE FROM pujari_service_offers
                    WHERE pujari_id = CAST(:pid AS uuid) AND service_id = CAST(:sid AS uuid)
                    """
                ),
                {"pid": pujari_id, "sid": sid},
            )

    db.commit()
    return get_offers_payload(db, pujari_id)


def apply_pending_offers(db: Session, pujari_id: str, admin_id: str) -> dict:
    """Admin: approve pending adds and removals."""
    ensure_offers_table(db)
    db.execute(
        text(
            """
            UPDATE pujari_service_offers
            SET status = 'approved', reviewed_at = NOW(), reviewed_by = CAST(:aid AS uuid)
            WHERE pujari_id = CAST(:pid AS uuid) AND status = 'pending'
            """
        ),
        {"pid": pujari_id, "aid": admin_id},
    )
    db.execute(
        text(
            """
            DELETE FROM pujari_service_offers
            WHERE pujari_id = CAST(:pid AS uuid) AND status = 'pending_removal'
            """
        ),
        {"pid": pujari_id},
    )
    sync_specializations_from_approved(db, pujari_id)
    db.commit()
    return get_offers_payload(db, pujari_id)


def reject_pending_offers(db: Session, pujari_id: str, admin_id: str) -> dict:
    """Admin: reject pending adds; cancel pending removals (keep approved)."""
    ensure_offers_table(db)
    db.execute(
        text(
            """
            UPDATE pujari_service_offers
            SET status = 'rejected', reviewed_at = NOW(), reviewed_by = CAST(:aid AS uuid)
            WHERE pujari_id = CAST(:pid AS uuid) AND status = 'pending'
            """
        ),
        {"pid": pujari_id, "aid": admin_id},
    )
    db.execute(
        text(
            """
            UPDATE pujari_service_offers
            SET status = 'approved', reviewed_at = NOW(), reviewed_by = CAST(:aid AS uuid)
            WHERE pujari_id = CAST(:pid AS uuid) AND status = 'pending_removal'
            """
        ),
        {"pid": pujari_id, "aid": admin_id},
    )
    db.commit()
    return get_offers_payload(db, pujari_id)
