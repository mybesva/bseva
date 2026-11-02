"""Self-service account security: forgot password, account deletion (and cancelling it), and user reports."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import account_lifecycle as al
from app import rate_limit
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.domain import row_dict
from app.i18n import coded_http
from app.security import hash_password

router = APIRouter(tags=["account"])
bearer = HTTPBearer(auto_error=False)

OTP_MINUTES = 5
GENERIC_CODE_SENT = "If an account exists for this email, we have sent a code. It is valid for 5 minutes."
SELF_SERVICE_ROLES = ("customer", "pujari", "head_pujari")
DELETION_AUDIENCE = "bseva-account-deletion"


def _send_code(db: Session, request: Request, email: str, purpose: str, *, require_state: str) -> dict:
    """Same response whether or not the account exists. Per-email limits live in issue_email_otp."""
    from app.otp_service import issue_email_otp

    rate_limit.enforce(db, rate_limit.OTP_REQUEST_IP, rate_limit.client_ip(request))
    email_n = str(email).strip().lower()
    row = db.execute(
        text("SELECT name, role, preferred_language, blocked, account_state FROM users WHERE lower(email) = :e LIMIT 1"),
        {"e": email_n},
    ).mappings().first()
    eligible = bool(
        row
        and row["role"] in SELF_SERVICE_ROLES
        and (row.get("account_state") or "active") == require_state
        and (purpose != "reset" or not row["blocked"])
    )
    if eligible:
        result = issue_email_otp(
            db,
            email=email_n,
            purpose=purpose,
            customer_name=str(row.get("name") or ""),
            language=str(row.get("preferred_language") or "en"),
            ttl_minutes=OTP_MINUTES,
        )
        if not result.get("ok") and result.get("error") in ("cooldown", "hourly_limit", "daily_limit", "rate_limited"):
            wait = result.get("retry_after_seconds")
            raise HTTPException(
                429,
                {"code": "OTP_RATE_LIMITED", "message": "Please wait before requesting another code.", "retry_after_seconds": wait},
            )
    return {"ok": True, "message": GENERIC_CODE_SENT, "expires_in_minutes": OTP_MINUTES}


def _check_code(db: Session, request: Request, email: str, code: str, purpose: str) -> None:
    from app.otp_service import verify_email_otp

    ip = rate_limit.client_ip(request)
    if rate_limit.is_blocked(db, rate_limit.OTP_VERIFY_FAIL_IP, ip):
        raise rate_limit.too_many()
    result = verify_email_otp(db, email=str(email).strip().lower(), code=str(code).strip(), purpose=purpose, consume=True)
    if not result.get("ok"):
        rate_limit.record(db, rate_limit.OTP_VERIFY_FAIL_IP, ip)
        db.commit()
        if result.get("error") == "too_many_attempts":
            raise coded_http(429, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect codes. Please request a new code.")
        raise coded_http(400, "INVALID_CODE", "The code is incorrect or has expired.")


def _user_by_email(db: Session, email: str) -> dict | None:
    row = db.execute(
        text("SELECT * FROM users WHERE lower(email) = :e LIMIT 1"), {"e": str(email).strip().lower()}
    ).mappings().first()
    return dict(row) if row else None


# --- forgot password ------------------------------------------------------------------------------

class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/auth/password/forgot")
def forgot_password(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    return _send_code(db, request, str(body.email), "reset", require_state="active")


@router.post("/auth/password/reset")
def reset_password(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    _check_code(db, request, str(body.email), body.code, "reset")
    user = _user_by_email(db, str(body.email))
    if not user or user["role"] not in SELF_SERVICE_ROLES or (user.get("account_state") or "active") != "active":
        raise coded_http(400, "INVALID_CODE", "The code is incorrect or has expired.")
    db.execute(
        text(
            """
            UPDATE users SET password_hash = :pw, sessions_revoked_at = :revoked, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"pw": hash_password(body.new_password), "id": str(user["id"]), "revoked": datetime.now(timezone.utc)},
    )
    db.commit()
    al.notify_password_changed(db, user)
    return {"ok": True, "message": "Your password was reset. Please sign in with your new password."}


# --- account deletion -----------------------------------------------------------------------------

def _deletion_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    claims = {"sub": user_id, "aud": DELETION_AUDIENCE, "exp": exp}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def deletion_actor(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> dict:
    """The signed-in user, or the holder of a short-lived deletion token from the public page."""
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in")
    try:
        claims = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=DELETION_AUDIENCE
        )
        row = db.execute(
            text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": claims.get("sub")}
        ).mappings().first()
        if not row:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please start again")
        return {**dict(row), "_verified_by_email": True}
    except jwt.PyJWTError:
        pass
    user = current_user(creds=creds, db=db)
    return {**user, "_verified_by_email": False}


class DeletionOtpIn(BaseModel):
    reason: str
    explanation: str


class DeletionConfirmIn(BaseModel):
    reason: str
    explanation: str
    code: str | None = None
    acknowledge: bool = False


class EmailIn(BaseModel):
    email: EmailStr


class EmailCodeIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


def _require_self_service(user: dict) -> None:
    if user.get("role") not in SELF_SERVICE_ROLES:
        raise HTTPException(403, "Admin accounts are closed by a Super Admin.")


@router.get("/account/deletion")
def deletion_overview(user=Depends(deletion_actor), db: Session = Depends(get_db)):
    _require_self_service(user)
    return al.overview(db, user)


@router.post("/account/deletion/request-otp")
def deletion_request_otp(body: DeletionOtpIn, request: Request, user=Depends(current_user), db: Session = Depends(get_db)):
    _require_self_service(user)
    al.validate_request_fields(body.reason, body.explanation)
    out = _send_code(db, request, str(user["email"]), "delete_account", require_state="active")
    name, _, domain = str(user["email"]).partition("@")
    return {**out, "message": "We have sent a code to your registered email.", "email_hint": f"{name[:2]}***@{domain}"}


