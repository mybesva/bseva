"""Online payments: customer checkout and status, the Cashfree PG webhook, and Super Admin payment views."""
from __future__ import annotations

import hashlib
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.audit import write_audit
from app.config import settings
from app.db import SessionLocal, get_db
from app.deps import require_roles
from app.domain import row_dict
from app.payments import service
from app.payments.cashfree_pg import CashfreeError
from app.payments.providers import PROVIDERS, active_gateway, gateway
from app.rbac import require_permission, require_super_admin

router = APIRouter(tags=["payments"])
logger = logging.getLogger(__name__)


@router.get("/payments/config")
def payment_config(user=Depends(require_roles("customer"))):
    provider = active_gateway()
    return {
        "online_enabled": provider is not None,
        "provider": provider.name if provider else None,
        "environment": provider.environment() if provider else None,
        "wallet_enabled": True,
    }


@router.post("/payments/bookings/{booking_id}/checkout")
def resume_checkout(booking_id: str, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    out = service.resume_checkout(db, booking_id, user)
    db.commit()
    return out


@router.get("/payments/bookings/{booking_id}/status")
def payment_status(booking_id: str, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    """Always verified with the gateway server-side; the client's own redirect result is never trusted."""
    return service.booking_payment_status(db, booking_id, user, verify=True)


@router.post("/payments/bookings/{booking_id}/abandon")
def abandon_checkout(booking_id: str, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    """Customer gives up before paying. A payment that still succeeds later is refunded automatically."""
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": booking_id}).mappings().first()
    if not b or str(b["customer_id"]) != str(user["id"]):
        raise HTTPException(404, "Booking not found")
    if b["status"] != "awaiting_payment":
        raise HTTPException(409, "This booking is not waiting for payment")
    out = service.abandon_unpaid_booking(db, booking_id, user, reason="Customer left the payment page")
    if out["paid"]:
        raise HTTPException(409, "This booking has already been paid")
    return {"ok": out["ok"]}


# ---------------------------------------------------------------- webhook


def _event_fields(payload: dict) -> tuple[str | None, str | None, str | None]:
    data = payload.get("data") or {}
    order = data.get("order") or {}
    refund = data.get("refund") or data.get("auto_refund") or {}
    order_id = order.get("order_id") or refund.get("order_id")
    return payload.get("type"), order_id, refund.get("refund_id")


def _process_cashfree_event(raw: bytes, headers: dict[str, str]) -> tuple[int, dict]:
    from app.payments.cashfree_pg import webhook_signature_variant

    variant = webhook_signature_variant(headers.get("x-webhook-timestamp"), headers.get("x-webhook-signature"), raw)
    valid = variant is not None
    stamp = headers.get("x-webhook-timestamp") or ""
    event_key = headers.get("x-idempotency-header") or hashlib.sha256(stamp.encode() + b"." + raw).hexdigest()
    try:
        payload = json.loads(raw.decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        payload = {}
    event_type, order_id, refund_id = _event_fields(payload if isinstance(payload, dict) else {})
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                INSERT INTO payment_events (provider, channel, event_key, event_type, reference, signature_valid, payload)
                VALUES ('cashfree', 'pg', :k, :t, :ref, :valid, CAST(:payload AS jsonb))
                ON CONFLICT (provider, channel, event_key) DO NOTHING
                RETURNING id
                """
            ),
            {
                "k": event_key if valid else f"invalid:{event_key}",
                "t": (event_type or "")[:80] or None,
                "ref": (order_id or "")[:80] or None,
                "valid": valid,
                # Unverified bodies are not stored: anyone can post to this URL.
                "payload": json.dumps(payload) if valid else None,
            },
        ).first()
        if not row:
            existing = db.execute(
                text("SELECT id, processed_at FROM payment_events WHERE provider = 'cashfree' AND channel = 'pg' AND event_key = :k"),
                {"k": event_key if valid else f"invalid:{event_key}"},
            ).first()
            db.commit()
            if not valid or (existing and existing[1]):
                return (401, {"ok": False}) if not valid else (200, {"ok": True, "duplicate": True})
            event_id = existing[0]
        else:
            event_id = row[0]
            db.commit()
        if not valid:
            logger.warning("cashfree_webhook_bad_signature type=%s", event_type)
            return 401, {"ok": False}
        logger.info("cashfree_webhook_verified type=%s signature_form=%s", event_type, variant)
        outcome = "ignored"
        if refund_id and order_id and (event_type or "").startswith(("REFUND", "AUTO_REFUND")):
            outcome = service.apply_refund_webhook(db, "cashfree", order_id, refund_id)
            db.commit()
        elif order_id and (event_type or "").startswith("PAYMENT"):
            pay = service.payment_by_order(db, "cashfree", order_id)
            # The payload only says "look again": the state applied is re-fetched from Cashfree.
            outcome = service.refresh_payment(db, pay)["outcome"] if pay else "unknown_order"
        db.execute(
            text("UPDATE payment_events SET processed_at = NOW(), outcome = :o WHERE id = :id"),
            # The signature form is kept with the event so sandbox deliveries show which one Cashfree uses.
            {"o": f"{outcome}|sig:{variant}"[:60], "id": event_id},
        )
        db.commit()
        return 200, {"ok": True, "outcome": outcome}
    except Exception:
        db.rollback()
        logger.exception("cashfree_webhook_failed type=%s order=%s", event_type, order_id)
        # Not marked processed, so Cashfree's retry (or the reconciler) applies it again.
        return 500, {"ok": False}
    finally:
        db.close()


@router.post("/payments/webhooks/cashfree", include_in_schema=False)
async def cashfree_webhook(request: Request):
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    status, body = await run_in_threadpool(_process_cashfree_event, raw, headers)
    return JSONResponse(body, status_code=status)


# ---------------------------------------------------------------- Super Admin


def _gateway_health() -> dict:
    return {
        name: {"configured": p.configured(), "environment": p.environment()} for name, p in PROVIDERS.items()
    } | {
        "selected_gateway": (settings.payment_gateway or "").strip().lower() or None,
        "payouts": {
            "configured": settings.cashfree_payouts_configured,
            "environment": (settings.cashfree_payout_env or "sandbox").strip().lower(),
            "two_factor_key": bool(settings.cashfree_payout_public_key or settings.cashfree_payout_public_key_file),
        },
    }


@router.get("/admin/payments/summary")
def admin_payment_summary(user=Depends(require_permission("view_financials")), db: Session = Depends(get_db)):
    counts = lambda sql: {r[0]: int(r[1]) for r in db.execute(text(sql)).all()}  # noqa: E731
    return {
        "gateways": _gateway_health(),
        "payments": counts("SELECT provider || ':' || status, COUNT(*) FROM payments GROUP BY 1"),
        "refunds": counts("SELECT provider || ':' || status, COUNT(*) FROM refunds GROUP BY 1"),
        "payouts": counts("SELECT status, COUNT(*) FROM payouts GROUP BY 1"),
        "awaiting_payment_bookings": int(
            db.execute(text("SELECT COUNT(*) FROM bookings WHERE status = 'awaiting_payment'")).scalar() or 0
        ),
        "needs_review": {
            "payments": int(db.execute(text("SELECT COUNT(*) FROM payments WHERE failure_reason LIKE '%mismatch%' AND status = 'processing'")).scalar() or 0),
            "refunds": int(db.execute(text("SELECT COUNT(*) FROM refunds WHERE status IN ('failed', 'manual_review')")).scalar() or 0),
            "payouts": int(db.execute(text("SELECT COUNT(*) FROM payouts WHERE status IN ('failed', 'reversed')")).scalar() or 0),
            "booking_follow_ups_failed": int(db.execute(text("SELECT COUNT(*) FROM booking_side_effects WHERE status = 'failed'")).scalar() or 0),
            "booking_follow_ups_pending": int(
                db.execute(text("SELECT COUNT(*) FROM booking_side_effects WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'")).scalar() or 0
            ),
            "unverified_webhooks_24h": int(
                db.execute(text("SELECT COUNT(*) FROM payment_events WHERE NOT signature_valid AND received_at > NOW() - INTERVAL '24 hours'")).scalar() or 0
            ),
        },
    }


@router.get("/admin/payments/transactions")
def admin_list_payments(
    status: str | None = None,
    provider: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_permission("view_financials")),
    db: Session = Depends(get_db),
):
    where, params = ["1=1"], {"lim": limit, "off": (page - 1) * limit}
    if status:
        where.append("p.status = :status")
        params["status"] = status
    if provider:
        where.append("p.provider = :provider")
        params["provider"] = provider
    if q:
        where.append("(b.booking_number ILIKE :q OR p.provider_order_id ILIKE :q OR p.provider_payment_id ILIKE :q OR cu.name ILIKE :q)")
        params["q"] = f"%{q.strip()}%"
    clause = " AND ".join(where)
    rows = db.execute(
        text(
            f"""
            SELECT p.id, p.booking_id, p.provider, p.status, p.amount_paise, p.currency, p.provider_order_id,
                   p.provider_payment_id, p.payment_method, p.provider_status, p.failure_reason, p.attempt_no,
                   p.duplicate_of, p.created_at, p.paid_at, p.verified_at, p.last_checked_at,
                   b.booking_number, b.status AS booking_status, b.payment_status AS booking_payment_status,
                   cu.name AS customer_name,
                   (SELECT COALESCE(SUM(r.amount_paise), 0) FROM refunds r WHERE r.payment_id = p.id AND r.status = 'successful') AS refunded_paise
            FROM payments p
            LEFT JOIN bookings b ON b.id = p.booking_id
            LEFT JOIN users cu ON cu.id = COALESCE(p.customer_id, b.customer_id)
            WHERE {clause}
            ORDER BY p.created_at DESC LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).mappings().all()
    total = db.execute(
        text(f"SELECT COUNT(*) FROM payments p LEFT JOIN bookings b ON b.id = p.booking_id LEFT JOIN users cu ON cu.id = COALESCE(p.customer_id, b.customer_id) WHERE {clause}"),
        params,
    ).scalar()
    return {"items": [row_dict(r) for r in rows], "total": int(total or 0), "page": page, "limit": limit}


@router.get("/admin/payments/refunds")
def admin_list_refunds(
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_permission("view_financials")),
    db: Session = Depends(get_db),
):
    params = {"lim": limit, "off": (page - 1) * limit, "status": status}
    rows = db.execute(
        text(
            """
            SELECT r.*, b.booking_number, p.provider_order_id, p.provider_payment_id
            FROM refunds r JOIN payments p ON p.id = r.payment_id LEFT JOIN bookings b ON b.id = r.booking_id
            WHERE (CAST(:status AS text) IS NULL OR r.status = :status)
            ORDER BY r.created_at DESC LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).mappings().all()
    return {"items": [row_dict(r) for r in rows]}


@router.post("/admin/payments/{payment_id}/verify")
def admin_verify_payment(payment_id: str, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    pay = db.execute(text("SELECT * FROM payments WHERE id = CAST(:id AS uuid)"), {"id": payment_id}).mappings().first()
    if not pay:
        raise HTTPException(404, "Payment not found")
    if not pay["provider_order_id"]:
        return {"outcome": "wallet_payment", "status": pay["status"]}
    out = service.refresh_payment(db, dict(pay))
    write_audit(db, str(user["id"]), "payment_verify", "payment", payment_id, reason=out["outcome"])
    db.commit()
    return out


@router.post("/admin/payments/refunds/{refund_id}/retry")
def admin_retry_refund(refund_id: str, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    """Re-check an open refund, or re-issue a failed one for the same amount (never above what is left)."""
    r = db.execute(text("SELECT * FROM refunds WHERE refund_id = :r"), {"r": refund_id}).mappings().first()
    if not r:
        raise HTTPException(404, "Refund not found")
    if r["status"] in ("pending", "processing"):
        out = service.submit_refund(db, refund_id)
    elif r["status"] in ("failed", "manual_review"):
        pay = db.execute(text("SELECT * FROM payments WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": str(r["payment_id"])}).mappings().one()
        db.execute(
            text("UPDATE refunds SET status = 'cancelled', updated_at = NOW() WHERE id = CAST(:id AS uuid) AND status IN ('failed', 'manual_review')"),
            {"id": str(r["id"])},
        )
        new = service.queue_refund(
            db, dict(pay), int(r["amount_paise"]), kind=r["kind"] if r["kind"] != "cancellation" else "manual",
            reason=f"Retry of {refund_id}", initiated_by=str(user["id"]),
        )
        if not new:
            db.rollback()
            raise HTTPException(409, "Nothing is left to refund on this payment")
        write_audit(db, str(user["id"]), "refund_retry", "refund", refund_id, reason=new["refund_id"])
        db.commit()
        out = service.submit_refund(db, new["refund_id"])
    else:
        raise HTTPException(409, f"Refund is {r['status']}")
    return out


@router.post("/admin/payments/reconcile")
def admin_reconcile(user=Depends(require_super_admin), db: Session = Depends(get_db)):
    from app.payouts.service import run_payout_jobs

    return {**service.run_payment_jobs(db), "payouts": run_payout_jobs(db)}


@router.get("/admin/payments/methods")
def admin_payment_methods(amount_paise: int = Query(100000, ge=100), user=Depends(require_super_admin)):
    """Which methods the Cashfree account can actually offer for an amount (verifies activation)."""
    from app.payments import cashfree_pg

    if not settings.cashfree_pg_configured:
        raise HTTPException(409, "Cashfree Payment Gateway is not configured")
    try:
        rows = cashfree_pg.eligible_payment_methods(amount_paise)
    except CashfreeError as e:
        raise HTTPException(502, f"Cashfree: {e}") from e
    return {
        "environment": settings.cashfree_pg_env,
        "methods": [
            {"method": r.get("entity_value"), "eligible": bool(r.get("eligibility")), "type": r.get("entity_type")}
            for r in rows
        ],
    }


@router.get("/admin/payments/events")
def admin_payment_events(
    limit: int = Query(50, ge=1, le=200), user=Depends(require_super_admin), db: Session = Depends(get_db)
):
    rows = db.execute(
        text(
            """
            SELECT id, provider, channel, event_type, reference, signature_valid, outcome, received_at, processed_at
            FROM payment_events ORDER BY received_at DESC LIMIT :lim
            """
        ),
        {"lim": limit},
    ).mappings().all()
    return {"items": [row_dict(r) for r in rows]}


@router.get("/admin/payments/follow-ups")
def admin_booking_follow_ups(
    status: str = Query("failed"), limit: int = Query(50, ge=1, le=200),
    user=Depends(require_super_admin), db: Session = Depends(get_db),
):
    """Post-payment booking tasks (offers, notifications, email, invoice) that failed or are overdue."""
    rows = db.execute(
        text(
            """
            SELECT e.id, e.booking_id, e.effect, e.status, e.attempts, e.last_error, e.next_attempt_at, e.created_at,
                   b.booking_number
            FROM booking_side_effects e JOIN bookings b ON b.id = e.booking_id
            WHERE e.status = :st ORDER BY e.created_at DESC LIMIT :lim
            """
        ),
        {"st": status, "lim": limit},
    ).mappings().all()
    return {"items": [row_dict(r) for r in rows]}


@router.post("/admin/payments/follow-ups/{effect_id}/retry")
def admin_retry_follow_up(effect_id: str, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    from app.booking_finalize import run_effect

    row = db.execute(
        text(
            """
            UPDATE booking_side_effects SET status = 'pending', attempts = 0, next_attempt_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid) AND status = 'failed' RETURNING booking_id, effect
            """
        ),
        {"id": effect_id},
    ).first()
    if not row:
        raise HTTPException(409, "Only a failed task can be retried")
    write_audit(db, str(user["id"]), "booking_follow_up_retry", "booking", str(row[0]), reason=str(row[1]))
    db.commit()
    out = run_effect(db, str(row[0]), str(row[1]))
    db.commit()
    status = db.execute(text("SELECT status, last_error FROM booking_side_effects WHERE id = CAST(:id AS uuid)"), {"id": effect_id}).mappings().one()
    return {"ran": out is not None, "status": status["status"], "last_error": status["last_error"]}
