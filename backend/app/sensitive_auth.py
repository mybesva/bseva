"""MPIN + OTP verification for Super Admin sensitive actions, and the append-only security audit log."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import rate_limit
from app.i18n import coded_http
from app.otp_service import issue_email_otp, verify_email_otp
from app.security import hash_password, verify_password

ACTION_OTP_MINUTES = 5
ACTION_OTP_COOLDOWN_SECONDS = 30
SUPER_ADMIN_OTP_PER_HOUR = 20
MAX_MPIN_ATTEMPTS = 5
MPIN_LOCK_MINUTES = 30

SETTLEMENT_ACTIONS = ("settlement_override", "settlement_note")
MPIN_ACTIONS = ("mpin_create", "mpin_change", "mpin_reset")

SYSTEM_ACTOR = {"id": None, "name": "System (automatic)", "email": None}


def log_event(
    db: Session,
    actor: dict,
    action: str,
    status: str,
    *,
    settlement_id: str | None = None,
    amount_paise: int | None = None,
    reference: str | None = None,
    reason: str | None = None,
    ip: str | None = None,
) -> None:
    """Add an audit row to the current transaction. Never pass an MPIN or OTP here."""
    db.execute(
        text(
            """
            INSERT INTO security_audit_log (
              actor_id, actor_name, actor_email, action, status, settlement_id,
              amount_paise, transaction_reference, reason, ip
            ) VALUES (
              CAST(:actor_id AS uuid), :name, :email, :action, :status, CAST(:sid AS uuid),
              :amount, :reference, :reason, :ip
            )
            """
        ),
        {
            "actor_id": str(actor["id"]) if actor.get("id") else None,
            "name": str(actor.get("name") or "Unknown"),
            "email": actor.get("email"),
            "action": action,
            "status": status,
            "sid": str(settlement_id) if settlement_id else None,
            "amount": amount_paise,
            "reference": reference,
            "reason": reason,
            "ip": ip,
        },
    )


def log_failure(db: Session, actor: dict, action: str, reason: str, **fields: Any) -> None:
    """Failed attempts are recorded on their own, so raising the error cannot roll them back."""
    db.rollback()
    log_event(db, actor, action, "failed", reason=reason, **fields)
    db.commit()


def settlement_for_action(db: Session, settlement_id: str) -> dict:
    """The settlement as the server sees it. The client never supplies the amount."""
    row = db.execute(
        text("SELECT * FROM settlements WHERE id = CAST(:id AS uuid)"), {"id": settlement_id}
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Settlement not found")
    if row["status"] == "settled":
        raise HTTPException(400, "Already settled")
    if row["status"] == "blocked":
        raise HTTPException(400, "This settlement is blocked for a pujari no-show and cannot be paid out")
    return dict(row)


def wallet_credit_reference(user_id: str, reference: str) -> str:
    return f"{user_id}:{reference.strip()}"


def validate_new_mpin(mpin: str) -> None:
    value = str(mpin or "")
    if len(value) != 6 or not value.isascii() or not value.isdigit():
        raise HTTPException(400, "MPIN must be exactly 6 digits")
    steps = {int(b) - int(a) for a, b in zip(value, value[1:])}
    if steps in ({0}, {1}, {-1}):
        raise HTTPException(400, "Choose a harder MPIN: no repeated or sequential digits")


def mpin_row(db: Session, user_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT *, (locked_until IS NOT NULL AND locked_until > NOW()) AS locked
            FROM admin_mpins WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def save_mpin(db: Session, user_id: str, mpin: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO admin_mpins (user_id, mpin_hash) VALUES (CAST(:id AS uuid), :hash)
            ON CONFLICT (user_id) DO UPDATE SET
              mpin_hash = EXCLUDED.mpin_hash, failed_attempts = 0, locked_until = NULL, updated_at = NOW()
            """
        ),
        {"id": user_id, "hash": hash_password(mpin)},
    )


