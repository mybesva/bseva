"""Gateway payments for puja bookings: checkout, verification, expiry, late payments and refunds.

Rules this module keeps:
- Amounts and currency come from the booking the server priced. A provider payment is accepted only when its
  amount and currency equal the payment row; anything else is held for manual review and never confirms.
- A booking is confirmed only from provider state fetched server-side (webhook payloads are never trusted).
- Every state change locks the payment row, then the booking row, so webhooks, client returns and the
  reconciler can race safely. Booking side effects run once (app.booking_finalize.claim_finalize).
- Refunds go to the payment's own provider (`payments.provider`), never to the currently selected gateway,
  and reuse a stored refund id on every retry so the provider cannot refund twice.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.payments.cashfree_pg import CashfreeError
from app.payments.providers import WALLET_PROVIDERS, ProviderOrder, active_gateway, gateway

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
# A payment still PENDING at the provider (e.g. UPI awaiting approval) keeps its booking this much longer.
PENDING_GRACE_MINUTES = 30
MIN_CHECKOUT_MINUTES = 5
OPEN_REFUND_STATUSES = ("pending", "processing", "successful", "manual_review")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_phone(raw: str | None) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if len(digits) == 10 else None


def _public_base() -> str:
    return (settings.payment_webhook_base_url or settings.public_app_url or "").rstrip("/")


def return_url(booking_id: str) -> str:
    return f"{settings.public_app_url.rstrip('/')}/payment/return?booking_id={booking_id}"


def notify_url() -> str | None:
    base = _public_base()
    # Cashfree only calls HTTPS endpoints; local development relies on the reconciler instead.
    return f"{base}/api/v1/payments/webhooks/cashfree" if base.startswith("https://") else None


def order_id_for(booking_number: str, attempt: int) -> str:
    return f"{booking_number}-{attempt}"[:45]


def checkout_payload(pay: dict) -> dict:
    provider = gateway(str(pay["provider"]))
    return {
        "provider": pay["provider"],
        "environment": provider.environment(),
        "order_id": pay["provider_order_id"],
        "payment_session_id": pay["payment_session_id"],
        "amount_paise": int(pay["amount_paise"]),
        "currency": pay["currency"],
        "expires_at": pay["expires_at"],
    }


# ---------------------------------------------------------------- starting a checkout


def open_order(db: Session, booking: dict, customer: dict, *, attempt: int, expires_at: datetime) -> dict:
    """Create the provider order for one attempt and record it. Runs inside the caller's transaction:
    if the provider call fails nothing is stored; if our commit fails the unused order just expires."""
    provider = active_gateway()
    if not provider:
        raise HTTPException(503, "Online payment is not available right now. Please try again later.")
    phone = normalize_phone(customer.get("phone"))
    if not phone:
        raise HTTPException(400, "Add a 10-digit mobile number to your profile to pay online.")
    order_id = order_id_for(str(booking["booking_number"]), attempt)
    amount = int(booking["total_paise"])
    if amount < 100:
        raise HTTPException(400, "This booking amount cannot be paid online.")
    try:
        order = provider.create_order(
            order_id=order_id,
            amount_paise=amount,
            currency="INR",
            customer_id=UUID(str(customer["id"])).hex,
            customer_phone=phone,
            customer_email=customer.get("email"),
            customer_name=customer.get("name"),
            return_url=return_url(str(booking["id"])),
            notify_url=notify_url(),
            expiry_iso=expires_at.astimezone(IST).isoformat(timespec="seconds"),
            note=f"B-Seva booking {booking['booking_number']}",
            tags={"booking_id": str(booking["id"]), "attempt": str(attempt)},
        )
    except CashfreeError as e:
        logger.warning("payment_order_create_failed booking=%s status=%s code=%s", booking["id"], e.status, e.code)
        raise HTTPException(502, "Could not start the online payment. Nothing was charged. Please try again.") from e
    if not order.get("payment_session_id"):
        raise HTTPException(502, "Could not start the online payment. Nothing was charged. Please try again.")
    row = db.execute(
        text(
            """
            INSERT INTO payments (
              booking_id, customer_id, amount_paise, currency, status, provider, purpose,
              provider_order_id, provider_ref, payment_session_id, provider_status, attempt_no, expires_at
            ) VALUES (
              CAST(:b AS uuid), CAST(:c AS uuid), :amt, 'INR', 'pending', :prov, 'booking',
              :oid, :cfid, :sess, :pst, :att, :exp
            )
            RETURNING *
            """
        ),
        {
            "b": str(booking["id"]),
            "c": str(customer["id"]),
            "amt": amount,
            "prov": provider.name,
            "oid": order_id,
            "cfid": str(order.get("cf_order_id") or "") or None,
            "sess": order["payment_session_id"],
            "pst": order.get("order_status"),
            "att": attempt,
            "exp": expires_at,
        },
    ).mappings().one()
    return dict(row)


def start_booking_checkout(db: Session, booking: dict, customer: dict) -> dict:
    expires = _now() + timedelta(minutes=max(MIN_CHECKOUT_MINUTES + 1, int(settings.payment_order_ttl_minutes or 20)))
    db.execute(
        text(
            """
            UPDATE bookings SET payment_expires_at = :exp, payment_provider = :prov
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"exp": expires, "prov": (active_gateway() or gateway("cashfree")).name, "id": str(booking["id"])},
    )
    return open_order(db, booking, customer, attempt=1, expires_at=expires)


