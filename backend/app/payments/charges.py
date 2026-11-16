"""Online charges: customer payments other than a new booking, taken through the payment gateway.

Purposes (payments.purpose):
- reschedule_fee     the fee for moving a booking; the move happens once the payment is verified
- consultation       a Muhurtham consultation fee; the request reaches the team once paid
- seva_registration  a paid Seva event registration; the seat is held while the payment is open
- booking_payment    a later date of a recurring booking (created unpaid); payments.booking_id is set so a later
                     cancellation refunds this payment

Same rules as booking payments (app.payments.service): amounts come from the server, state is applied only from
the provider's own records fetched server-side, every change locks the payment row, and money that cannot be
used (paid twice, paid after the charge closed, or the thing paid for is no longer possible) is refunded in full
to where it came from. Attempts of one charge share meta.group (the first payment's id).
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Callable
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.payments.cashfree_pg import CashfreeError
from app.payments.providers import ProviderOrder, active_gateway, gateway

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
PURPOSES = ("reschedule_fee", "consultation", "seva_registration", "booking_payment")
# Purposes that hold something for the customer (a consultation request, a Seva seat) until a fixed time.
WINDOWED = ("consultation", "seva_registration")
PENDING_GRACE_MINUTES = 30
MIN_CHECKOUT_MINUTES = 5
ORDER_PREFIX = {"reschedule_fee": "RSF", "consultation": "MUH", "seva_registration": "SEV", "booking_payment": "BKP"}
NOTE = {
    "reschedule_fee": "B-Seva reschedule fee",
    "consultation": "B-Seva Muhurtham consultation",
    "seva_registration": "B-Seva Seva registration",
    "booking_payment": "B-Seva booking payment",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ttl() -> timedelta:
    return timedelta(minutes=max(MIN_CHECKOUT_MINUTES + 1, int(settings.payment_order_ttl_minutes or 20)))


def _meta(pay: dict) -> dict:
    m = pay.get("meta") or {}
    return json.loads(m) if isinstance(m, str) else dict(m)


def return_url(payment_id: str) -> str:
    return f"{settings.public_app_url.rstrip('/')}/payment/return?payment_id={payment_id}"


def checkout_payload(pay: dict) -> dict:
    provider = gateway(str(pay["provider"]))
    return {
        "payment_id": str(_meta(pay).get("group") or pay["id"]),
        "provider": pay["provider"],
        "environment": provider.environment(),
        "order_id": pay["provider_order_id"],
        "payment_session_id": pay["payment_session_id"],
        "amount_paise": int(pay["amount_paise"]),
        "currency": pay["currency"],
        "expires_at": pay["expires_at"],
    }


# ---------------------------------------------------------------- starting and resuming


def _open_order(
    db: Session,
    *,
    purpose: str,
    customer: dict,
    amount_paise: int,
    subject_id: str,
    booking_id: str | None,
    meta: dict,
    reference: str,
    attempt: int,
    expires_at: datetime,
    payment_id: str | None = None,
) -> dict:
    from app.payments.service import normalize_phone, notify_url

    provider = active_gateway()
    if not provider:
        raise HTTPException(503, "Online payment is not available right now. Please try again later.")
    phone = normalize_phone(customer.get("phone"))
    if not phone:
        raise HTTPException(400, "Add a 10-digit mobile number to your profile to pay online.")
    if amount_paise < 100:
        raise HTTPException(400, "This amount cannot be paid online.")
    pid = payment_id or str(uuid4())
    meta = {**meta, "group": meta.get("group") or pid}
    order_id = f"{ORDER_PREFIX[purpose]}-{reference}-{attempt}"[:45]
    try:
        order = provider.create_order(
            order_id=order_id,
            amount_paise=amount_paise,
            currency="INR",
            customer_id=UUID(str(customer["id"])).hex,
            customer_phone=phone,
            customer_email=customer.get("email"),
            customer_name=customer.get("name"),
            return_url=return_url(meta["group"]),
            notify_url=notify_url(),
            expiry_iso=expires_at.astimezone(IST).isoformat(timespec="seconds"),
            note=NOTE[purpose],
            tags={"purpose": purpose, "subject_id": str(subject_id), "attempt": str(attempt)},
        )
    except CashfreeError as e:
        logger.warning("charge_order_create_failed purpose=%s subject=%s status=%s code=%s", purpose, subject_id, e.status, e.code)
        raise HTTPException(502, "Could not start the online payment. Nothing was charged. Please try again.") from e
    if not order.get("payment_session_id"):
        raise HTTPException(502, "Could not start the online payment. Nothing was charged. Please try again.")
    row = db.execute(
        text(
            """
            INSERT INTO payments (
              id, booking_id, customer_id, amount_paise, currency, status, provider, purpose, subject_id, meta,
              provider_order_id, provider_ref, payment_session_id, provider_status, attempt_no, expires_at
            ) VALUES (
              CAST(:id AS uuid), CAST(:b AS uuid), CAST(:c AS uuid), :amt, 'INR', 'pending', :prov, :purpose,
              CAST(:subj AS uuid), CAST(:meta AS jsonb), :oid, :cfid, :sess, :pst, :att, :exp
            )
            RETURNING *
            """
        ),
        {
            "id": pid,
            "b": booking_id,
            "c": str(customer["id"]),
            "amt": int(amount_paise),
            "prov": provider.name,
            "purpose": purpose,
            "subj": str(subject_id),
            "meta": json.dumps(meta, default=str),
            "oid": order_id,
            "cfid": str(order.get("cf_order_id") or "") or None,
            "sess": order["payment_session_id"],
            "pst": order.get("order_status"),
            "att": attempt,
            "exp": expires_at,
        },
    ).mappings().one()
    return dict(row)


def start_charge(
    db: Session,
    *,
    purpose: str,
    customer: dict,
    amount_paise: int,
    subject_id: str,
    reference: str,
    meta: dict | None = None,
    booking_id: str | None = None,
    window_expires_at: datetime | None = None,
) -> dict:
    """Open the first attempt of a charge. Runs in the caller's transaction (caller commits)."""
    assert purpose in PURPOSES
    expires = _now() + _ttl()
    m = {**(meta or {}), "reference": reference}
    if purpose in WINDOWED:
        window = window_expires_at or expires
        m["window_expires_at"] = window.isoformat()
        expires = min(expires, window)
    pay = _open_order(
        db, purpose=purpose, customer=customer, amount_paise=amount_paise, subject_id=subject_id,
        booking_id=booking_id, meta=m, reference=reference, attempt=1, expires_at=expires,
    )
    return checkout_payload(pay)


