"""What happens once a booking is paid, recorded durably so a crash or error can never lose it.

Shared by the wallet path (paid inside POST /bookings) and the gateway path (paid when a verified Cashfree
payment arrives by webhook, client return or the reconciler).

`finalized_at` is claimed with a conditional UPDATE, so the work is planned once per booking. Planning writes
one `booking_side_effects` row per task in the same transaction that makes the booking paid:

  meeting       Google Meet link + invite (virtual puja with a pujari)
  preparation   frozen Samagri / preparation snapshot
  offers        invitations to eligible nearby pujaris, and their "new request" notifications
  notifications customer "Booking Created", ops alerts, the chosen pujari's request
  confirmation_email, invoice   after commit (they call mail / PDF services)

Each task runs in a savepoint and is marked done in that same savepoint, so its database writes and its
"done" mark commit together: a task runs once, or not at all and stays pending. Failures are recorded with
back-off and retried by the payments worker (`run_due_side_effects`); after MAX_ATTEMPTS a task is marked
failed for Super Admin review. Rows are claimed FOR UPDATE SKIP LOCKED, so two workers never run one task.
External sends (push inside create_notification, email) are at-least-once: a crash after the send but before
the commit can repeat that one message, never the database rows.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

IN_TRANSACTION = ("meeting", "preparation", "offers", "notifications")
AFTER_COMMIT = ("confirmation_email", "invoice")
MAX_ATTEMPTS = 8
# Tasks that must wait for another task's result.
DEPENDS_ON = {"notifications": ("meeting", "offers"), "confirmation_email": ("preparation",), "invoice": ()}


class Deferred(Exception):
    """A dependency is not done yet: retry later without counting an attempt."""


def claim_finalize(db: Session, booking_id: str) -> bool:
    return (
        db.execute(
            text(
                """
                UPDATE bookings SET finalized_at = NOW()
                WHERE id = CAST(:id AS uuid) AND finalized_at IS NULL AND payment_status = 'paid'
                RETURNING id
                """
            ),
            {"id": booking_id},
        ).first()
        is not None
    )


def _booking(db: Session, booking_id: str) -> dict:
    return dict(db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().one())


def _service(db: Session, b: dict) -> dict:
    return dict(db.execute(text("SELECT * FROM services WHERE id = CAST(:id AS uuid)"), {"id": str(b["service_id"])}).mappings().one())


def planned_effects(b: dict) -> list[str]:
    has_pujari = b.get("pujari_id") is not None
    virtual = str(b.get("mode") or "") == "virtual"
    out = []
    if virtual and has_pujari:
        out.append("meeting")
    out.append("preparation")
    if not has_pujari and not virtual:
        out.append("offers")
    return out + ["notifications", "confirmation_email", "invoice"]


# ---------------------------------------------------------------- task handlers (no error swallowing)


def _do_meeting(db: Session, b: dict) -> dict:
    from app.meetings.service import ensure_virtual_meeting

    svc = _service(db, b)
    emails = db.execute(
        text(
            """
            SELECT (SELECT email FROM users WHERE id = CAST(:c AS uuid)) AS customer_email,
                   (SELECT email FROM users WHERE id = CAST(:p AS uuid)) AS pujari_email
            """
        ),
        {"c": str(b["customer_id"]), "p": str(b["pujari_id"])},
    ).mappings().one()
    info = ensure_virtual_meeting(
        db,
        {
            "id": str(b["id"]), "booking_number": b["booking_number"], "mode": "virtual", "booking_date": b["booking_date"],
            "start_time": b["start_time"], "end_time": b["end_time"], "meeting_url": None, "meeting_invite_token": None,
            "google_calendar_event_id": None,
        },
        service_name=str(svc.get("name") or "Virtual Puja"),
        customer_email=str(emails.get("customer_email") or ""),
        pujari_email=str(emails.get("pujari_email") or ""),
        duration_minutes=int(svc.get("duration_minutes") or 90),
        send_google_invites=True,
    )
    return {"meeting_url": info.get("meeting_url"), "public_invite_url": info.get("public_invite_url")}


def _do_preparation(db: Session, b: dict) -> dict:
    from app.preparation import create_booking_preparation_snapshot

    view = create_booking_preparation_snapshot(
        db, booking_id=str(b["id"]), booking=b, service_id=str(b["service_id"]), customer_id=str(b["customer_id"])
    )
    return {"display_name": (view or {}).get("display_name")}


def _do_offers(db: Session, b: dict) -> dict:
    from app.booking_offers import create_offers_for_booking, notify_pujaris_new_offer

    # Only pujaris inserted now are returned (ON CONFLICT DO NOTHING), so a retry never re-notifies anyone.
    invited = create_offers_for_booking(db, str(b["id"]))
    if not invited:
        logger.warning("booking_no_pujari_offers booking=%s number=%s date=%s", b["id"], b["booking_number"], b["booking_date"])
    else:
        svc = _service(db, b)
        notify_pujaris_new_offer(
            db, pujari_ids=invited, booking_id=str(b["id"]), booking_number=str(b["booking_number"]),
            service_name=str(svc.get("name") or "Puja"), service_id=str(b["service_id"]),
        )
    return {"invited_pujari_ids": invited}


def _do_notifications(db: Session, b: dict) -> dict:
    from app.routers.notifications import create_notification, customer_booking_link, notify_ops_staff, pujari_booking_link

    svc = _service(db, b)
    bid, number = str(b["id"]), str(b["booking_number"])
    virtual = str(b.get("mode") or "") == "virtual"
    create_notification(
        db,
        user_id=str(b["customer_id"]),
        title="Booking Created",
        body=f"Your booking {number} is confirmed. We will update you as it progresses.",
        category="booking",
        link=customer_booking_link(bid),
        extra_data={"booking_id": bid},
        message_key="bookingCreated",
        message_vars={"number": number},
    )
    notify_ops_staff(
        db,
        title="New Virtual Puja Booking" if virtual else "New Booking",
        body=f"{number} — {svc.get('name') or 'Puja'} on {b['booking_date']} ({b['mode']}).",
        category="booking",
        link="/admin/virtual-puja" if virtual else "/admin/bookings",
    )
    if b.get("pujari_id"):
        create_notification(
            db,
            user_id=str(b["pujari_id"]),
            title="New Booking Request",
            body=f"New booking {number} awaiting your acceptance.",
            category="booking",
            link=pujari_booking_link(bid),
            extra_data={"booking_id": bid},
            message_key="awaiting",
            message_vars={"number": number},
        )
    elif virtual:
        notify_ops_staff(
            db,
            title="Virtual Puja Needs Pujari Assignment",
            body=f"{number} — assign a pujari using India time for this Virtual Puja.",
            category="booking",
            link="/admin/virtual-puja",
        )
    else:
        offers = db.execute(
            text("SELECT COUNT(*) FROM booking_pujari_offers WHERE booking_id = CAST(:id AS uuid)"), {"id": bid}
        ).scalar()
        if not offers:
            notify_ops_staff(
                db,
                title="Booking Needs Pujari Assignment",
                body=f"{number} — {svc.get('name') or 'Puja'} on {b['booking_date']}. No eligible pujari in range — assign manually.",
                category="booking",
                link="/admin/bookings?status=needs_reassignment",
            )
    return {}


def confirmation_email_payload(db: Session, b: dict) -> dict | None:
    from app.platform_config import get_setting
    from app.preparation import customer_preferred_language, get_booking_preparation

    cust = db.execute(
        text("SELECT email, name FROM users WHERE id = CAST(:id AS uuid)"), {"id": str(b["customer_id"])}
    ).mappings().first()
    if not cust or not cust.get("email"):
        return None
    svc = _service(db, b)
    prep = get_booking_preparation(db, str(b["id"])) or {}
    return {
        "to": str(cust["email"]),
        "customer_name": str(cust.get("name") or ""),
        "booking_number": str(b["booking_number"]),
        "booking_id": str(b["id"]),
        "service_name": str(prep.get("display_name") or svc.get("name") or "Puja"),
        "booking_date": str(b["booking_date"]),
        "start_time": str(b["start_time"]),
        "preparation": prep,
        "language": customer_preferred_language(db, str(b["customer_id"])),
        "from_addr": str(get_setting(db, "email_from_accounts", "admin@b-seva.com")),
        "package": str(b.get("package_type") or ""),
        "location": str(b.get("location_label") or b.get("address") or ""),
        "main_puja_paise": int(b.get("main_puja_charge_paise") or b.get("base_price_paise") or 0),
        "samagri_paise": int(b.get("samagri_charge_paise") or 0),
        "alankaram_paise": int(b.get("alankaram_charge_paise") or 0),
        "food_prasadam_paise": int(b.get("food_charge_paise") or 0),
        "total_paise": int(b.get("total_paise") or 0),
        "payment_status": "paid",
        "booking_status": "confirmed",
    }


def _do_confirmation_email(db: Session, b: dict) -> dict:
    from app.email_service import send_booking_preparation_email

    payload = confirmation_email_payload(db, b)
    if not payload:
        return {"status": "no_email_address"}
    result = send_booking_preparation_email(**payload) or {}
    if result.get("ok") is False:
        raise RuntimeError(f"email {result.get('status')}: {result.get('error') or 'send failed'}")
    return {"status": result.get("status") or "sent"}


def _do_invoice(db: Session, b: dict) -> dict:
    from app.invoice_docs import _ensure_invoice_schema, create_customer_invoice, email_customer_invoice

    _ensure_invoice_schema(db)
    # Idempotent: returns the existing customer invoice number when one was already issued.
    number = create_customer_invoice(db, booking=b, user_id=str(b["customer_id"]))
    if not number:
        raise RuntimeError("invoice not issued")
    emailed = email_customer_invoice(db, booking_id=str(b["id"])) or {}
    return {"invoice_number": number, "emailed": bool(emailed.get("ok"))}


HANDLERS: dict[str, Callable[[Session, dict], dict]] = {
    "meeting": _do_meeting,
    "preparation": _do_preparation,
    "offers": _do_offers,
    "notifications": _do_notifications,
    "confirmation_email": _do_confirmation_email,
    "invoice": _do_invoice,
}


# ---------------------------------------------------------------- task runner


def _backoff_minutes(attempts: int) -> int:
    return min(240, 2 ** max(0, attempts - 1))


def _notify_failed(db: Session, booking_id: str, effect: str, error: str) -> None:
    try:
        from app.routers.notifications import notify_ops_staff

        number = db.execute(text("SELECT booking_number FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).scalar()
        notify_ops_staff(
            db,
            title="Booking follow-up failed",
            body=f"{number}: '{effect}' failed {MAX_ATTEMPTS} times ({error[:120]}). Retry it from Payments.",
            category="booking",
            link="/admin/payments",
        )
    except Exception:
        logger.exception("side_effect_failure_notice_failed booking=%s", booking_id)


def run_effect(db: Session, booking_id: str, effect: str) -> dict | None:
    """Run one pending task inside the caller's transaction (caller commits). Returns its result when it ran
    now; None when it is already done, claimed elsewhere, waiting on a dependency, or failed this time."""
    row = db.execute(
        text(
            """
            SELECT * FROM booking_side_effects
            WHERE booking_id = CAST(:b AS uuid) AND effect = :e AND status = 'pending'
            FOR UPDATE SKIP LOCKED
            """
        ),
        {"b": booking_id, "e": effect},
    ).mappings().first()
    if not row:
        return None
    try:
        waiting = [
            d for d in DEPENDS_ON.get(effect, ())
            if db.execute(
                text("SELECT 1 FROM booking_side_effects WHERE booking_id = CAST(:b AS uuid) AND effect = :e AND status = 'pending'"),
                {"b": booking_id, "e": d},
            ).first()
        ]
        if waiting:
            raise Deferred(f"waiting for {', '.join(waiting)}")
        with db.begin_nested():
            b = _booking(db, booking_id)
            if b["payment_status"] not in ("paid", "refund_pending", "refunded", "partial_refund"):
                result: dict = {"skipped": f"booking {b['payment_status']}"}
            else:
                result = HANDLERS[effect](db, b) or {}
            db.execute(
                text(
                    """
                    UPDATE booking_side_effects SET status = 'done', attempts = attempts + 1, done_at = NOW(),
                      result = CAST(:r AS jsonb), last_error = NULL, updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"r": json.dumps(result, default=str), "id": row["id"]},
            )
        return result
    except Deferred as d:
        db.execute(
            text(
                """
                UPDATE booking_side_effects SET next_attempt_at = NOW() + INTERVAL '1 minute', last_error = :e,
                  updated_at = NOW() WHERE id = :id
                """
            ),
            {"e": str(d), "id": row["id"]},
        )
        return None
    except Exception as e:
        attempts = int(row["attempts"]) + 1
        failed = attempts >= MAX_ATTEMPTS
        logger.exception("booking_side_effect_failed booking=%s effect=%s attempt=%s", booking_id, effect, attempts)
        db.execute(
            text(
                """
                UPDATE booking_side_effects SET attempts = :n, last_error = :e, updated_at = NOW(),
                  status = CASE WHEN :failed THEN 'failed' ELSE 'pending' END,
                  next_attempt_at = NOW() + make_interval(mins => :mins)
                WHERE id = :id
                """
            ),
            {"n": attempts, "e": f"{type(e).__name__}: {e}"[:500], "failed": failed,
             "mins": _backoff_minutes(attempts), "id": row["id"]},
        )
        if failed:
            _notify_failed(db, booking_id, effect, str(e))
        return None