def resume_checkout(db: Session, booking_id: str, customer: dict) -> dict:
    """Session for a booking still awaiting payment: the open attempt if usable, else a new attempt."""
    b = db.execute(
        text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": booking_id}
    ).mappings().first()
    if not b or str(b["customer_id"]) != str(customer["id"]):
        raise HTTPException(404, "Booking not found")
    if b["payment_status"] == "paid":
        raise HTTPException(409, "This booking is already paid")
    if b["status"] != "awaiting_payment":
        raise HTTPException(409, "This booking is no longer waiting for payment. Please book again.")
    expires = b["payment_expires_at"]
    if not expires or expires - _now() < timedelta(minutes=MIN_CHECKOUT_MINUTES):
        raise HTTPException(409, "The payment window for this booking has closed. Please book again.")
    latest = db.execute(
        text(
            """
            SELECT * FROM payments WHERE booking_id = CAST(:id AS uuid) AND provider_order_id IS NOT NULL
            ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if latest and latest["status"] in ("pending", "processing"):
        try:
            state = gateway(str(latest["provider"])).fetch_order(str(latest["provider_order_id"]))
        except CashfreeError:
            state = None
        if state is None or state.status == "active":
            return checkout_payload(dict(latest))
        apply_order_state(db, dict(latest), state)
        b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().one()
        if b["payment_status"] == "paid":
            raise HTTPException(409, "This booking is already paid")
    attempt = int(latest["attempt_no"]) + 1 if latest else 1
    return checkout_payload(open_order(db, dict(b), customer, attempt=attempt, expires_at=expires))


# ---------------------------------------------------------------- applying verified provider state


def _lock_payment(db: Session, payment_id: str) -> dict:
    return dict(
        db.execute(text("SELECT * FROM payments WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": payment_id}).mappings().one()
    )


def _lock_booking(db: Session, booking_id: str) -> dict:
    return dict(
        db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": booking_id}).mappings().one()
    )


def _set_payment(db: Session, payment_id: str, **fields: Any) -> None:
    fields["last_checked_at"] = _now()
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(
        text(f"UPDATE payments SET {sets}, updated_at = NOW(), check_attempts = check_attempts + 1 WHERE id = CAST(:pid AS uuid)"),
        {**fields, "pid": payment_id},
    )


def _notify_ops(db: Session, title: str, body: str, link: str = "/admin/payments") -> None:
    try:
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(db, title=title, body=body, category="payment", link=link)
    except Exception:
        logger.exception("payment_ops_notify_failed")


def apply_order_state(db: Session, payment: dict, order: ProviderOrder) -> dict[str, Any]:
    """Move one payment (and its booking) to match verified provider state. Idempotent; caller commits.

    Returns {"outcome": ..., "finalize": {...} | None}; when "finalize" is set the caller must run
    post_commit_side_effects after committing."""
    pay = _lock_payment(db, str(payment["id"]))
    if pay["status"] in ("successful", "failed", "expired", "cancelled") and pay["verified_at"]:
        # Terminal and already verified: a replayed webhook or a slow reconciler changes nothing.
        if not (pay["status"] != "successful" and any(p.status == "success" for p in order.payments)):
            return {"outcome": "unchanged"}
    expected_amount, expected_currency = int(pay["amount_paise"]), str(pay["currency"] or "INR").upper()
    if order.amount_paise != expected_amount or (order.currency and order.currency != expected_currency):
        _set_payment(db, str(pay["id"]), status="processing", failure_reason="order_amount_mismatch", provider_status=order.raw_status)
        _notify_ops(db, "Payment needs review", f"Order {pay['provider_order_id']}: amount or currency does not match the booking.")
        return {"outcome": "amount_mismatch"}
    success = next((p for p in order.payments if p.status == "success"), None)
    if success:
        if success.amount_paise != expected_amount or (success.currency and success.currency != expected_currency):
            _set_payment(
                db,
                str(pay["id"]),
                status="processing",
                failure_reason="payment_amount_mismatch",
                provider_payment_id=success.provider_payment_id,
                provider_status=success.raw_status,
            )
            _notify_ops(db, "Payment needs review", f"Order {pay['provider_order_id']}: paid amount does not match the booking.")
            return {"outcome": "amount_mismatch"}
        return _record_success(db, pay, success)
    latest = order.payments[-1] if order.payments else None
    # Only the customer's latest attempt counts: an older UPI QR left pending after they switched to a card that
    # failed must not hide the retry. A later success on the same order is still confirmed (and an order accepts
    # only one successful payment).
    pending = bool(latest and latest.status == "pending")
    if order.status in ("expired", "terminated") and not pending:
        _set_payment(
            db,
            str(pay["id"]),
            status="expired" if order.status == "expired" else "cancelled",
            provider_status=order.raw_status,
            failure_reason=(latest.message if latest else None),
            verified_at=_now(),
        )
        return {"outcome": order.status}
    # Still open: record the latest attempt so the customer and admins see why it has not completed.
    _set_payment(
        db,
        str(pay["id"]),
        status="processing" if pending else "pending",
        provider_status=(latest.raw_status if latest else order.raw_status),
        failure_reason=(latest.message if latest and latest.status in ("failed", "dropped", "cancelled") else None),
    )
    return {"outcome": "pending" if pending else "open"}


def _record_success(db: Session, pay: dict, success) -> dict[str, Any]:
    now = _now()
    _set_payment(
        db,
        str(pay["id"]),
        status="successful",
        provider_payment_id=success.provider_payment_id,
        payment_method=success.method,
        provider_status=success.raw_status,
        failure_reason=None,
        paid_at=pay.get("paid_at") or now,
        verified_at=now,
    )
    b = _lock_booking(db, str(pay["booking_id"]))
    other = db.execute(
        text(
            """
            SELECT id FROM payments
            WHERE booking_id = CAST(:b AS uuid) AND id <> CAST(:p AS uuid) AND status = 'successful' AND duplicate_of IS NULL
            ORDER BY paid_at NULLS LAST LIMIT 1
            """
        ),
        {"b": str(b["id"]), "p": str(pay["id"])},
    ).first()
    if b["payment_status"] in ("paid", "refund_pending", "refunded", "partial_refund") and other:
        # Two attempts both succeeded: keep the first, give this one back in full.
        db.execute(
            text("UPDATE payments SET duplicate_of = CAST(:o AS uuid) WHERE id = CAST(:p AS uuid)"),
            {"o": str(other[0]), "p": str(pay["id"])},
        )
        queue_refund(db, pay, int(pay["amount_paise"]), kind="duplicate_payment", reason="Duplicate payment for one booking")
        _notify_ops(db, "Duplicate payment refunded", f"Booking {b['booking_number']} was paid twice; the second payment is being refunded.")
        return {"outcome": "duplicate_refunded"}
    if b["status"] == "awaiting_payment":
        return _confirm(db, b, pay)
    blockers = (
        revival_blockers(db, b)
        if b["status"] == "cancelled"
        and str(b.get("cancel_policy") or "") == "payment_expired"
        and b["payment_status"] in ("pending", "failed")
        else ["booking_not_expired_unpaid"]
    )
    if not blockers:
        db.execute(
            text(
                """
                UPDATE bookings SET status = 'awaiting_payment', cancelled_at = NULL, cancel_policy = NULL,
                  cancel_reason = NULL WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": str(b["id"])},
        )
        out = _confirm(db, {**b, "status": "awaiting_payment"}, pay)
        _notify_ops(db, "Late payment confirmed booking", f"Booking {b['booking_number']} was paid after its payment window and is now live.")
        return {**out, "outcome": "late_success_confirmed"}
    why = ", ".join(blockers)[:150]
    queue_refund(db, pay, int(pay["amount_paise"]), kind="late_payment", reason=f"Paid after the booking closed ({why})")
    _set_payment(db, str(pay["id"]), failure_reason=f"late_payment_refunded: {why}"[:300])
    _notify_ops(db, "Late payment refunded", f"Booking {b['booking_number']} was paid after it closed ({why}); refunding in full.")
    return {"outcome": "late_success_refunded", "blockers": blockers}


def revival_blockers(db: Session, b: dict) -> list[str]:
    """Why an expired, unpaid booking may NOT be brought back by a late payment. Empty = every rule that
    applied when it was booked still holds now: service live and priced, the puja's own booking notice,
    Virtual Puja switched on, and the chosen pujari (or, with none chosen, some eligible pujari) still able
    to take it at that address and time. Anything else is refunded in full."""
    from app.booking_finalize import booking_start_utc
    from app.domain import SERVICE_RADIUS_KM, pujari_blocked_on_slot, pujari_covers_location, service_available_near, slot_conflict
    from app.platform_config import get_setting

    out: list[str] = []
    svc = db.execute(text("SELECT * FROM services WHERE id = CAST(:id AS uuid)"), {"id": str(b["service_id"])}).mappings().first()
    if not svc or not svc.get("active") or svc.get("standard_price_paise") is None or svc.get("pricing_status") == "awaiting_pricing":
        return ["service_unavailable"]
    lead = int(svc.get("booking_lead_hours") if svc.get("booking_lead_hours") is not None else 48) or 48
    if booking_start_utc(b) < datetime.utcnow() + timedelta(hours=lead):
        out.append(f"inside_{lead}h_booking_notice")
    virtual = str(b.get("mode") or "") == "virtual"
    if virtual and (not bool(get_setting(db, "virtual_puja_enabled", False)) or not svc.get("virtual_available")):
        out.append("virtual_puja_unavailable")
    pid = str(b["pujari_id"]) if b.get("pujari_id") else None
    lat, lng = b.get("latitude"), b.get("longitude")
    if pid:
        from app.pujari_levels import is_specialized_level, pujari_meets_required_level
        from app.pujari_services import pujari_has_verified_service

        p = db.execute(
            text(
                """
                SELECT u.blocked, p.approved_level, p.verification_status, p.available
                FROM users u JOIN pujari_profiles p ON p.user_id = u.id WHERE u.id = CAST(:id AS uuid)
                """
            ),
            {"id": pid},
        ).mappings().first()
        required = int(svc.get("required_level") or 1)
        if not p or p["blocked"] or p["verification_status"] != "approved" or not p["available"]:
            out.append("pujari_unavailable")
        elif (
            not pujari_meets_required_level(p["approved_level"], required)
            if is_specialized_level(p["approved_level"]) or is_specialized_level(required)
            else not p["approved_level"] or int(p["approved_level"]) < required
        ):
            out.append("pujari_not_eligible")
        elif not pujari_has_verified_service(db, pid, str(b["service_id"])):
            out.append("pujari_not_verified_for_service")
        if not virtual and lat is not None and lng is not None and not pujari_covers_location(db, pid, float(lat), float(lng), SERVICE_RADIUS_KM):
            out.append("pujari_out_of_area")
        if pujari_blocked_on_slot(db, pid, b["booking_date"], b["start_time"], b["end_time"]):
            out.append("pujari_blocked_that_day")
        if slot_conflict(db, pid, b["booking_date"], b["start_time"], b["end_time"], str(b["service_id"]), exclude_booking_id=str(b["id"])):
            out.append("slot_taken")
    elif not virtual:
        if lat is None or lng is None or not service_available_near(
            db, float(lat), float(lng), int(svc.get("required_level") or 1), SERVICE_RADIUS_KM, service_id=str(b["service_id"])
        ):
            out.append("no_eligible_pujari_in_area")
    return out


def _confirm(db: Session, b: dict, pay: dict) -> dict[str, Any]:
    from app.booking_finalize import finalize_paid_booking

    db.execute(
        text(
            """
            UPDATE bookings SET payment_status = 'paid', status = 'pending_acceptance', paid_at = NOW(),
              payment_provider = :prov
            WHERE id = CAST(:id AS uuid) AND status = 'awaiting_payment'
            """
        ),
        {"prov": pay["provider"], "id": str(b["id"])},
    )
    try:
        from app.routers.notifications import create_notification, customer_booking_link

        create_notification(
            db,
            user_id=str(b["customer_id"]),
            title="Payment Received",
            body=f"Payment for booking {b['booking_number']} was successful.",
            category="payment",
            link=customer_booking_link(str(b["id"])),
            extra_data={"booking_id": str(b["id"])},
            message_key="paymentOk",
            message_vars={"number": str(b["booking_number"])},
        )
    except Exception:
        logger.exception("payment_notification_failed booking=%s", b["id"])
    return {"outcome": "confirmed", "finalize": finalize_paid_booking(db, str(b["id"]))}


def refresh_payment(db: Session, payment: dict) -> dict[str, Any]:
    """Fetch the order from its own provider and apply it. Commits; runs side effects after commit."""
    from app.booking_finalize import post_commit_side_effects

    try:
        state = gateway(str(payment["provider"])).fetch_order(str(payment["provider_order_id"]))
    except CashfreeError as e:
        db.rollback()
        db.execute(
            text(
                """
                UPDATE payments SET last_checked_at = NOW(), check_attempts = check_attempts + 1
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": str(payment["id"])},
        )
        db.commit()
        return {"outcome": "provider_unavailable", "retryable": e.retryable}
    out = apply_order_state(db, payment, state)
    db.commit()
    fin = out.get("finalize")
    if fin:
        post_commit_side_effects(str(payment["booking_id"]))
    submit_open_refunds(db, payment_id=str(payment["id"]))
    return out


def payment_by_order(db: Session, provider: str, order_id: str) -> dict | None:
    row = db.execute(
        text("SELECT * FROM payments WHERE provider = :p AND provider_order_id = :o"), {"p": provider, "o": order_id}
    ).mappings().first()
    return dict(row) if row else None


def booking_payment_status(db: Session, booking_id: str, customer: dict, *, verify: bool = True) -> dict:
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b or str(b["customer_id"]) != str(customer["id"]):
        raise HTTPException(404, "Booking not found")
    latest = db.execute(
        text("SELECT * FROM payments WHERE booking_id = CAST(:id AS uuid) ORDER BY attempt_no DESC, created_at DESC LIMIT 1"),
        {"id": booking_id},
    ).mappings().first()
    if verify and latest and latest["provider"] not in WALLET_PROVIDERS and latest["status"] in ("pending", "processing"):
        refresh_payment(db, dict(latest))
        b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().one()
        latest = db.execute(text("SELECT * FROM payments WHERE id = CAST(:id AS uuid)"), {"id": str(latest["id"])}).mappings().one()
    return {
        "booking_id": booking_id,
        "booking_number": b["booking_number"],
        "booking_status": b["status"],
        "payment_status": b["payment_status"],
        # Why an unpaid booking closed: payment_abandoned (customer cancelled), payment_expired (order expired), ...
        "cancel_policy": b.get("cancel_policy") if b["status"] == "cancelled" else None,
        "paid": b["payment_status"] == "paid",
        "payment_expires_at": b.get("payment_expires_at"),
        "total_paise": int(b["total_paise"] or 0),
        "attempt": {
            "provider": latest["provider"],
            "status": latest["status"],
            "attempt_no": latest["attempt_no"],
            "provider_status": latest.get("provider_status"),
            "message": latest.get("failure_reason"),
        }
        if latest
        else None,
    }


def abandon_unpaid_booking(db: Session, booking_id: str, customer: dict, *, reason: str) -> dict:
    """Close a booking still waiting for online payment. Verifies with the gateway first: a booking that was in
    fact paid is never closed here ({"paid": True}). Open orders are terminated; a payment that still succeeds
    later is refunded automatically (late success on an abandoned booking). Commits."""
    db.commit()
    status = booking_payment_status(db, booking_id, customer, verify=True)
    if status["paid"]:
        return {"ok": False, "paid": True}
    for provider, order_id in db.execute(
        text(
            """
            SELECT provider, provider_order_id FROM payments
            WHERE booking_id = CAST(:id AS uuid) AND status IN ('pending', 'processing') AND provider_order_id IS NOT NULL
            """
        ),
        {"id": booking_id},
    ).all():
        try:
            gateway(provider).terminate_order(order_id)
        except CashfreeError:
            pass
    updated = db.execute(
        text(
            """
            UPDATE bookings SET status = 'cancelled', payment_status = 'failed', cancelled_at = NOW(),
              cancel_policy = 'payment_abandoned', cancel_reason = :reason, refund_paise = 0
            WHERE id = CAST(:id AS uuid) AND status = 'awaiting_payment'
            RETURNING id
            """
        ),
        {"id": booking_id, "reason": reason},
    ).first()
    db.execute(
        text("UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE booking_id = CAST(:id AS uuid) AND status = 'pending'"),
        {"id": booking_id},
    )
    db.commit()
    return {"ok": bool(updated), "paid": False}


# ---------------------------------------------------------------- expiry and reconciliation


def expire_unpaid_bookings(db: Session, *, limit: int = 50) -> dict:
    """Close bookings whose payment window passed. A payment still pending at the provider gets a grace
    period; a success found here confirms the booking instead. Commits per booking."""
    from app.booking_finalize import post_commit_side_effects

    rows = db.execute(
        text(
            """
            SELECT id FROM bookings
            WHERE status = 'awaiting_payment' AND payment_expires_at < NOW()
            ORDER BY payment_expires_at LIMIT :lim
            """
        ),
        {"lim": limit},
    ).all()
    out = {"checked": 0, "expired": 0, "confirmed": 0, "waiting": 0}
    for (booking_id,) in rows:
        out["checked"] += 1
        open_pays = db.execute(
            text(
                """
                SELECT * FROM payments WHERE booking_id = CAST(:id AS uuid) AND provider_order_id IS NOT NULL
                  AND status IN ('pending', 'processing') ORDER BY attempt_no
                """
            ),
            {"id": str(booking_id)},
        ).mappings().all()
        waiting = False
        for p in open_pays:
            try:
                state = gateway(str(p["provider"])).fetch_order(str(p["provider_order_id"]))
            except CashfreeError:
                waiting = True  # cannot tell yet: never cancel a booking that might be paid
                continue
            res = apply_order_state(db, dict(p), state)
            db.commit()
            if res.get("finalize"):
                post_commit_side_effects(str(booking_id))
            if res["outcome"] in ("pending", "amount_mismatch", "open"):
                waiting = True
                if res["outcome"] == "open" and state.status == "active":
                    # Still open at the provider after our window: ask it to close so no new attempt starts.
                    try:
                        gateway(str(p["provider"])).terminate_order(str(p["provider_order_id"]))
                    except CashfreeError:
                        pass
        b = _lock_booking(db, str(booking_id))
        if b["status"] != "awaiting_payment":
            out["confirmed"] += 1 if b["payment_status"] == "paid" else 0
            db.commit()
            continue
        grace_over = b["payment_expires_at"] + timedelta(minutes=PENDING_GRACE_MINUTES) < _now()
        if waiting and not grace_over:
            out["waiting"] += 1
            db.commit()
            continue
        db.execute(
            text(
                """
                UPDATE bookings SET status = 'cancelled', payment_status = 'failed', cancelled_at = NOW(),
                  cancel_policy = 'payment_expired', cancel_reason = 'Payment was not completed in time', refund_paise = 0
                WHERE id = CAST(:id AS uuid) AND status = 'awaiting_payment'
                """
            ),
            {"id": str(booking_id)},
        )
        db.execute(
            text(
                """
                UPDATE payments SET status = 'expired', updated_at = NOW()
                WHERE booking_id = CAST(:id AS uuid) AND status = 'pending'
                """
            ),
            {"id": str(booking_id)},
        )
        if b.get("recurring_series_id"):
            db.execute(
                text(
                    """
                    UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancel_policy = 'payment_expired',
                      cancel_reason = 'First booking of the series was not paid', refund_paise = 0
                    WHERE recurring_series_id = CAST(:sid AS uuid) AND id <> CAST(:id AS uuid)
                      AND payment_status = 'pending' AND status IN ('pending', 'pending_acceptance', 'confirmed')
                    """
                ),
                {"sid": str(b["recurring_series_id"]), "id": str(booking_id)},
            )
            db.execute(
                text("UPDATE recurring_series SET active = FALSE WHERE id = CAST(:sid AS uuid)"),
                {"sid": str(b["recurring_series_id"])},
            )
        db.commit()
        out["expired"] += 1
    return out


def reconcile_open_payments(db: Session, *, limit: int = 50) -> dict:
    """Re-check gateway payments still open, oldest check first, with back-off by attempt count."""
    rows = db.execute(
        text(
            """
            SELECT * FROM payments
            WHERE provider_order_id IS NOT NULL AND status IN ('pending', 'processing')
              AND created_at < NOW() - INTERVAL '2 minutes'
              AND (last_checked_at IS NULL
                   OR last_checked_at < NOW() - make_interval(secs => LEAST(3600, 60 * GREATEST(1, check_attempts))))
            ORDER BY last_checked_at NULLS FIRST LIMIT :lim
            """
        ),
        {"lim": limit},
    ).mappings().all()
    outcomes: dict[str, int] = {}
    for p in rows:
        res = refresh_payment(db, dict(p))
        outcomes[res["outcome"]] = outcomes.get(res["outcome"], 0) + 1
    refunds = submit_open_refunds(db)
    return {"payments": outcomes, "refunds": refunds}


def run_payment_jobs(db: Session) -> dict:
    from app.booking_finalize import run_due_side_effects

    return {
        "expiry": expire_unpaid_bookings(db),
        "reconcile": reconcile_open_payments(db),
        # Booking offers, notifications, email and invoice left pending by an error or a crash.
        "booking_follow_ups": run_due_side_effects(db),
    }


# ---------------------------------------------------------------- refunds


def _refund_id(payment_id: str, kind: str, n: int = 0) -> str:
    code = {"cancellation": "C", "duplicate_payment": "D", "late_payment": "L", "manual": "M"}[kind]
    suffix = f"{n}" if n else ""
    return f"RF{code}{UUID(str(payment_id)).hex[:30]}{suffix}"[:40]


def booking_paid_payment(db: Session, booking_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT * FROM payments
            WHERE booking_id = CAST(:id AS uuid) AND status = 'successful' AND duplicate_of IS NULL
            ORDER BY paid_at NULLS LAST, created_at LIMIT 1
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    return dict(row) if row else None


def queue_refund(
    db: Session, pay: dict, amount_paise: int, *, kind: str, reason: str, initiated_by: str | None = None
) -> dict | None:
    """Record a gateway refund for `pay` (submitted after commit by submit_open_refunds). Never exceeds what is
    left to refund on the payment. Returns the refund row, or None when nothing is left to refund."""
    if amount_paise <= 0:
        return None
    committed = int(
        db.execute(
            text(
                """
                SELECT COALESCE(SUM(amount_paise), 0) FROM refunds
                WHERE payment_id = CAST(:p AS uuid) AND status IN ('pending', 'processing', 'successful', 'manual_review')
                """
            ),
            {"p": str(pay["id"])},
        ).scalar()
        or 0
    )
    amount = min(int(amount_paise), int(pay["amount_paise"]) - committed)
    if amount <= 0:
        return None
    n = int(
        db.execute(
            text("SELECT COUNT(*) FROM refunds WHERE payment_id = CAST(:p AS uuid) AND kind = :k"),
            {"p": str(pay["id"]), "k": kind},
        ).scalar()
        or 0
    )
    row = db.execute(
        text(
            """
            INSERT INTO refunds (payment_id, booking_id, provider, refund_id, amount_paise, currency, kind, reason, initiated_by)
            VALUES (CAST(:p AS uuid), CAST(:b AS uuid), :prov, :rid, :amt, :cur, :kind, :reason, CAST(:by AS uuid))
            ON CONFLICT (refund_id) DO NOTHING
            RETURNING *
            """
        ),
        {
            "p": str(pay["id"]),
            "b": str(pay["booking_id"]) if pay.get("booking_id") else None,
            "prov": pay["provider"],
            "rid": _refund_id(str(pay["id"]), kind, n),
            "amt": amount,
            "cur": pay.get("currency") or "INR",
            "kind": kind,
            "reason": reason[:200],
            "by": initiated_by,
        },
    ).mappings().first()
    return dict(row) if row else None


def refund_booking_payment(
    db: Session, booking: dict, amount_paise: int, *, reason: str, initiated_by: str | None = None
) -> dict[str, Any]:
    """Refund part or all of a booking's payment to where it came from. Caller holds the booking row lock and
    commits. Wallet payments (and bookings from before payment rows existed) are credited to the wallet as
    before; gateway payments get a tracked refund that is submitted after commit."""
    from app.domain import apply_wallet

    if amount_paise <= 0:
        return {"method": None, "amount_paise": 0}
    pay = booking_paid_payment(db, str(booking["id"]))
    if not pay or pay["provider"] in WALLET_PROVIDERS:
        apply_wallet(db, str(booking["customer_id"]), amount_paise, "credit", f"Refund {booking['booking_number']}", str(booking["id"]))
        return {"method": "wallet", "amount_paise": amount_paise}
    refund = queue_refund(db, pay, amount_paise, kind="cancellation", reason=reason, initiated_by=initiated_by)
    if not refund:
        return {"method": pay["provider"], "amount_paise": 0}
    db.execute(
        text("UPDATE bookings SET payment_status = 'refund_pending' WHERE id = CAST(:id AS uuid) AND payment_status = 'paid'"),
        {"id": str(booking["id"])},
    )
    return {"method": pay["provider"], "amount_paise": int(refund["amount_paise"]), "refund_id": refund["refund_id"]}


def _apply_refund_state(db: Session, refund: dict, state) -> None:
    now = _now()
    db.execute(
        text(
            """
            UPDATE refunds SET status = :st, provider_status = :pst, provider_refund_id = COALESCE(:prid, provider_refund_id),
              failure_reason = :fr, processed_at = CASE WHEN :st IN ('successful', 'failed') THEN :now ELSE processed_at END,
              updated_at = NOW()
            WHERE id = CAST(:id AS uuid) AND status NOT IN ('successful', 'cancelled')
            """
        ),
        {
            "st": state.status,
            "pst": state.raw_status,
            "prid": state.provider_refund_id,
            "fr": state.message if state.status == "failed" else None,
            "now": now,
            "id": str(refund["id"]),
        },
    )
    if refund.get("booking_id") and refund.get("kind") == "cancellation":
        _sync_booking_refund_status(db, str(refund["booking_id"]))
    if state.status == "failed":
        _notify_ops(db, "Refund failed", f"Refund {refund['refund_id']} was not completed by the gateway. Retry it from Payments.")
    elif state.raw_status == "ONHOLD" and refund.get("provider_status") != "ONHOLD":
        # Cashfree holds refunds it cannot fund (e.g. "insufficient account balance"); it stays open, so tell ops once.
        _notify_ops(db, "Refund on hold", f"Cashfree is holding refund {refund['refund_id']}: {state.message or 'no reason given'}. "
                    "It completes once Cashfree releases it.")


def _sync_booking_refund_status(db: Session, booking_id: str) -> None:
    pay = booking_paid_payment(db, booking_id)
    if not pay:
        return
    sums = db.execute(
        text(
            """
            SELECT COALESCE(SUM(amount_paise) FILTER (WHERE status = 'successful'), 0) AS done,
                   COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'manual_review')) AS open
            FROM refunds WHERE payment_id = CAST(:p AS uuid) AND kind IN ('cancellation', 'manual')
            """
        ),
        {"p": str(pay["id"])},
    ).mappings().one()
    if sums["open"]:
        status = "refund_pending"
    elif int(sums["done"]) >= int(pay["amount_paise"]):
        status = "refunded"
    elif int(sums["done"]) > 0:
        status = "partial_refund"
    else:
        # Every refund failed: still paid, and the failed refund shows on the admin refunds list.
        status = "paid"
    db.execute(
        text(
            """
            UPDATE bookings SET payment_status = :s
            WHERE id = CAST(:id AS uuid) AND payment_status IN ('paid', 'refund_pending', 'refunded', 'partial_refund')
            """
        ),
        {"s": status, "id": booking_id},
    )


def submit_refund(db: Session, refund_id: str) -> dict:
    """Send (or re-check) one refund at its payment's provider. The same refund id is reused on every retry.
    Commits."""
    r = db.execute(text("SELECT * FROM refunds WHERE refund_id = :r FOR UPDATE SKIP LOCKED"), {"r": refund_id}).mappings().first()
    if not r:
        db.rollback()
        return {"refund_id": refund_id, "status": "busy"}
    r = dict(r)
    if r["status"] not in ("pending", "processing"):
        db.rollback()
        return {"refund_id": refund_id, "status": r["status"]}
    pay = db.execute(text("SELECT * FROM payments WHERE id = CAST(:id AS uuid)"), {"id": str(r["payment_id"])}).mappings().one()
    provider = gateway(str(r["provider"]))
    db.execute(
        text("UPDATE refunds SET attempts = attempts + 1, last_attempt_at = NOW() WHERE id = CAST(:id AS uuid)"),
        {"id": str(r["id"])},
    )
    order_id = str(pay["provider_order_id"])
    try:
        if r["status"] == "pending":
            try:
                state = provider.create_refund(
                    order_id=order_id, refund_id=r["refund_id"], amount_paise=int(r["amount_paise"]),
                    note=r.get("reason") or "B-Seva refund",
                )
            except CashfreeError as create_error:
                # A timeout may have created it, and a refusal may mean it already exists: read it back by our id.
                try:
                    state = provider.fetch_refund(order_id, r["refund_id"])
                except CashfreeError as fetch_error:
                    raise (create_error if fetch_error.status == 404 else fetch_error) from None
        else:
            state = provider.fetch_refund(order_id, r["refund_id"])
    except CashfreeError as e:
        if e.retryable:
            db.commit()  # attempt recorded; the reconciler tries again with the same refund id
            return {"refund_id": refund_id, "status": "retry_later"}
        db.execute(
            text(
                """
                UPDATE refunds SET status = 'manual_review', failure_reason = :fr, updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"fr": str(e)[:300], "id": str(r["id"])},
        )
        _notify_ops(db, "Refund needs review", f"Refund {r['refund_id']} was refused by the gateway: {str(e)[:120]}")
        db.commit()
        return {"refund_id": refund_id, "status": "manual_review"}
    _apply_refund_state(db, r, state)
    db.commit()
    return {"refund_id": refund_id, "status": state.status}


