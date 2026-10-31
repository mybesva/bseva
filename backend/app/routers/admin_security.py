"""Super Admin Security Settings: MPIN management, OTP challenges and the security audit log."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import rate_limit, sensitive_auth as sa
from app.db import get_db
from app.domain import row_dict
from app.rbac import require_super_admin

router = APIRouter(prefix="/admin/security", tags=["security"])


class ChallengeIn(BaseModel):
    action: str
    settlement_id: UUID | None = None
    payment_reference: str | None = Field(default=None, max_length=120)
    user_id: UUID | None = None
    amount_paise: int | None = Field(default=None, gt=0)


class MpinCreateIn(BaseModel):
    challenge_id: UUID
    otp: str = Field(max_length=12)
    new_mpin: str = Field(max_length=12)


class MpinChangeIn(MpinCreateIn):
    current_mpin: str = Field(max_length=12)


class MpinResetIn(MpinCreateIn):
    password: str = Field(max_length=200)


@router.get("/mpin")
def mpin_status(user=Depends(require_super_admin), db: Session = Depends(get_db)):
    row = sa.mpin_row(db, str(user["id"]))
    return {
        "has_mpin": bool(row),
        "locked": bool(row and row["locked"]),
        "locked_until": row["locked_until"] if row and row["locked"] else None,
        "updated_at": row["updated_at"] if row else None,
        "email": user["email"],
    }


@router.post("/challenge")
def request_challenge(
    body: ChallengeIn,
    request: Request,
    user=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Email a fresh OTP tied to one action, and to the amount and reference when it moves money."""
    ip = rate_limit.client_ip(request)
    # Limited per account in open_challenge: an IP limit here would be shared by a whole office.
    has_mpin = bool(sa.mpin_row(db, str(user["id"])))
    if body.action in sa.MPIN_ACTIONS:
        if (body.action == "mpin_create") == has_mpin:
            raise HTTPException(400, "You already have an MPIN" if has_mpin else "Create your MPIN first")
        return sa.open_challenge(db, user, body.action)
    if body.action == "wallet_credit":
        reference = (body.payment_reference or "").strip()
        if not body.user_id or not body.amount_paise or not reference:
            raise HTTPException(400, "Wallet, amount and payment reference are required")
        sa.require_mpin_usable(db, user)
        bound = sa.wallet_credit_reference(str(body.user_id), reference)
        out = sa.open_challenge(db, user, body.action, amount_paise=body.amount_paise, reference=bound)
        sa.log_event(db, user, "initiated", "pending", amount_paise=body.amount_paise, reference=bound, ip=ip)
        db.commit()
        return out
    if body.action not in sa.SETTLEMENT_ACTIONS or not body.settlement_id:
        raise HTTPException(400, "Unknown action")
    settlement_id = str(body.settlement_id)
    settlement = sa.settlement_for_action(db, settlement_id)
    sa.require_mpin_usable(db, user)
    amount = int(settlement["settlement_amount_paise"] or 0)
    reference = (body.payment_reference or "").strip() or None
    out = sa.open_challenge(db, user, body.action, settlement_id=settlement_id, amount_paise=amount, reference=reference)
    sa.log_event(db, user, "initiated", "pending", settlement_id=settlement_id, amount_paise=amount, reference=reference, ip=ip)
    db.commit()
    return {**out, "amount_paise": amount}


def _finish_mpin(db: Session, user: dict, action: str, new_mpin: str, ip: str) -> dict:
    sa.save_mpin(db, str(user["id"]), new_mpin)
    sa.log_event(db, user, action, "success", ip=ip)
    db.commit()
    return {"ok": True}


@router.post("/mpin/create")
def create_mpin(body: MpinCreateIn, request: Request, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    sa.validate_new_mpin(body.new_mpin)
    if sa.mpin_row(db, str(user["id"])):
        raise HTTPException(400, "You already have an MPIN")
    ip = rate_limit.client_ip(request)
    sa.verify_challenge(db, user, challenge_id=str(body.challenge_id), otp=body.otp, action="mpin_create", audit_action="mpin_create", ip=ip)
    return _finish_mpin(db, user, "mpin_create", body.new_mpin, ip)


@router.post("/mpin/change")
def change_mpin(body: MpinChangeIn, request: Request, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    sa.validate_new_mpin(body.new_mpin)
    if body.new_mpin == body.current_mpin:
        raise HTTPException(400, "New MPIN must be different from the current one")
    ip = rate_limit.client_ip(request)
    sa.verify_challenge(
        db, user, challenge_id=str(body.challenge_id), otp=body.otp, mpin=body.current_mpin,
        action="mpin_change", audit_action="mpin_change", ip=ip,
    )
    return _finish_mpin(db, user, "mpin_change", body.new_mpin, ip)


@router.post("/mpin/reset")
def reset_mpin(body: MpinResetIn, request: Request, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    """Forgotten MPIN: an emailed OTP plus the account password."""
    sa.validate_new_mpin(body.new_mpin)
    if not sa.mpin_row(db, str(user["id"])):
        raise HTTPException(400, "Create your MPIN first")
    if rate_limit.is_blocked(db, rate_limit.LOGIN_FAIL_IDENTIFIER, str(user["email"])):
        raise rate_limit.too_many()
    ip = rate_limit.client_ip(request)
    sa.verify_challenge(
        db, user, challenge_id=str(body.challenge_id), otp=body.otp, password=body.password,
        action="mpin_reset", audit_action="mpin_reset", ip=ip,
    )
    return _finish_mpin(db, user, "mpin_reset", body.new_mpin, ip)


@router.get("/audit")
def security_audit(
    settlement_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    user=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT a.*, b.booking_number
            FROM security_audit_log a
            LEFT JOIN settlements s ON s.id = a.settlement_id
            LEFT JOIN bookings b ON b.id = s.booking_id
            WHERE CAST(:sid AS uuid) IS NULL OR a.settlement_id = CAST(:sid AS uuid)
            ORDER BY a.created_at DESC
            LIMIT :lim
            """
        ),
        {"sid": str(settlement_id) if settlement_id else None, "lim": limit},
    ).mappings().all()
    return [row_dict(r) for r in rows]
