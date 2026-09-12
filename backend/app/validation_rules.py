"""Shared field validation used by API routers (cannot be bypassed via UI-only checks)."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException

# Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6–9
_MOBILE_RE = re.compile(r"^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$")
_PIN_RE = re.compile(r"^\d{6}$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_MEANINGFUL_RE = re.compile(r"[A-Za-z0-9]")
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def normalize_mobile(raw: str | None) -> str:
    digits = re.sub(r"\D", "", (raw or "").strip())
    if len(digits) > 10:
        # Prefer last 10 when prefixed with country code (91…) or legacy bad concatenations
        if digits.startswith("91") and len(digits) >= 12:
            digits = digits[-10:]
        else:
            digits = digits[-10:]
    m = _MOBILE_RE.match(digits)
    if not m:
        raise HTTPException(400, "Enter a valid 10-digit Indian mobile number")
    return m.group(1)


def validate_mobile_optional(raw: str | None) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return None
    return normalize_mobile(raw)


def validate_pujari_dob(d: date | None, *, min_age: int = 18) -> date | None:
    if d is None:
        return None
    today = datetime.now(timezone.utc).date()
    if d > today:
        raise HTTPException(400, "Date of birth cannot be in the future")
    age = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    if age < min_age:
        raise HTTPException(400, f"Pujari must be at least {min_age} years old")
    if age > 100:
        raise HTTPException(400, "Enter a realistic date of birth")
    return d


def validate_indian_pincode(raw: str | None, *, required: bool = False) -> Optional[str]:
    if raw is None or not str(raw).strip():
        if required:
            raise HTTPException(400, "PIN code is required")
        return None
    s = str(raw).strip()
    if not _PIN_RE.match(s):
        raise HTTPException(400, "PIN code must be exactly 6 digits")
    return s


def _reject_junk(label: str, raw: str | None, *, min_len: int, required: bool) -> Optional[str]:
    if raw is None or not str(raw).strip():
        if required:
            raise HTTPException(400, f"{label} is required")
        return None
    s = str(raw).strip()
    if len(s) < min_len:
        raise HTTPException(400, f"{label} must be at least {min_len} characters")
    if not _MEANINGFUL_RE.search(s):
        raise HTTPException(400, f"{label} must contain letters or numbers")
    # Reject strings that are only punctuation / repeated symbols
    alnum = sum(1 for c in s if c.isalnum())
    if alnum < max(1, min_len // 2):
        raise HTTPException(400, f"{label} must contain meaningful text")
    return s


def validate_address_fields(
    *,
    address_line1: str | None = None,
    address_line2: str | None = None,
    city: str | None = None,
    district: str | None = None,
    state: str | None = None,
    pincode: str | None = None,
    require_all: bool = False,
) -> dict:
    """Validate address pieces. When require_all, all core fields must be present and valid."""
    touching = any(
        x is not None
        for x in (address_line1, address_line2, city, district, state, pincode)
    )
    if not touching and not require_all:
        return {}
    req = require_all or touching
    out: dict = {}
    if address_line1 is not None or req:
        out["address_line1"] = _reject_junk("Address line 1", address_line1, min_len=3, required=req)
    if address_line2 is not None:
        out["address_line2"] = (
            _reject_junk("Address line 2", address_line2, min_len=2, required=False)
            if str(address_line2 or "").strip()
            else (address_line2 or None)
        )
    if city is not None or req:
        out["city"] = _reject_junk("City", city, min_len=2, required=req)
    if district is not None or req:
        out["district"] = _reject_junk("District", district, min_len=2, required=req)
    if state is not None or req:
        out["state"] = _reject_junk("State", state, min_len=2, required=req)
    if pincode is not None or req:
        out["pincode"] = validate_indian_pincode(pincode, required=req)
    return out


def validate_bank_fields(
    *,
    holder: str | None,
    ifsc: str | None,
    last4: str | None,
    require_all: bool = True,
) -> dict:
    h = (holder or "").strip()
    i = (ifsc or "").strip().upper()
    a = (last4 or "").strip()
    if not require_all and not h and not i and not a:
        return {"bank_holder_name": None, "bank_ifsc": None, "bank_account_last4": None}
    if not h:
        raise HTTPException(400, "Account holder name is required")
    if len(h) < 2 or not _MEANINGFUL_RE.search(h):
        raise HTTPException(400, "Enter a valid account holder name")
    if not i:
        raise HTTPException(400, "IFSC is required")
    if not _IFSC_RE.match(i):
        raise HTTPException(400, "Enter a valid IFSC (e.g. SBIN0001234)")
    if not a or not a.isdigit() or len(a) != 4:
        raise HTTPException(400, "Account number last 4 digits must be exactly 4 digits")
    return {"bank_holder_name": h, "bank_ifsc": i, "bank_account_last4": a}


def validate_support_text(subject: str, description: str) -> tuple[str, str]:
    sub = _reject_junk("Subject", subject, min_len=5, required=True) or ""
    desc = _reject_junk("Description", description, min_len=10, required=True) or ""
    return sub, desc


def validate_cancel_reason(reason: str | None, *, required: bool = False) -> Optional[str]:
    if reason is None or not str(reason).strip():
        if required:
            raise HTTPException(400, "Cancellation reason is required")
        return None
    return _reject_junk("Cancellation reason", reason, min_len=5, required=True)


def is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match((value or "").strip()))
