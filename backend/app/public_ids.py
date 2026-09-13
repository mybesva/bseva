"""Human-readable public IDs for customers and pujaris.

Formats:
  customer → CUST-{3 name letters}{last 4 phone digits}  e.g. CUST-ANA0002
  pujari   → PUJ-{3 name letters}{last 4 phone digits}   e.g. PUJ-PAN0006
"""
from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.orm import Session


def _name_prefix(name: str | None) -> str:
    letters = re.sub(r"[^A-Za-z]", "", name or "")
    if len(letters) >= 3:
        return letters[:3].upper()
    if letters:
        return (letters + "XXX")[:3].upper()
    return "USR"


def _phone_suffix(phone: str | None) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) >= 4:
        return digits[-4:]
    if digits:
        return digits.zfill(4)
    return "0000"


def build_public_id_base(role: str, name: str | None, phone: str | None) -> str:
    prefix = "PUJ" if role in ("pujari", "head_pujari") else "CUST"
    return f"{prefix}-{_name_prefix(name)}{_phone_suffix(phone)}"


def ensure_public_id(db: Session, user_id: str) -> str | None:
    """Assign a unique public_id if missing. Returns the id or None if user not found / not applicable."""
    row = db.execute(
        text("SELECT id, name, phone, role, public_id FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not row:
        return None
    existing = (row.get("public_id") or "").strip()
    if existing:
        return existing
    role = row["role"] or ""
    if role not in ("customer", "pujari", "head_pujari"):
        return None

    base = build_public_id_base(role, row.get("name"), row.get("phone"))
    code = base
    n = 0
    while True:
        clash = db.execute(
            text("SELECT 1 FROM users WHERE public_id = :c AND id <> CAST(:id AS uuid)"),
            {"c": code, "id": user_id},
        ).first()
        if not clash:
            break
        n += 1
        code = f"{base}{n}"

    db.execute(
        text("UPDATE users SET public_id = :c WHERE id = CAST(:id AS uuid) AND public_id IS NULL"),
        {"c": code, "id": user_id},
    )
    return code


def backfill_missing_public_ids(db: Session) -> int:
    """Assign public_id to all customers/pujaris that lack one. Returns count assigned."""
    rows = db.execute(
        text(
            """
            SELECT id FROM users
            WHERE role IN ('customer', 'pujari', 'head_pujari')
              AND (public_id IS NULL OR btrim(public_id) = '')
            ORDER BY created_at
            """
        )
    ).scalars().all()
    count = 0
    for uid in rows:
        if ensure_public_id(db, str(uid)):
            count += 1
    return count
