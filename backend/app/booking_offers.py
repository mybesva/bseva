"""Broadcast paid bookings to eligible pujaris within service radius; first accept wins."""
from __future__ import annotations

import logging
from datetime import date, time
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import (
    SERVICE_RADIUS_KM,
    _eligible_pujari_location_rows,
    haversine_km,
    pujari_free_for_slot,
    row_dict,
)

logger = logging.getLogger(__name__)

_OFFER_ACTIVE = ("invited",)
_OFFER_TERMINAL = ("accepted", "rejected", "withdrawn", "expired")

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS booking_pujari_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited',
  distance_km DOUBLE PRECISION,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  rejection_reason TEXT,
  UNIQUE (booking_id, pujari_id)
)
"""


def ensure_offers_table(db: Session) -> None:
    try:
        db.execute(text("SELECT 1 FROM booking_pujari_offers LIMIT 1"))
        return
    except Exception:
        pass
    try:
        db.execute(text(_CREATE_TABLE))
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_booking_pujari_offers_pujari "
                "ON booking_pujari_offers (pujari_id, status)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_booking_pujari_offers_booking "
                "ON booking_pujari_offers (booking_id, status)"
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to ensure booking_pujari_offers table")


def eligible_pujaris_for_booking(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    required_level: int,
    booking_date: date,
    start_time: time,
    end_time: time,
    service_id: str | None = None,
    radius_km: float = SERVICE_RADIUS_KM,
) -> list[tuple[str, float]]:
    """Return (pujari_user_id, distance_km) sorted nearest first."""
    ensure_offers_table(db)
    rows = _eligible_pujari_location_rows(db, required_level)
    out: list[tuple[str, float]] = []
    for r in rows:
        if r.get("latitude") is None or r.get("longitude") is None:
            continue
        complete = db.execute(
            text("SELECT COALESCE(profile_complete, FALSE) FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
            {"id": str(r["id"])},
        ).scalar()
        if not complete:
            continue
        dist = haversine_km(latitude, longitude, float(r["latitude"]), float(r["longitude"]))
        effective = min(radius_km, float(r["service_radius_km"] or radius_km))
        if dist > effective:
            continue
        if not pujari_free_for_slot(
            db, str(r["id"]), booking_date, start_time, end_time, service_id
        ):
            continue
        if service_id:
            from app.pujari_services import pujari_has_verified_service

            if not pujari_has_verified_service(db, str(r["id"]), str(service_id)):
                continue
        out.append((str(r["id"]), round(dist, 2)))
    out.sort(key=lambda x: x[1])
    return out


def refresh_offers_for_open_bookings(
    db: Session,
    *,
    booking_date: date | None = None,
    customer_id: str | None = None,
) -> list[str]:
    """Re-run offer invites after schedule changes (e.g. another puja was just accepted).

    Inserts new rows only (ON CONFLICT DO NOTHING). Returns newly notified pujari ids.
    """
    ensure_offers_table(db)
    q = """
        SELECT id FROM bookings
        WHERE pujari_id IS NULL
          AND payment_status = 'paid'
          AND status IN ('pending', 'pending_acceptance')
    """
    params: dict = {}
    if booking_date is not None:
        q += " AND booking_date = :d"
        params["d"] = booking_date
    if customer_id is not None:
        q += " AND customer_id = CAST(:cid AS uuid)"
        params["cid"] = customer_id
    ids = [str(r[0]) for r in db.execute(text(q), params).all()]
    invited: list[str] = []
    for bid in ids:
        invited.extend(create_offers_for_booking(db, bid))
    return invited


def create_offers_for_booking(db: Session, booking_id: str) -> list[str]:
    """Invite all eligible nearby pujaris. Returns list of notified pujari ids."""
    ensure_offers_table(db)
    b = db.execute(
        text(
            """
            SELECT b.*, s.required_level
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            WHERE b.id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if not b:
        return []
    if b.get("pujari_id"):
        return []
    if b.get("payment_status") != "paid":
        return []
    lat, lng = b.get("latitude"), b.get("longitude")
    if lat is None or lng is None:
        return []

    candidates = eligible_pujaris_for_booking(
        db,
        latitude=float(lat),
        longitude=float(lng),
        required_level=int(b["required_level"] or 1),
        booking_date=b["booking_date"],
        start_time=b["start_time"],
        end_time=b["end_time"],
        service_id=str(b["service_id"]),
    )
    invited: list[str] = []
    for pid, dist in candidates:
        ins = db.execute(
            text(
                """
                INSERT INTO booking_pujari_offers (id, booking_id, pujari_id, status, distance_km)
                VALUES (CAST(:id AS uuid), CAST(:bid AS uuid), CAST(:pid AS uuid), 'invited', :dist)
                ON CONFLICT (booking_id, pujari_id) DO NOTHING
                RETURNING pujari_id
                """
            ),
            {"id": str(uuid4()), "bid": booking_id, "pid": pid, "dist": dist},
        ).first()
        if ins:
            invited.append(pid)
    return invited


