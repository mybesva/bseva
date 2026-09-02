"""Referral codes and application — customer CUST*-RC and pujari PUJARI*-RC."""
from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session


def ensure_pujari_referral_code(db: Session, user_id: str) -> str:
    row = db.execute(
        text("SELECT referral_code, phone FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not row:
        raise ValueError("User not found")
    if row["referral_code"]:
        return row["referral_code"]
    hex_part = str(user_id).replace("-", "")[-4:].upper()
    phone = "".join(ch for ch in (row["phone"] or "") if ch.isdigit())
    suffix = phone[-4:] if len(phone) >= 4 else hex_part
    base = f"PUJARI{suffix}-RC"
    code = base
    n = 0
    while True:
        exists = db.execute(
            text("SELECT 1 FROM users WHERE referral_code = :c AND id <> CAST(:id AS uuid)"),
            {"c": code, "id": user_id},
        ).first()
        if not exists:
            break
        n += 1
        code = f"PUJARI{suffix}{n}-RC"
    db.execute(
        text("UPDATE users SET referral_code = :c WHERE id = CAST(:id AS uuid)"),
        {"c": code, "id": user_id},
    )
    return code


def ensure_customer_referral_code(db: Session, user_id: str) -> str:
    row = db.execute(
        text("SELECT referral_code, phone FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not row:
        raise ValueError("User not found")
    if row["referral_code"]:
        return row["referral_code"]
    hex_part = str(user_id).replace("-", "")[-4:].upper()
    phone = "".join(ch for ch in (row["phone"] or "") if ch.isdigit())
    suffix = phone[-4:] if len(phone) >= 4 else hex_part
    base = f"CUST{suffix}-RC"
    code = base
    n = 0
    while True:
        exists = db.execute(
            text("SELECT 1 FROM users WHERE referral_code = :c AND id <> CAST(:id AS uuid)"),
            {"c": code, "id": user_id},
        ).first()
        if not exists:
            break
        n += 1
        code = f"CUST{suffix}{n}-RC"
    db.execute(
        text("UPDATE users SET referral_code = :c WHERE id = CAST(:id AS uuid)"),
        {"c": code, "id": user_id},
    )
    return code


def find_referrer_by_code(db: Session, code: str):
    c = (code or "").strip().upper()
    if not c:
        return None
    return db.execute(
        text(
            """
            SELECT id, role, referral_code, blocked
            FROM users WHERE upper(referral_code) = :c LIMIT 1
            """
        ),
        {"c": c},
    ).mappings().first()


def apply_referral_code(db: Session, referee_id: str, code: str) -> dict:
    """Link referee to referrer. Prevents self-referral and duplicate rewards rows."""
    code = (code or "").strip()
    if not code:
        raise HTTPException(400, "Referral code is required")
    referrer = find_referrer_by_code(db, code)
    if not referrer:
        raise HTTPException(400, "Invalid referral code")
    if referrer.get("blocked"):
        raise HTTPException(400, "Invalid referral code")
    if str(referrer["id"]) == str(referee_id):
        raise HTTPException(400, "You cannot use your own referral code")

    existing = db.execute(
        text("SELECT id, status FROM referrals WHERE referee_id = CAST(:id AS uuid)"),
        {"id": referee_id},
    ).mappings().first()
    if existing:
        raise HTTPException(400, "A referral is already linked to this account")

    # One pending referral per referee; also block if already rewarded historically
    role = str(referrer["role"] or "")
    if role in ("pujari", "head_pujari"):
        scope = "pujari"
    elif role == "customer":
        scope = "customer"
    else:
        raise HTTPException(400, "This referral code cannot be used")

    rid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO referrals (id, referrer_id, referee_id, role_scope, code, status)
            VALUES (CAST(:id AS uuid), CAST(:r AS uuid), CAST(:e AS uuid), :scope, :code, 'pending')
            """
        ),
        {
            "id": rid,
            "r": str(referrer["id"]),
            "e": referee_id,
            "scope": scope,
            "code": referrer["referral_code"],
        },
    )
    return {
        "ok": True,
        "referral_id": rid,
        "role_scope": scope,
        "code": referrer["referral_code"],
    }