def finalize_paid_booking(db: Session, booking_id: str) -> dict[str, Any] | None:
    """Plan the post-payment tasks once and run the in-transaction ones now. Returns None when another caller
    already finalized this booking. The caller commits, then calls post_commit_side_effects."""
    if not claim_finalize(db, booking_id):
        return None
    b = _booking(db, booking_id)
    for effect in planned_effects(b):
        db.execute(
            text(
                """
                INSERT INTO booking_side_effects (booking_id, effect) VALUES (CAST(:b AS uuid), :e)
                ON CONFLICT (booking_id, effect) DO NOTHING
                """
            ),
            {"b": booking_id, "e": effect},
        )
    results: dict[str, dict] = {}
    for effect in IN_TRANSACTION:
        out = run_effect(db, booking_id, effect)
        if out is not None:
            results[effect] = out
    svc = _service(db, b)
    return {
        "meeting_url": (results.get("meeting") or {}).get("meeting_url") or b.get("meeting_url"),
        "public_invite_url": (results.get("meeting") or {}).get("public_invite_url"),
        "invited_pujari_ids": (results.get("offers") or {}).get("invited_pujari_ids") or [],
        "email_queued": True,
        "duration_minutes": int(svc.get("duration_minutes") or 90),
    }


def post_commit_side_effects(booking_id: str, _legacy_payload: Any = None) -> None:
    """Confirmation email + invoice after the paid booking is committed, each claimed and marked durably.
    Never raises; anything not done here is retried by the payments worker."""
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        for effect in AFTER_COMMIT:
            try:
                run_effect(db, booking_id, effect)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("post_commit_side_effect_failed booking=%s effect=%s", booking_id, effect)
    finally:
        db.close()


def run_due_side_effects(db: Session, *, limit: int = 50) -> dict:
    """Worker: retry pending tasks whose back-off has passed, one transaction each. Commits."""
    rows = db.execute(
        text(
            """
            SELECT booking_id, effect FROM booking_side_effects
            WHERE status = 'pending' AND next_attempt_at <= NOW()
              AND created_at < NOW() - INTERVAL '30 seconds'
            ORDER BY next_attempt_at LIMIT :lim
            """
        ),
        {"lim": limit},
    ).all()
    db.commit()
    counts = {"ran": 0, "not_now": 0}
    for booking_id, effect in rows:
        try:
            out = run_effect(db, str(booking_id), str(effect))
            db.commit()
            counts["ran" if out is not None else "not_now"] += 1
        except Exception:
            db.rollback()
            logger.exception("side_effect_worker_failed booking=%s effect=%s", booking_id, effect)
    return counts


def booking_start_utc(b: dict) -> datetime:
    if b.get("start_at_utc"):
        return b["start_at_utc"].replace(tzinfo=None)
    # In-person times are India time.
    return datetime.combine(b["booking_date"], b["start_time"]) - timedelta(hours=5, minutes=30)