def start_reschedule_charge(db: Session, quote: dict, customer: dict, *, new_date: date, new_time: time) -> dict:
    b = quote["booking"]
    seq = int(quote["prior"]) + 1
    return start_charge(
        db,
        purpose="reschedule_fee",
        customer=customer,
        amount_paise=int(quote["fee"]),
        subject_id=str(b["id"]),
        reference=f"{b['booking_number']}-R{seq}",
        meta={"new_date": new_date.isoformat(), "new_time": new_time.strftime("%H:%M:%S"), "fee": int(quote["fee"]), "seq": seq},
    )


def _group_rows(db: Session, group: str, *, lock: bool = False) -> list[dict]:
    rows = db.execute(
        text(
            f"""
            SELECT * FROM payments WHERE purpose <> 'booking' AND (meta->>'group' = :g OR id = CAST(:g AS uuid))
            ORDER BY attempt_no {"FOR UPDATE" if lock else ""}
            """
        ),
        {"g": group},
    ).mappings().all()
    return [dict(r) for r in rows]


def _load_group(db: Session, payment_id: str, customer: dict | None, *, lock: bool = False) -> list[dict]:
    try:
        UUID(str(payment_id))
    except ValueError:
        raise HTTPException(404, "Payment not found") from None
    first = db.execute(
        text("SELECT * FROM payments WHERE id = CAST(:id AS uuid) AND purpose <> 'booking'"), {"id": payment_id}
    ).mappings().first()
    if not first or (customer is not None and str(first["customer_id"]) != str(customer["id"])):
        raise HTTPException(404, "Payment not found")
    return _group_rows(db, str(_meta(dict(first)).get("group") or first["id"]), lock=lock)


