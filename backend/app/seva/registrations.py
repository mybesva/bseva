from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import apply_wallet, row_dict
from app.seva.constants import (
    FAMILY_RELATIONSHIPS,
    PARTICIPATION_MODES,
    REGISTRATION_PARTICIPATION,
    SERVICE_TYPES,
)
from app.seva.helpers import ensure_join_token, get_event, next_registration_number, service_type_enabled, seva_enabled


class RegistrationError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _resolve_price(
    db: Session,
    event: dict[str, Any],
    package_id: str | None,
) -> tuple[int, dict[str, Any] | None]:
    if event.get("is_free"):
        return 0, None
    if package_id:
        pkg = db.execute(
            text(
                """
                SELECT * FROM service_packages
                WHERE id = CAST(:id AS uuid) AND service_id = CAST(:sid AS uuid) AND active = TRUE
                """
            ),
            {"id": package_id, "sid": event["service_id"]},
        ).mappings().first()
        if not pkg:
            raise RegistrationError("PACKAGE_NOT_FOUND", "Package not found", 404)
        return int(pkg["price_paise"]), dict(pkg)
    base = event.get("price_paise")
    if base is None:
        raise RegistrationError("PRICE_NOT_SET", "Event price is not configured", 400)
    return int(base), None


def _validate_participation(event: dict[str, Any], participation_mode: str) -> None:
    if participation_mode not in REGISTRATION_PARTICIPATION:
        raise RegistrationError("INVALID_PARTICIPATION", "Invalid participation mode")
    emode = str(event.get("participation_mode") or "offline")
    if participation_mode == "online" and emode == "offline":
        raise RegistrationError("ONLINE_NOT_AVAILABLE", "This event is offline only")
    if participation_mode == "offline" and emode == "online":
        raise RegistrationError("OFFLINE_NOT_AVAILABLE", "This event is online only")


def _validate_event_open(event: dict[str, Any]) -> None:
    if not event.get("published"):
        raise RegistrationError("EVENT_NOT_PUBLISHED", "Event is not published", 404)
    if event.get("status") == "cancelled":
        raise RegistrationError("EVENT_CANCELLED", "Event has been cancelled", 410)
    if event.get("sold_out"):
        raise RegistrationError("EVENT_SOLD_OUT", "Event is sold out", 409)
    cutoff = event.get("booking_cutoff_at")
    if cutoff:
        try:
            cutoff_dt = datetime.fromisoformat(str(cutoff).replace("Z", "+00:00"))
            if cutoff_dt <= datetime.now(timezone.utc):
                raise RegistrationError("CUTOFF_PASSED", "Registration cutoff has passed", 409)
        except RegistrationError:
            raise
        except Exception:
            pass
    if not event.get("registration_open") and event.get("status") not in ("published", "live"):
        raise RegistrationError("REGISTRATION_CLOSED", "Registration is closed", 409)


