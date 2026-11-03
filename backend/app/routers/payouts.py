"""Super Admin pujari payouts (bank/UPI via Cashfree Payouts) and the Payouts webhook."""
from __future__ import annotations

import hashlib
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import rate_limit, sensitive_auth as sa
from app.config import settings
from app.db import SessionLocal, get_db
from app.domain import row_dict
from app.payouts import cashfree_payouts as cf
from app.payouts import service
from app.rbac import require_super_admin
from app.settlement_cycle import payout_mode

router = APIRouter(tags=["payouts"])
logger = logging.getLogger(__name__)
PAYOUT_ACTION = "settlement_payout"


class PayoutIn(BaseModel):
    challenge_id: UUID
    otp: str = Field(max_length=12)
    mpin: str = Field(max_length=12)


@router.get("/admin/payouts")
def list_payouts(
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT po.id, po.settlement_id, po.transfer_id, po.provider_transfer_id, po.transfer_mode, po.amount_paise,
                   po.status, po.provider_status, po.status_detail, po.utr, po.attempt_no, po.created_at, po.completed_at,
                   po.last_checked_at, pu.name AS pujari_name, b.booking_number, pb.masked_details AS destination,
                   ini.name AS initiated_by_name
            FROM payouts po
            JOIN settlements s ON s.id = po.settlement_id
            LEFT JOIN bookings b ON b.id = s.booking_id
            LEFT JOIN users pu ON pu.id = po.pujari_id
            LEFT JOIN users ini ON ini.id = po.initiated_by
            LEFT JOIN payout_beneficiaries pb ON pb.beneficiary_id = po.beneficiary_id
            WHERE (CAST(:status AS text) IS NULL OR po.status = :status)
            ORDER BY po.created_at DESC LIMIT :lim OFFSET :off
            """
        ),
        {"status": status, "lim": limit, "off": (page - 1) * limit},
    ).mappings().all()
    return {
        "items": [row_dict(r) for r in rows],
        "mode": payout_mode(db),
        "configured": settings.cashfree_payouts_configured,
        "environment": settings.cashfree_payout_env,
    }


@router.get("/admin/payouts/settlements/{settlement_id}/preview")
def preview_payout(settlement_id: str, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    s = sa.settlement_for_action(db, settlement_id)
    return {
        "settlement_id": settlement_id,
        "amount_paise": int(s["settlement_amount_paise"] or 0),
        "status": s["status"],
        "due_date": s["due_date"],
        "mode": payout_mode(db),
        "configured": settings.cashfree_payouts_configured,
        "environment": settings.cashfree_payout_env,
        **service.payout_preview(db, s),
    }


@router.post("/admin/payouts/settlements/{settlement_id}")
def create_payout(
    settlement_id: str,
    body: PayoutIn,
    request: Request,
    user=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    ip = rate_limit.client_ip(request)
    if payout_mode(db) != "bank":
        raise HTTPException(409, "Bank payouts are off: settlements are paid to the pujari wallet (settlement_payout_mode)")
    if not settings.cashfree_payouts_configured:
        raise HTTPException(409, "Cashfree Payouts is not configured")
    try:
        s = sa.settlement_for_action(db, settlement_id)
    except HTTPException as e:
        if e.status_code == 400:
            sa.log_failure(db, user, PAYOUT_ACTION, str(e.detail), settlement_id=settlement_id, ip=ip)
        raise
    amount = int(s["settlement_amount_paise"] or 0)
    reference = service.payout_reference(db, s)
    expected_net = service.payout_split(db, s)["net_paise"]
    sa.verify_challenge(
        db, user, challenge_id=str(body.challenge_id), otp=body.otp, mpin=body.mpin, action=PAYOUT_ACTION,
        audit_action=PAYOUT_ACTION, ip=ip, settlement_id=settlement_id, amount_paise=amount, reference=reference,
    )
    sa.log_event(db, user, "approved", "success", settlement_id=settlement_id, amount_paise=amount, reference=reference, ip=ip)
    db.commit()
    try:
        return service.initiate_payout(db, user, settlement_id, ip=ip, expected_net=expected_net)
    except HTTPException as e:
        sa.log_failure(db, user, PAYOUT_ACTION, str(e.detail)[:200], settlement_id=settlement_id, amount_paise=amount, ip=ip)
        raise


@router.post("/admin/payouts/{payout_id}/refresh")
def refresh_payout(payout_id: str, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    p = db.execute(text("SELECT * FROM payouts WHERE id = CAST(:id AS uuid)"), {"id": payout_id}).mappings().first()
    if not p:
        raise HTTPException(404, "Payout not found")
    return service.refresh_payout(db, dict(p))


def _process_event(raw: bytes, headers: dict[str, str]) -> tuple[int, dict]:
    valid = cf.verify_webhook(headers.get("x-webhook-timestamp"), headers.get("x-webhook-signature"), raw)
    key = hashlib.sha256((headers.get("x-webhook-timestamp") or "").encode() + b"." + raw).hexdigest()
    try:
        payload = json.loads(raw.decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        payload = {}
    data = payload.get("data") if isinstance(payload, dict) else None
    transfer_id = (data or {}).get("transfer_id") if isinstance(data, dict) else None
    event_type = payload.get("type") if isinstance(payload, dict) else None
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                INSERT INTO payment_events (provider, channel, event_key, event_type, reference, signature_valid, payload)
                VALUES ('cashfree', 'payouts', :k, :t, :ref, :v, CAST(:payload AS jsonb))
                ON CONFLICT (provider, channel, event_key) DO NOTHING RETURNING id
                """
            ),
            {
                "k": key if valid else f"invalid:{key}", "t": (event_type or "")[:80] or None,
                "ref": (transfer_id or "")[:80] or None, "v": valid, "payload": json.dumps(payload) if valid else None,
            },
        ).first()
        if not row:
            existing = db.execute(
                text("SELECT id, processed_at FROM payment_events WHERE provider = 'cashfree' AND channel = 'payouts' AND event_key = :k"),
                {"k": key if valid else f"invalid:{key}"},
            ).first()
            db.commit()
            if not valid or (existing and existing[1]):
                return (401, {"ok": False}) if not valid else (200, {"ok": True, "duplicate": True})
            event_id = existing[0]
        else:
            event_id = row[0]
            db.commit()
        if not valid:
            logger.warning("cashfree_payout_webhook_bad_signature type=%s", event_type)
            return 401, {"ok": False}
        outcome = "ignored"
        payout = service.payout_by_transfer(db, transfer_id) if transfer_id else None
        if payout:
            # Re-read from Cashfree; the payload alone never marks a payout paid.
            outcome = service.refresh_payout(db, payout)["status"]
        elif transfer_id:
            outcome = "unknown_transfer"
        db.execute(text("UPDATE payment_events SET processed_at = NOW(), outcome = :o WHERE id = :id"), {"o": outcome, "id": event_id})
        db.commit()
        return 200, {"ok": True, "outcome": outcome}
    except Exception:
        db.rollback()
        logger.exception("cashfree_payout_webhook_failed transfer=%s", transfer_id)
        return 500, {"ok": False}
    finally:
        db.close()


@router.post("/payouts/webhooks/cashfree", include_in_schema=False)
async def cashfree_payout_webhook(request: Request):
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    status, body = await run_in_threadpool(_process_event, raw, headers)
    return JSONResponse(body, status_code=status)