def _window_left(pay: dict) -> timedelta | None:
    w = _meta(pay).get("window_expires_at")
    if not w:
        return None
    return datetime.fromisoformat(w) - _now()


def resume_charge(db: Session, payment_id: str, customer: dict) -> dict:
    """Checkout for a charge not paid yet: the open attempt if usable, else a new attempt. Caller commits."""
    rows = _load_group(db, payment_id, customer, lock=True)
    first, latest = rows[0], rows[-1]
    if any(r["status"] == "successful" for r in rows):
        raise HTTPException(409, "This has already been paid")
    if _meta(first).get("released"):
        raise HTTPException(409, "This payment was closed. Please start again.")
    left = _window_left(first)
    if left is not None and left < timedelta(minutes=MIN_CHECKOUT_MINUTES):
        raise HTTPException(409, "The payment window has closed. Please start again.")
    blocker = _subject_blocker(db, first)
    if blocker:
        raise HTTPException(409, blocker)
    if latest["status"] in ("pending", "processing") and latest.get("provider_order_id"):
        try:
            state = gateway(str(latest["provider"])).fetch_order(str(latest["provider_order_id"]))
        except CashfreeError:
            state = None
        if state is None or state.status == "active":
            return checkout_payload(latest)
        # The open attempt finished at the provider: apply it (commits) and decide again from fresh rows.
        refresh_charge(db, latest)
        rows = _load_group(db, payment_id, customer, lock=True)
        first, latest = rows[0], rows[-1]
        if any(r["status"] == "successful" for r in rows):
            raise HTTPException(409, "This has already been paid")
    expires = _now() + _ttl()
    if left is not None:
        expires = min(expires, _now() + left)
    customer_row = _customer(db, str(first["customer_id"]))
    pay = _open_order(
        db,
        purpose=str(first["purpose"]),
        customer=customer_row,
        amount_paise=int(first["amount_paise"]),
        subject_id=str(first["subject_id"]),
        booking_id=str(first["booking_id"]) if first.get("booking_id") else None,
        meta={k: v for k, v in _meta(first).items() if k not in ("released", "result")},
        reference=str(_meta(first).get("reference") or str(first["subject_id"])[:8]),
        attempt=int(latest["attempt_no"]) + 1,
        expires_at=expires,
    )
    return checkout_payload(pay)