def create_registration(
    db: Session,
    *,
    customer_id: str,
    event_id: str,
    participation_mode: str = "offline",
    package_id: str | None = None,
    primary_name: str | None = None,
    gotra: str | None = None,
    gotra_unknown: bool = False,
    sankalp_text: str | None = None,
    family_members: list[dict[str, Any]] | None = None,
    prasad_address_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    if idempotency_key:
        existing = db.execute(
            text(
                """
                SELECT id FROM seva_event_registrations
                WHERE idempotency_key = :key AND customer_id = CAST(:cid AS uuid)
                """
            ),
            {"key": idempotency_key, "cid": customer_id},
        ).first()
        if existing:
            row = db.execute(
                text("SELECT * FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
                {"id": str(existing[0])},
            ).mappings().first()
            return row_dict(row)

    dup = db.execute(
        text(
            """
            SELECT id FROM seva_event_registrations
            WHERE event_id = CAST(:eid AS uuid) AND customer_id = CAST(:cid AS uuid)
              AND status NOT IN ('cancelled', 'refunded')
            """
        ),
        {"eid": event_id, "cid": customer_id},
    ).first()
    if dup:
        raise RegistrationError("DUPLICATE_REGISTRATION", "You are already registered for this event", 409)

    if not seva_enabled(db):
        raise RegistrationError("SEVA_DISABLED", "Seva events are temporarily unavailable", 503)

    event = get_event(db, event_id, published_only=True)
    if not event:
        raise RegistrationError("EVENT_NOT_FOUND", "Event not found", 404)

    if not service_type_enabled(db, str(event.get("service_type") or "puja")):
        raise RegistrationError("SERVICE_TYPE_DISABLED", "This seva line is unavailable", 503)

    _validate_event_open(event)
    _validate_participation(event, participation_mode)

    service_type = str(event.get("service_type") or "puja")
    if service_type not in SERVICE_TYPES:
        raise RegistrationError("INVALID_SERVICE_TYPE", "Invalid service type")

    amount, pkg = _resolve_price(db, event, package_id)
    payment_status = "free" if amount == 0 else "pending"
    reg_status = "confirmed"

    if amount > 0:
        try:
            apply_wallet(
                db,
                customer_id,
                -amount,
                "debit",
                f"Seva event registration — {event.get('title') or event.get('service_name')}",
                reference=next_registration_number(db),
            )
            payment_status = "paid"
        except ValueError as exc:
            raise RegistrationError("INSUFFICIENT_WALLET", str(exc), 402) from exc

    reg_id = str(uuid4())
    reg_number = next_registration_number(db)
    members = family_members or []
    for m in members:
        rel = str(m.get("relationship") or "other")
        if rel not in FAMILY_RELATIONSHIPS:
            raise RegistrationError("INVALID_RELATIONSHIP", f"Invalid relationship: {rel}")

    db.execute(
        text(
            """
            INSERT INTO seva_event_registrations (
              id, registration_number, event_id, customer_id, service_type, status, payment_status,
              total_amount_paise, package_id, package_slug, package_name, participation_mode,
              primary_name, gotra, gotra_unknown, sankalp_text, family_members, prasad_address_id,
              prasad_status, idempotency_key
            ) VALUES (
              CAST(:id AS uuid), :num, CAST(:eid AS uuid), CAST(:cid AS uuid), :stype, :status, :pay,
              :amt, CAST(:pkg_id AS uuid), :pkg_slug, :pkg_name, :pmode,
              :pname, :gotra, :gotra_unknown, :sankalp, CAST(:members AS jsonb), CAST(:addr AS uuid),
              :prasad_status, :idem
            )
            """
        ),
        {
            "id": reg_id,
            "num": reg_number,
            "eid": event_id,
            "cid": customer_id,
            "stype": service_type,
            "status": reg_status,
            "pay": payment_status,
            "amt": amount,
            "pkg_id": str(pkg["id"]) if pkg else None,
            "pkg_slug": pkg.get("slug") if pkg else None,
            "pkg_name": pkg.get("name") if pkg else None,
            "pmode": participation_mode,
            "pname": (primary_name or "").strip() or None,
            "gotra": None if gotra_unknown else ((gotra or "").strip() or None),
            "gotra_unknown": bool(gotra_unknown),
            "sankalp": (sankalp_text or "").strip() or None,
            "members": __import__("json").dumps(members),
            "addr": prasad_address_id,
            "prasad_status": "not_applicable" if not (pkg and pkg.get("prasad_included")) else "preparing",
            "idem": idempotency_key,
        },
    )

    db.execute(
        text(
            """
            UPDATE seva_events
            SET registration_count = registration_count + 1, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": event_id},
    )

    needs_online = participation_mode == "online" or str(event.get("participation_mode")) in ("online", "hybrid")
    if needs_online and event.get("online_enabled"):
        ensure_join_token(db, reg_id)

    row = db.execute(
        text("SELECT * FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
        {"id": reg_id},
    ).mappings().first()
    return row_dict(row)


def cancel_registration(db: Session, *, registration_id: str, customer_id: str) -> dict[str, Any]:
    row = db.execute(
        text(
            """
            SELECT * FROM seva_event_registrations
            WHERE id = CAST(:id AS uuid) AND customer_id = CAST(:cid AS uuid)
            """
        ),
        {"id": registration_id, "cid": customer_id},
    ).mappings().first()
    if not row:
        raise RegistrationError("NOT_FOUND", "Registration not found", 404)
    if row["status"] in ("cancelled", "refunded", "completed"):
        raise RegistrationError("ALREADY_FINAL", "Registration cannot be cancelled", 409)

    event = get_event(db, str(row["event_id"]), published_only=False)
    if event:
        _validate_participation(event, str(row.get("participation_mode") or "offline"))

    amount = int(row.get("total_amount_paise") or 0)
    if amount > 0 and row.get("payment_status") == "paid":
        apply_wallet(
            db,
            customer_id,
            amount,
            "credit",
            f"Refund — cancelled registration {row.get('registration_number')}",
            reference=str(row.get("registration_number")),
        )

    db.execute(
        text(
            """
            UPDATE seva_event_registrations
            SET status = 'cancelled', payment_status = CASE WHEN :paid THEN 'refunded' ELSE payment_status END,
                cancelled_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": registration_id, "paid": row.get("payment_status") == "paid"},
    )
    db.execute(
        text(
            """
            UPDATE seva_events
            SET registration_count = GREATEST(0, registration_count - 1), updated_at = NOW()
            WHERE id = CAST(:eid AS uuid)
            """
        ),
        {"eid": str(row["event_id"])},
    )
    updated = db.execute(
        text("SELECT * FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
        {"id": registration_id},
    ).mappings().first()
    return row_dict(updated)


def registration_can_join(db: Session, registration: dict[str, Any], event: dict[str, Any]) -> tuple[bool, str | None]:
    if not seva_enabled(db):
        return False, "Seva events are temporarily unavailable"
    if str(event.get("status") or "") == "cancelled":
        return False, "This event has been cancelled"
    if not service_type_enabled(db, str(event.get("service_type") or "puja")):
        return False, "This seva line is unavailable"
    if registration.get("status") not in ("confirmed", "completed"):
        return False, "Registration is not active"
    if registration.get("status") in ("cancelled", "refunded"):
        return False, "Registration is no longer active"
    if registration.get("payment_status") not in ("paid", "free"):
        return False, "Payment required"
    if not event.get("online_enabled"):
        return False, "Online joining is not enabled"
    pmode = str(registration.get("participation_mode") or "offline")
    if pmode != "online" and str(event.get("participation_mode")) != "online":
        if str(event.get("participation_mode")) == "hybrid" and pmode == "offline":
            return False, "You registered for in-person attendance"
    now = datetime.now(timezone.utc)
    start = event.get("start_at")
    try:
        start_dt = datetime.fromisoformat(str(start).replace("Z", "+00:00")) if start else None
    except Exception:
        start_dt = None
    if start_dt:
        from datetime import timedelta

        join_from = start_dt - timedelta(minutes=30)
        if now < join_from:
            return False, "Join will be available 30 minutes before start"
    return True, None
