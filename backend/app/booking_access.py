"""Resolve a booking reference and decide whether a pujari may accept or reject it."""
from __future__ import annotations

import re

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def is_uuid(value: str | None) -> bool:
    return bool(_UUID.match(str(value or "").strip()))


def same_id(left, right) -> bool:
    a = str(left or "").strip().lower().replace("-", "")
    b = str(right or "").strip().lower().replace("-", "")
    return bool(a) and a == b


def load_puja_booking(db: Session, booking_ref: str) -> dict | None:
    """Load a puja booking by UUID or booking number. Invalid UUIDs are not cast."""
    key = str(booking_ref or "").strip()
    if not key:
        return None
    if is_uuid(key):
        row = db.execute(
            text(
                """
                SELECT * FROM bookings
                WHERE id = CAST(:id AS uuid)
                  AND COALESCE(booking_kind, 'puja') = 'puja'
                """
            ),
            {"id": key},
        ).mappings().first()
        if row:
            return dict(row)
    row = db.execute(
        text(
            """
            SELECT * FROM bookings
            WHERE upper(booking_number) = upper(:num)
              AND COALESCE(booking_kind, 'puja') = 'puja'
            """
        ),
        {"num": key},
    ).mappings().first()
    return dict(row) if row else None


def accept_denied(assigned: bool, owner_id, actor_id: str) -> str | None:
    """Assigned pujaris, and unassigned bookings they can already open, may accept.

    A different assigned pujari is a conflict. Visibility is checked separately.
    """
    if assigned or same_id(owner_id, actor_id):
        return None
    if owner_id:
        return "Another pujari already accepted this booking"
    return None


def prepare_pujari_booking_action(db: Session, booking_ref: str, user: dict) -> tuple[dict, str]:
    """Return the booking row and canonical id when this pujari may open it.

    Accept and reject use the same visibility rule as booking details, then lock
    the row by its real UUID. Booking numbers are resolved before any UUID cast.
    """
    from app.booking_visibility import booking_for_role

    loaded = load_puja_booking(db, booking_ref)
    if not loaded:
        raise HTTPException(404, "Booking not found")
    bid = str(loaded["id"])
    try:
        booking_for_role(db, dict(loaded), user)
    except PermissionError:
        raise HTTPException(403, "Not allowed") from None
    locked = db.execute(
        text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"),
        {"id": bid},
    ).mappings().first()
    if not locked:
        raise HTTPException(404, "Booking not found")
    return dict(locked), bid