def _customer(db: Session, user_id: str) -> dict:
    return dict(
        db.execute(
            text("SELECT id, name, email, phone, role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}
        ).mappings().one()
    )


def _subject_blocker(db: Session, pay: dict) -> str | None:
    """Why a charge can no longer be paid (the thing paid for changed). None = still payable."""
    purpose, subject = str(pay["purpose"]), str(pay["subject_id"])
    if purpose == "booking_payment":
        b = db.execute(
            text("SELECT status, payment_status FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": subject}
        ).mappings().first()
        if not b or b["status"] == "cancelled":
            return "This booking was cancelled."
        if b["payment_status"] != "pending":
            return "This booking is already paid."
    elif purpose == "consultation":
        c = db.execute(
            text("SELECT status, payment_status FROM muhurta_consultations WHERE id = CAST(:id AS uuid)"), {"id": subject}
        ).mappings().first()
        if not c or c["payment_status"] != "awaiting_payment":
            return "This consultation request is no longer waiting for payment."
    elif purpose == "seva_registration":
        r = db.execute(
            text("SELECT status, payment_status FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"), {"id": subject}
        ).mappings().first()
        if not r or r["status"] != "pending" or r["payment_status"] != "pending":
            return "This registration is no longer waiting for payment."
    elif purpose == "reschedule_fee":
        b = db.execute(text("SELECT status FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": subject}).mappings().first()
        if not b or b["status"] in ("cancelled", "completed"):
            return "This booking can no longer be rescheduled."
    return None


# ---------------------------------------------------------------- applying verified provider state


def _set(db: Session, payment_id: str, **fields: Any) -> None:
    from app.payments.service import _set_payment

    _set_payment(db, payment_id, **fields)


def _set_group_meta(db: Session, group: str, **values: Any) -> None:
    """Set (or, with None, remove) meta keys on every attempt of a charge, so each row tells its state."""
    drop = [k for k, v in values.items() if v is None]
    keep = {k: v for k, v in values.items() if v is not None}
    db.execute(
        text(
            """
            UPDATE payments SET meta = (meta - CAST(:drop AS text[])) || CAST(:m AS jsonb), updated_at = NOW()
            WHERE purpose <> 'booking' AND (meta->>'group' = :g OR id = CAST(:g AS uuid))
            """
        ),
        {"drop": drop, "m": json.dumps(keep, default=str), "g": group},
    )


def _group_of(pay: dict) -> str:
    return str(_meta(pay).get("group") or pay["id"])


def apply_charge_state(db: Session, payment: dict, order: ProviderOrder) -> dict[str, Any]:
    """Move one charge attempt to match verified provider state. Idempotent; caller commits, then calls
    _run_after(result) for work that must follow the commit (emails, refund submission)."""
    from app.payments.service import _lock_payment, _notify_ops

    pay = _lock_payment(db, str(payment["id"]))
    if pay["status"] in ("successful", "failed", "expired", "cancelled") and pay["verified_at"]:
        if not (pay["status"] != "successful" and any(p.status == "success" for p in order.payments)):
            return {"outcome": "unchanged"}
    expected_amount, expected_currency = int(pay["amount_paise"]), str(pay["currency"] or "INR").upper()
    if order.amount_paise != expected_amount or (order.currency and order.currency != expected_currency):
        _set(db, str(pay["id"]), status="processing", failure_reason="order_amount_mismatch", provider_status=order.raw_status)
        _notify_ops(db, "Payment needs review", f"Order {pay['provider_order_id']}: amount or currency does not match the charge.")
        return {"outcome": "amount_mismatch"}
    success = next((p for p in order.payments if p.status == "success"), None)
    if success:
        if success.amount_paise != expected_amount or (success.currency and success.currency != expected_currency):
            _set(
                db, str(pay["id"]), status="processing", failure_reason="payment_amount_mismatch",
                provider_payment_id=success.provider_payment_id, provider_status=success.raw_status,
            )
            _notify_ops(db, "Payment needs review", f"Order {pay['provider_order_id']}: paid amount does not match the charge.")
            return {"outcome": "amount_mismatch"}
        return _record_success(db, pay, success)
    latest = order.payments[-1] if order.payments else None
    pending = bool(latest and latest.status == "pending")
    if order.status in ("expired", "terminated") and not pending:
        _set(
            db, str(pay["id"]), status="expired" if order.status == "expired" else "cancelled",
            provider_status=order.raw_status, failure_reason=(latest.message if latest else None), verified_at=_now(),
        )
        return {"outcome": order.status}
    _set(
        db, str(pay["id"]), status="processing" if pending else "pending",
        provider_status=(latest.raw_status if latest else order.raw_status),
        failure_reason=(latest.message if latest and latest.status in ("failed", "dropped", "cancelled") else None),
    )
    return {"outcome": "pending" if pending else "open"}


def _record_success(db: Session, pay: dict, success) -> dict[str, Any]:
    from app.payments.service import _notify_ops, queue_refund

    now = _now()
    _set(
        db, str(pay["id"]), status="successful", provider_payment_id=success.provider_payment_id,
        payment_method=success.method, provider_status=success.raw_status, failure_reason=None,
        paid_at=pay.get("paid_at") or now, verified_at=now,
    )
    group = str(_meta(pay).get("group") or pay["id"])
    rows = _group_rows(db, group, lock=True)
    first = rows[0]
    if any(r["id"] != pay["id"] and r["status"] == "successful" and not r.get("duplicate_of") for r in rows):
        # Two attempts of one charge both succeeded: keep the first, give this one back in full.
        keep = next(r for r in rows if r["id"] != pay["id"] and r["status"] == "successful" and not r.get("duplicate_of"))
        db.execute(
            text("UPDATE payments SET duplicate_of = CAST(:o AS uuid) WHERE id = CAST(:p AS uuid)"),
            {"o": str(keep["id"]), "p": str(pay["id"])},
        )
        queue_refund(db, pay, int(pay["amount_paise"]), kind="duplicate_payment", reason="Paid twice for one charge")
        _notify_ops(db, "Duplicate payment refunded", f"Charge {pay['provider_order_id']} was paid twice; the second payment is being refunded.")
        return {"outcome": "duplicate_refunded", "refund_payment": str(pay["id"])}
    released = _meta(first).get("released")
    purpose = str(pay["purpose"])
    try:
        with db.begin_nested():
            after = _fulfil(db, pay, first, late=bool(released))
    except _CannotFulfil as why:
        queue_refund(db, pay, int(pay["amount_paise"]), kind="late_payment", reason=str(why)[:200])
        _set_group_meta(db, group, result="refunded", result_reason=str(why)[:200])
        _set(db, str(pay["id"]), failure_reason=f"refunded: {why}"[:300])
        _notify_customer_refund(db, pay, str(why))
        _notify_ops(db, "Payment refunded", f"{NOTE[purpose]} {pay['provider_order_id']} could not be completed ({why}); refunding in full.")
        return {"outcome": "refunded", "reason": str(why), "refund_payment": str(pay["id"])}
    _set_group_meta(db, group, result="fulfilled", released=None)
    return {"outcome": "late_fulfilled" if released else "fulfilled", "after_commit": after}


class _CannotFulfil(Exception):
    pass


def _fulfil(db: Session, pay: dict, first: dict, *, late: bool) -> Callable[[], None] | None:
    purpose, subject = str(pay["purpose"]), str(pay["subject_id"])
    meta = _meta(first)
    customer = _customer(db, str(pay["customer_id"]))
    if purpose == "reschedule_fee":
        from app.booking_reschedule import apply_reschedule, reschedule_quote

        try:
            quote = reschedule_quote(
                db, subject, customer, date.fromisoformat(meta["new_date"]), time.fromisoformat(meta["new_time"]),
                expected_fee_paise=int(meta["fee"]),
            )
        except HTTPException as e:
            raise _CannotFulfil(f"the booking could not be moved: {e.detail}") from e
        if int(quote["prior"]) + 1 != int(meta.get("seq") or 0):
            raise _CannotFulfil("the booking was already rescheduled")
        _result, after = apply_reschedule(db, quote, customer, paid_online=True)
        return after
    if late and purpose in WINDOWED:
        raise _CannotFulfil("paid after the payment window closed")
    if purpose == "booking_payment":
        b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": subject}).mappings().first()
        if not b or b["status"] == "cancelled" or b["payment_status"] != "pending":
            raise _CannotFulfil("the booking was cancelled or already paid")
        db.execute(
            text(
                """
                UPDATE bookings SET payment_status = 'paid', paid_at = NOW(), payment_provider = :prov,
                  status = CASE WHEN status = 'pending' THEN 'pending_acceptance' ELSE status END
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"prov": pay["provider"], "id": subject},
        )
        from app.routers.bookings import after_pending_booking_paid

        _payment_received_notification(db, dict(b))
        return lambda: after_pending_booking_paid(db, subject, str(pay["customer_id"]), method="Online", transaction_id=str(pay["provider_order_id"]))
    if purpose == "consultation":
        updated = db.execute(
            text(
                """
                UPDATE muhurta_consultations SET payment_status = 'paid', status = 'requested', updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND payment_status = 'awaiting_payment'
                RETURNING consultation_number, appointment_date, appointment_time
                """
            ),
            {"id": subject},
        ).mappings().first()
        if not updated:
            raise _CannotFulfil("the consultation request was closed")
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(
            db, title="New Muhurtham Consultation",
            body=f"{updated['consultation_number']} — paid online, on {updated['appointment_date']} at {str(updated['appointment_time'])[:5]}.",
            category="muhurtham", link="/admin/muhurtham",
        )
        return None
    if purpose == "seva_registration":
        updated = db.execute(
            text(
                """
                UPDATE seva_event_registrations SET status = 'confirmed', payment_status = 'paid', updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND status = 'pending' AND payment_status = 'pending'
                RETURNING id
                """
            ),
            {"id": subject},
        ).first()
        if not updated:
            raise _CannotFulfil("the registration was closed")
        reg = db.execute(
            text("SELECT registration_number, event_id, service_type FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
            {"id": subject},
        ).mappings().one()
        try:
            from app.routers.notifications import create_notification

            stype = reg["service_type"]
            create_notification(
                db,
                user_id=str(pay["customer_id"]),
                title="Registration Confirmed",
                body=f"Your registration {reg['registration_number']} is confirmed.",
                category="booking",
                link=f"/customer/bookings?type={'chadhava' if stype == 'chadhava' else 'pravachan' if stype == 'pravachan' else 'seva_puja'}",
                message_key="sevaRegistrationConfirmed",
                message_vars={"number": reg["registration_number"], "event_id": str(reg["event_id"])},
            )
        except Exception:
            logger.exception("charge_seva_notification_failed registration=%s", subject)
        return None
    raise _CannotFulfil(f"unknown charge {purpose}")


def _payment_received_notification(db: Session, b: dict) -> None:
    try:
        from app.routers.notifications import create_notification, customer_booking_link

        num = str(b.get("booking_number") or str(b["id"])[:8])
        create_notification(
            db, user_id=str(b["customer_id"]), title="Payment Received",
            body=f"Payment for booking {num} was successful.", category="payment",
            link=customer_booking_link(str(b["id"])), extra_data={"booking_id": str(b["id"])},
            message_key="paymentOk", message_vars={"number": num},
        )
    except Exception:
        logger.exception("charge_payment_notification_failed booking=%s", b.get("id"))


def _notify_customer_refund(db: Session, pay: dict, why: str) -> None:
    try:
        from app.routers.notifications import create_notification

        create_notification(
            db, user_id=str(pay["customer_id"]), title="Payment refunded",
            body=f"We could not complete your {NOTE[str(pay['purpose'])].replace('B-Seva ', '')} ({why}). "
            "The full amount is being refunded to your original payment method.",
            category="payment",
        )
    except Exception:
        logger.exception("charge_refund_notification_failed payment=%s", pay.get("id"))


def _run_after(result: dict) -> None:
    fn = result.get("after_commit")
    if callable(fn):
        try:
            fn()
        except Exception:
            logger.exception("charge_after_commit_failed")


# ---------------------------------------------------------------- closing unpaid charges


def _release(db: Session, first: dict, reason: str) -> None:
    """The customer gave up, or the window passed: let go of what was held for them. Idempotent."""
    purpose, subject = str(first["purpose"]), str(first["subject_id"])
    if purpose == "consultation":
        db.execute(
            text(
                """
                UPDATE muhurta_consultations SET status = 'cancelled', payment_status = 'failed', updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND payment_status = 'awaiting_payment'
                """
            ),
            {"id": subject},
        )
    elif purpose == "seva_registration":
        row = db.execute(
            text(
                """
                UPDATE seva_event_registrations SET status = 'cancelled', payment_status = 'failed',
                  cancelled_at = NOW(), updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND status = 'pending' AND payment_status = 'pending'
                RETURNING event_id
                """
            ),
            {"id": subject},
        ).first()
        if row:
            db.execute(
                text(
                    """
                    UPDATE seva_events SET registration_count = GREATEST(0, registration_count - 1), updated_at = NOW()
                    WHERE id = CAST(:eid AS uuid)
                    """
                ),
                {"eid": str(row[0])},
            )
    # reschedule_fee and booking_payment hold nothing: the booking is unchanged and can be paid again.
    _set_group_meta(db, _group_of(first), released=reason)


def charge_status(db: Session, payment_id: str, customer: dict, *, verify: bool = True) -> dict:
    """What the customer sees after checkout. Verified with the gateway server-side."""
    rows = _load_group(db, payment_id, customer)
    latest = rows[-1]
    if verify and latest["status"] in ("pending", "processing") and latest.get("provider_order_id"):
        refresh_charge(db, latest)
        rows = _load_group(db, payment_id, customer)
        latest = rows[-1]
    first = rows[0]
    meta = _meta(first)
    paid = next((r for r in rows if r["status"] == "successful" and not r.get("duplicate_of")), None)
    result = meta.get("result")
    if paid and result != "refunded":
        view = "paid"
    elif result == "refunded":
        view = "refunded"
    elif meta.get("released"):
        view = "closed"
    elif latest["status"] == "processing":
        view = "pending"
    else:
        left = _window_left(first)
        view = "closed" if left is not None and left <= timedelta(0) else "failed"
    return {
        "payment_id": str(meta.get("group") or first["id"]),
        "purpose": first["purpose"],
        "status": view,
        "closed_reason": meta.get("released"),
        "refund_reason": meta.get("result_reason") if result == "refunded" else None,
        "amount_paise": int(first["amount_paise"]),
        **_subject_summary(db, first),
        "attempt": {
            "status": latest["status"],
            "attempt_no": latest["attempt_no"],
            "provider_status": latest.get("provider_status"),
            "message": latest.get("failure_reason"),
        },
    }


def _subject_summary(db: Session, first: dict) -> dict:
    purpose, subject = str(first["purpose"]), str(first["subject_id"])
    if purpose in ("reschedule_fee", "booking_payment"):
        num = db.execute(text("SELECT booking_number FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": subject}).scalar()
        return {"reference": num, "booking_id": subject, "link": f"/booking/{subject}"}
    if purpose == "consultation":
        num = db.execute(
            text("SELECT consultation_number FROM muhurta_consultations WHERE id = CAST(:id AS uuid)"), {"id": subject}
        ).scalar()
        return {"reference": num, "consultation_id": subject, "link": "/astrology"}
    num, event_id = db.execute(
        text("SELECT registration_number, event_id FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"), {"id": subject}
    ).first() or (None, None)
    return {"reference": num, "registration_id": subject, "event_id": str(event_id) if event_id else None,
            "link": f"/seva/events/{event_id}" if event_id else "/seva"}


def refresh_charge(db: Session, payment: dict) -> dict:
    """Fetch the order from its provider and apply it. Commits; runs after-commit work and refunds."""
    from app.payments.service import submit_open_refunds

    try:
        state = gateway(str(payment["provider"])).fetch_order(str(payment["provider_order_id"]))
    except CashfreeError as e:
        db.rollback()
        db.execute(
            text("UPDATE payments SET last_checked_at = NOW(), check_attempts = check_attempts + 1 WHERE id = CAST(:id AS uuid)"),
            {"id": str(payment["id"])},
        )
        db.commit()
        return {"outcome": "provider_unavailable", "retryable": e.retryable}
    out = apply_charge_state(db, payment, state)
    db.commit()
    _run_after(out)
    submit_open_refunds(db, payment_id=str(payment["id"]))
    return out


def abandon_charge(db: Session, payment_id: str, customer: dict) -> dict:
    """Customer gives up before paying. Verifies first: a charge that was paid is never closed here. Commits."""
    db.commit()
    status = charge_status(db, payment_id, customer, verify=True)
    if status["status"] == "paid":
        return {"ok": False, "paid": True}
    rows = _load_group(db, payment_id, customer, lock=True)
    for r in rows:
        if r["status"] in ("pending", "processing") and r.get("provider_order_id"):
            try:
                gateway(str(r["provider"])).terminate_order(str(r["provider_order_id"]))
            except CashfreeError:
                pass
    db.execute(
        text("UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE id = ANY(CAST(:ids AS uuid[])) AND status = 'pending'"),
        {"ids": [str(r["id"]) for r in rows]},
    )
    if not _meta(rows[0]).get("released"):
        _release(db, rows[0], "abandoned")
    db.commit()
    return {"ok": True, "paid": False}


def expire_open_charges(db: Session, *, limit: int = 50) -> dict:
    """Close charges whose payment time ran out. A payment still pending at the provider gets a grace period;
    a success found here completes the charge instead. Commits per charge."""
    from app.payments.service import submit_open_refunds

    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (meta->>'group') *
            FROM payments
            WHERE purpose <> 'booking' AND meta ? 'group' AND NOT (meta ? 'released') AND NOT (meta ? 'result')
            ORDER BY meta->>'group', attempt_no DESC
            """
        )
    ).mappings().all()
    out = {"checked": 0, "closed": 0, "completed": 0, "waiting": 0}
    now = _now()
    for latest in rows[: limit * 4]:
        latest = dict(latest)
        group_rows = _group_rows(db, str(_meta(latest)["group"]))
        first = group_rows[0]
        window = _window_left(first)
        expired = (window is not None and window <= timedelta(0)) or (window is None and latest["expires_at"] and latest["expires_at"] < now)
        if not expired or any(r["status"] == "successful" for r in group_rows):
            continue
        out["checked"] += 1
        if out["checked"] > limit:
            break
        waiting = False
        for p in group_rows:
            if p["status"] not in ("pending", "processing") or not p.get("provider_order_id"):
                continue
            try:
                state = gateway(str(p["provider"])).fetch_order(str(p["provider_order_id"]))
            except CashfreeError:
                waiting = True
                continue
            res = apply_charge_state(db, p, state)
            db.commit()
            _run_after(res)
            submit_open_refunds(db, payment_id=str(p["id"]))
            if res["outcome"] in ("fulfilled", "late_fulfilled", "refunded", "duplicate_refunded"):
                out["completed"] += 1
                waiting = False
                break
            if res["outcome"] in ("pending", "amount_mismatch", "open"):
                waiting = True
                if res["outcome"] == "open" and state.status == "active":
                    try:
                        gateway(str(p["provider"])).terminate_order(str(p["provider_order_id"]))
                    except CashfreeError:
                        pass
        group_rows = _group_rows(db, str(_meta(latest)["group"]), lock=True)
        first = group_rows[0]
        if any(r["status"] == "successful" for r in group_rows) or _meta(first).get("released"):
            db.commit()
            continue
        ends = (now + window) if window is not None else latest["expires_at"]
        if waiting and ends + timedelta(minutes=PENDING_GRACE_MINUTES) > now:
            out["waiting"] += 1
            db.commit()
            continue
        db.execute(
            text("UPDATE payments SET status = 'expired', updated_at = NOW() WHERE id = ANY(CAST(:ids AS uuid[])) AND status = 'pending'"),
            {"ids": [str(r["id"]) for r in group_rows]},
        )
        _release(db, first, "expired")
        db.commit()
        out["closed"] += 1
    return out


def paid_charge_for(db: Session, purpose: str, subject_id: str) -> dict | None:
    """The successful (non-duplicate) gateway payment for a subject, e.g. a paid Seva registration."""
    row = db.execute(
        text(
            """
            SELECT * FROM payments WHERE purpose = :p AND subject_id = CAST(:s AS uuid)
              AND status = 'successful' AND duplicate_of IS NULL
            ORDER BY paid_at NULLS LAST, created_at LIMIT 1
            """
        ),
        {"p": purpose, "s": subject_id},
    ).mappings().first()
    return dict(row) if row else None


def open_charge_for(db: Session, purpose: str, subject_id: str) -> dict | None:
    """The newest unfinished charge for a subject (to resume instead of starting a second one)."""
    row = db.execute(
        text(
            """
            SELECT * FROM payments WHERE purpose = :p AND subject_id = CAST(:s AS uuid)
              AND NOT (meta ? 'released') AND NOT (meta ? 'result')
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"p": purpose, "s": subject_id},
    ).mappings().first()
    return dict(row) if row else None