def require_mpin_usable(db: Session, user: dict) -> dict:
    row = mpin_row(db, str(user["id"]))
    if not row:
        raise coded_http(400, "MPIN_NOT_SET", "Create your MPIN in Security Settings first")
    if row["locked"]:
        raise coded_http(423, "MPIN_LOCKED", f"MPIN is locked after {MAX_MPIN_ATTEMPTS} wrong attempts. Try again later or reset it.")
    return row


def check_mpin(db: Session, user: dict, mpin: str, audit_action: str, **audit_fields: Any) -> None:
    """Raise when wrong or locked. The failure counter resets only when the MPIN is saved or a whole action passes."""
    row = require_mpin_usable(db, user)
    if verify_password(str(mpin or ""), row["mpin_hash"]):
        return
    db.rollback()
    state = db.execute(
        text(
            """
            UPDATE admin_mpins SET
              locked_until = CASE WHEN failed_attempts + 1 >= :max
                THEN NOW() + make_interval(mins => :mins) ELSE locked_until END,
              failed_attempts = CASE WHEN failed_attempts + 1 >= :max THEN 0 ELSE failed_attempts + 1 END
            WHERE user_id = CAST(:id AS uuid)
            RETURNING failed_attempts, (locked_until IS NOT NULL AND locked_until > NOW()) AS locked
            """
        ),
        {"id": str(user["id"]), "max": MAX_MPIN_ATTEMPTS, "mins": MPIN_LOCK_MINUTES},
    ).mappings().one()
    log_event(db, user, audit_action, "failed", reason="locked" if state["locked"] else "wrong_mpin", **audit_fields)
    db.commit()
    if state["locked"]:
        raise coded_http(423, "MPIN_LOCKED", f"MPIN locked for {MPIN_LOCK_MINUTES} minutes after {MAX_MPIN_ATTEMPTS} wrong attempts.")
    left = MAX_MPIN_ATTEMPTS - int(state["failed_attempts"])
    raise coded_http(400, "MPIN_INVALID", f"Incorrect MPIN. {left} attempt{'s' if left != 1 else ''} left.")


def clear_mpin_failures(db: Session, user_id: str) -> None:
    db.execute(
        text("UPDATE admin_mpins SET failed_attempts = 0, locked_until = NULL WHERE user_id = CAST(:id AS uuid)"),
        {"id": user_id},
    )


def _binding(user_id: str, action: str, settlement_id: str | None, amount_paise: int | None, reference: str | None) -> str:
    raw = json.dumps([user_id, action, settlement_id, amount_paise, reference or None])
    return hashlib.sha256(raw.encode()).hexdigest()


def open_challenge(
    db: Session,
    user: dict,
    action: str,
    *,
    settlement_id: str | None = None,
    amount_paise: int | None = None,
    reference: str | None = None,
) -> dict:
    """Send a fresh OTP for one action. Only the newest challenge stays open, matching the one live OTP."""
    uid = str(user["id"])
    result = issue_email_otp(
        db,
        email=str(user["email"]),
        purpose="sensitive_action",
        customer_name=str(user.get("name") or ""),
        language=str(user.get("preferred_language") or "en"),
        ttl_minutes=ACTION_OTP_MINUTES,
        hourly_limit=SUPER_ADMIN_OTP_PER_HOUR,
        cooldown_seconds=ACTION_OTP_COOLDOWN_SECONDS,
    )
    if not result.get("ok"):
        if result.get("error") in ("cooldown", "hourly_limit", "rate_limited"):
            wait = result.get("retry_after_seconds")
            raise HTTPException(429, f"Please wait before requesting another OTP{f' ({wait}s)' if wait else ''}")
        raise HTTPException(502, result.get("message") or "Could not send the OTP. Nothing was changed.")
    db.execute(
        text("UPDATE security_challenges SET consumed_at = NOW() WHERE user_id = CAST(:u AS uuid) AND consumed_at IS NULL"),
        {"u": uid},
    )
    challenge_id = db.execute(
        text(
            """
            INSERT INTO security_challenges (user_id, action, settlement_id, amount_paise, reference, binding, expires_at)
            VALUES (
              CAST(:u AS uuid), :action, CAST(:sid AS uuid), :amount, :reference, :binding,
              NOW() + make_interval(mins => :mins)
            )
            RETURNING id
            """
        ),
        {
            "u": uid,
            "action": action,
            "sid": settlement_id,
            "amount": amount_paise,
            "reference": reference or None,
            "binding": _binding(uid, action, settlement_id, amount_paise, reference),
            "mins": ACTION_OTP_MINUTES,
        },
    ).scalar()
    db.commit()
    return {"challenge_id": str(challenge_id), "expires_in_minutes": ACTION_OTP_MINUTES, "email": result.get("email")}