def submit_open_refunds(db: Session, *, payment_id: str | None = None, limit: int = 50) -> dict[str, int]:
    rows = db.execute(
        text(
            f"""
            SELECT refund_id FROM refunds
            WHERE status IN ('pending', 'processing') {"AND payment_id = CAST(:p AS uuid)" if payment_id else ""}
              AND (last_attempt_at IS NULL
                   OR last_attempt_at < NOW() - make_interval(secs => LEAST(3600, 60 * GREATEST(1, attempts))))
            ORDER BY created_at LIMIT :lim
            """
        ),
        {"p": payment_id, "lim": limit},
    ).all()
    db.commit()
    counts: dict[str, int] = {}
    for (rid,) in rows:
        try:
            status = submit_refund(db, rid)["status"]
        except Exception:
            db.rollback()
            logger.exception("refund_submit_failed refund=%s", rid)
            status = "error"
        counts[status] = counts.get(status, 0) + 1
    return counts


def apply_refund_webhook(db: Session, provider: str, order_id: str, refund_id: str) -> str:
    r = db.execute(
        text("SELECT * FROM refunds WHERE refund_id = :r AND provider = :p FOR UPDATE"), {"r": refund_id, "p": provider}
    ).mappings().first()
    if not r:
        return "unknown_refund"
    state = gateway(provider).fetch_refund(order_id, refund_id)
    _apply_refund_state(db, dict(r), state)
    return f"refund_{state.status}"