@router.post("/account/deletion/confirm")
def deletion_confirm(body: DeletionConfirmIn, request: Request, user=Depends(deletion_actor), db: Session = Depends(get_db)):
    _require_self_service(user)
    reason, explanation = al.validate_request_fields(body.reason, body.explanation)
    if not body.acknowledge:
        raise HTTPException(400, "Please confirm that you understand what happens when your account is deleted")
    if not user.get("_verified_by_email"):
        if not body.code:
            raise coded_http(400, "INVALID_CODE", "Enter the code we sent to your email.")
        _check_code(db, request, str(user["email"]), body.code, "delete_account")
    result = al.create_request(
        db, user, reason=reason, explanation=explanation, source="web_public" if user.get("_verified_by_email") else "app"
    )
    return {"request": result["request"], "message": al.DEACTIVATED_MESSAGE}


@router.post("/account/deletion/public/request-otp")
def deletion_public_otp(body: EmailIn, request: Request, db: Session = Depends(get_db)):
    return _send_code(db, request, str(body.email), "delete_account", require_state="active")


@router.post("/account/deletion/public/verify")
def deletion_public_verify(body: EmailCodeIn, request: Request, db: Session = Depends(get_db)):
    _check_code(db, request, str(body.email), body.code, "delete_account")
    user = _user_by_email(db, str(body.email))
    if not user or user["role"] not in SELF_SERVICE_ROLES:
        raise coded_http(400, "INVALID_CODE", "The code is incorrect or has expired.")
    return {"deletion_token": _deletion_token(str(user["id"])), "expires_in": 900}


@router.post("/account/deletion/cancel/request-otp")
def deletion_cancel_otp(body: EmailIn, request: Request, db: Session = Depends(get_db)):
    return _send_code(db, request, str(body.email), "cancel_deletion", require_state="deletion_requested")


@router.post("/account/deletion/cancel")
def deletion_cancel(body: EmailCodeIn, request: Request, db: Session = Depends(get_db)):
    _check_code(db, request, str(body.email), body.code, "cancel_deletion")
    user = _user_by_email(db, str(body.email))
    if not user or not al.cancel_request(db, user):
        raise HTTPException(400, "There is no deletion request to cancel for this account.")
    message = "Your deletion request was cancelled. You can sign in again."
    if user.get("blocked"):
        message = "Your deletion request was cancelled. Your account is still blocked; please contact support."
    return {"ok": True, "message": message}


# --- reports --------------------------------------------------------------------------------------

REPORT_REASONS = ("misconduct", "no_show", "unsafe", "fraud", "payment", "inappropriate_content", "other")


class ReportIn(BaseModel):
    target_type: str
    target_id: str
    booking_id: str | None = None
    reason: str
    details: str = Field(min_length=10, max_length=1000)


@router.post("/reports")
def create_report(body: ReportIn, user=Depends(current_user), db: Session = Depends(get_db)):
    role = user["role"]
    if role not in SELF_SERVICE_ROLES:
        raise HTTPException(403, "Only customers and pujaris can send reports here")
    if body.reason not in REPORT_REASONS:
        raise HTTPException(400, "Choose a reason")
    allowed = {"customer": ("pujari", "booking"), "pujari": ("customer", "booking"), "head_pujari": ("customer", "booking")}
    if body.target_type not in allowed[role]:
        raise HTTPException(400, "You cannot report this")
    booking_id = body.booking_id or (body.target_id if body.target_type == "booking" else None)
    if not booking_id:
        raise HTTPException(400, "Choose the booking this report is about")
    b = db.execute(
        text("SELECT id, customer_id, pujari_id FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}
    ).mappings().first()
    uid = str(user["id"])
    if not b or uid not in (str(b["customer_id"]), str(b["pujari_id"] or "")):
        raise HTTPException(404, "Booking not found")
    target_user = None
    if body.target_type == "pujari":
        target_user = str(b["pujari_id"] or "")
        if not target_user or target_user != body.target_id:
            raise HTTPException(400, "This pujari is not on the booking")
    elif body.target_type == "customer":
        target_user = str(b["customer_id"])
        if target_user != body.target_id:
            raise HTTPException(400, "This customer is not on the booking")
    rid = db.execute(
        text(
            """
            INSERT INTO user_reports (reporter_id, reporter_role, target_type, target_user_id, booking_id, reason, details)
            VALUES (CAST(:r AS uuid), :rr, :t, CAST(:tu AS uuid), CAST(:b AS uuid), :reason, :d)
            RETURNING id
            """
        ),
        {"r": uid, "rr": role, "t": body.target_type, "tu": target_user, "b": booking_id, "reason": body.reason,
         "d": body.details.strip()},
    ).scalar()
    db.execute(
        text("INSERT INTO user_report_events (report_id, actor_id, actor_name, action) VALUES (:id, CAST(:a AS uuid), :n, 'created')"),
        {"id": rid, "a": uid, "n": str(user.get("name") or "User")},
    )
    try:
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(db, title="New Report", body=f"A {role} reported a {body.target_type} ({body.reason}).",
                         category="ops", link=f"/admin/reports-queue?id={rid}")
    except Exception:
        pass
    db.commit()
    return {"id": str(rid), "status": "open"}


@router.get("/reports/mine")
def my_reports(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, target_type, reason, status, created_at, resolution, booking_id
            FROM user_reports WHERE reporter_id = CAST(:id AS uuid) ORDER BY created_at DESC LIMIT 100
            """
        ),
        {"id": str(user["id"])},
    ).mappings().all()
    return [row_dict(r) for r in rows]