def _reject(db: Session, user: dict, audit_action: str, reason: str, audit_fields: dict, code: str, message: str):
    log_failure(db, user, audit_action, reason, **audit_fields)
    raise coded_http(400, code, message)


def verify_challenge(
    db: Session,
    user: dict,
    *,
    challenge_id: str,
    otp: str,
    action: str,
    audit_action: str,
    ip: str,
    mpin: str | None = None,
    password: str | None = None,
    settlement_id: str | None = None,
    amount_paise: int | None = None,
    reference: str | None = None,
) -> None:
    """Pass only if every factor is right for exactly this action. Raises before any change otherwise."""
    uid = str(user["id"])
    fields = {"settlement_id": settlement_id, "amount_paise": amount_paise, "reference": reference or None, "ip": ip}
    if rate_limit.is_blocked(db, rate_limit.OTP_VERIFY_FAIL_IP, ip):
        raise rate_limit.too_many()
    challenge = db.execute(
        text(
            """
            SELECT *, (expires_at > NOW()) AS live FROM security_challenges
            WHERE id = CAST(:id AS uuid) AND user_id = CAST(:u AS uuid)
            """
        ),
        {"id": challenge_id, "u": uid},
    ).mappings().first()
    if not challenge or challenge["consumed_at"] or not challenge["live"]:
        _reject(db, user, audit_action, "expired_or_used", fields, "VERIFICATION_EXPIRED", "This verification has expired or was already used. Request a new OTP.")
    if challenge["binding"] != _binding(uid, action, settlement_id, amount_paise, reference):
        _reject(db, user, audit_action, "binding_mismatch", fields, "VERIFICATION_MISMATCH", "These details changed after the OTP was sent. Request a new OTP.")
    if mpin is not None:
        check_mpin(db, user, mpin, audit_action, **fields)
    if password is not None and not verify_password(password, user["password_hash"]):
        rate_limit.record(db, rate_limit.LOGIN_FAIL_IDENTIFIER, str(user["email"]))
        db.commit()
        _reject(db, user, audit_action, "wrong_password", fields, "PASSWORD_INVALID", "Incorrect account password")
    # The OTP row is locked and consumed atomically, so a replayed request cannot pass here.
    result = verify_email_otp(db, email=str(user["email"]), code=str(otp or ""), purpose="sensitive_action", consume=True)
    if not result.get("ok"):
        rate_limit.record(db, rate_limit.OTP_VERIFY_FAIL_IP, ip)
        db.commit()
        if result.get("error") == "too_many_attempts":
            log_failure(db, user, audit_action, "otp_attempts_exceeded", **fields)
            raise coded_http(429, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect codes. Please request a new OTP.")
        _reject(db, user, audit_action, "wrong_otp", fields, "INVALID_OTP", "Invalid or expired OTP")
    claimed = db.execute(
        text(
            """
            UPDATE security_challenges SET consumed_at = NOW()
            WHERE id = CAST(:id AS uuid) AND consumed_at IS NULL AND expires_at > NOW()
            RETURNING id
            """
        ),
        {"id": challenge_id},
    ).first()
    if not claimed:
        _reject(db, user, audit_action, "expired_or_used", fields, "VERIFICATION_EXPIRED", "This verification has expired or was already used. Request a new OTP.")
    if mpin is not None:
        clear_mpin_failures(db, uid)
    db.commit()