def pujari_invited_offer(db: Session, booking_id: str, pujari_id: str) -> dict | None:
    ensure_offers_table(db)
    row = db.execute(
        text(
            """
            SELECT * FROM booking_pujari_offers
            WHERE booking_id = CAST(:bid AS uuid)
              AND pujari_id = CAST(:pid AS uuid)
              AND status = 'invited'
            """
        ),
        {"bid": booking_id, "pid": pujari_id},
    ).mappings().first()
    return row_dict(row) if row else None


def withdraw_open_offers(
    db: Session,
    booking_id: str,
    *,
    except_pujari_id: str | None = None,
    mark_accepted_for: str | None = None,
) -> None:
    ensure_offers_table(db)
    if mark_accepted_for:
        db.execute(
            text(
                """
                UPDATE booking_pujari_offers
                SET status = 'accepted', responded_at = NOW()
                WHERE booking_id = CAST(:bid AS uuid) AND pujari_id = CAST(:pid AS uuid)
                """
            ),
            {"bid": booking_id, "pid": mark_accepted_for},
        )
    if except_pujari_id:
        db.execute(
            text(
                """
                UPDATE booking_pujari_offers
                SET status = 'withdrawn', responded_at = COALESCE(responded_at, NOW())
                WHERE booking_id = CAST(:bid AS uuid)
                  AND status = 'invited'
                  AND pujari_id != CAST(:except AS uuid)
                """
            ),
            {"bid": booking_id, "except": except_pujari_id},
        )
    else:
        db.execute(
            text(
                """
                UPDATE booking_pujari_offers
                SET status = 'withdrawn', responded_at = COALESCE(responded_at, NOW())
                WHERE booking_id = CAST(:bid AS uuid)
                  AND status = 'invited'
                """
            ),
            {"bid": booking_id},
        )


def reject_offer(db: Session, booking_id: str, pujari_id: str, reason: str | None) -> bool:
    ensure_offers_table(db)
    row = db.execute(
        text(
            """
            UPDATE booking_pujari_offers
            SET status = 'rejected', responded_at = NOW(), rejection_reason = :reason
            WHERE booking_id = CAST(:bid AS uuid)
              AND pujari_id = CAST(:pid AS uuid)
              AND status = 'invited'
            RETURNING id
            """
        ),
        {"bid": booking_id, "pid": pujari_id, "reason": reason},
    ).first()
    return row is not None


def count_invited_offers(db: Session, booking_id: str) -> int:
    ensure_offers_table(db)
    return int(
        db.execute(
            text(
                """
                SELECT COUNT(*) FROM booking_pujari_offers
                WHERE booking_id = CAST(:bid AS uuid) AND status = 'invited'
                """
            ),
            {"bid": booking_id},
        ).scalar()
        or 0
    )


def notify_pujaris_new_offer(
    db: Session,
    *,
    pujari_ids: list[str],
    booking_number: str,
    service_name: str,
) -> None:
    if not pujari_ids:
        return
    try:
        from app.routers.notifications import create_notification
    except Exception:
        return
    body = f"New {service_name or 'puja'} request ({booking_number}) near you — accept or decline in Bookings."
    for pid in pujari_ids:
        try:
            create_notification(
                db,
                user_id=pid,
                title="New booking request",
                body=body,
                category="booking",
                link="/pujari/bookings",
            )
        except Exception:
            continue
