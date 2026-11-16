"""Check a pujari's payout bank account / UPI ID with Cashfree Secure ID before money is sent to it.

A check is tied to the exact details checked (the payout fingerprint), so changing the details needs a new check.
Outcome:
- verified       the account is valid and the bank's name matches the pujari well (direct or good partial match)
- name_mismatch  valid, but the bank's name differs: payouts stay blocked until a Super Admin approves it with a
                 reason (after checking the pujari's documents)
- invalid        the account / UPI ID cannot receive money
- failed         the check itself did not complete (bank offline, timeout): try again
Payouts go only to details whose latest check is verified or an approved name mismatch (setting
`payout_require_verified_details`, default on).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.payments.cashfree_pg import CashfreeError
from app.payouts import cashfree_vrs as vrs
from app.payouts.service import pujari_payout_details
from app.platform_config import get_setting

logger = logging.getLogger(__name__)

GOOD_MATCHES = ("DIRECT_MATCH", "GOOD_PARTIAL_MATCH", "MATCH")
# Problems with the account itself (not a temporary failure of the check).
INVALID_CODES = ("fraud_account",)


def verification_required(db: Session) -> bool:
    value = get_setting(db, "payout_require_verified_details", True)
    if isinstance(value, str):
        return value.strip().lower() not in ("false", "0", "off", "no")
    return bool(value)


def _row(db: Session, verification_id: str) -> dict | None:
    r = db.execute(
        text("SELECT * FROM pujari_payout_verifications WHERE id = CAST(:id AS uuid)"), {"id": verification_id}
    ).mappings().first()
    return dict(r) if r else None


def latest_for_current_details(db: Session, pujari_id: str) -> tuple[dict, dict | None]:
    """(current payout details, latest check of exactly those details or None)."""
    details = pujari_payout_details(db, pujari_id)
    row = db.execute(
        text(
            """
            SELECT * FROM pujari_payout_verifications
            WHERE pujari_id = CAST(:p AS uuid) AND details_fingerprint = :fp
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"p": pujari_id, "fp": details["fingerprint"]},
    ).mappings().first()
    return details, dict(row) if row else None


def is_payable(check: dict | None) -> bool:
    if not check:
        return False
    return check["status"] == "verified" or (check["status"] == "name_mismatch" and bool(check.get("approved_at")))


def verification_summary(db: Session, pujari_id: str) -> dict[str, Any]:
    try:
        details, check = latest_for_current_details(db, pujari_id)
    except HTTPException as e:
        return {"has_details": False, "message": str(e.detail), "payable": False, "required": verification_required(db)}
    consent = db.execute(
        text("SELECT payout_details_consent_at FROM pujari_profiles WHERE user_id = CAST(:p AS uuid)"), {"p": pujari_id}
    ).scalar()
    history = db.execute(
        text(
            """
            SELECT id, instrument, masked_details, status, name_at_bank, name_match_result, name_match_score,
                   failure_reason, approved_at, approval_reason, created_at, details_fingerprint = :fp AS current
            FROM pujari_payout_verifications WHERE pujari_id = CAST(:p AS uuid)
            ORDER BY created_at DESC LIMIT 20
            """
        ),
        {"p": pujari_id, "fp": details["fingerprint"]},
    ).mappings().all()
    return {
        "has_details": True,
        "instrument": details["instrument"],
        "destination": details["masked"],
        "name_on_profile": details["name"],
        "consent_at": consent,
        "configured": settings.cashfree_vrs_configured,
        "environment": settings.cashfree_vrs_env,
        "required": verification_required(db),
        "payable": is_payable(check),
        "current": _public(check) if check else None,
        "history": [dict(h) for h in history],
    }


def _public(check: dict) -> dict:
    keep = ("id", "instrument", "masked_details", "status", "name_at_bank", "name_match_result", "name_match_score",
            "failure_reason", "approved_at", "approval_reason", "created_at")
    return {k: check.get(k) for k in keep}


TITLES = {"MR", "MRS", "MS", "MISS", "DR", "SHRI", "SRI", "SMT", "KUMARI", "KUM"}


def local_name_match(profile_name: str | None, name_at_bank: str | None) -> str | None:
    """B-Seva's own comparison, used when Cashfree returns no name-match result (its sandbox never does).
    DIRECT_MATCH: same names (any order, titles ignored). GOOD_PARTIAL_MATCH: every name on the shorter side is on the
    other side or is its initial, with at least one full name in common. Anything else: NO_MATCH."""
    if not profile_name or not name_at_bank:
        return None
    a = [t for t in re.findall(r"[A-Z]+", profile_name.upper()) if t not in TITLES]
    b = [t for t in re.findall(r"[A-Z]+", name_at_bank.upper()) if t not in TITLES]
    if not a or not b:
        return "NO_MATCH"
    if sorted(a) == sorted(b):
        return "DIRECT_MATCH"
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    full_common = [t for t in short if len(t) > 1 and t in long_]
    covered = all(t in long_ or (len(t) == 1 and any(x.startswith(t) for x in long_)) for t in short)
    return "GOOD_PARTIAL_MATCH" if covered and full_common else "NO_MATCH"


def _name_result(res: dict, profile_name: str) -> str | None:
    """Cashfree's name-match result when it gives one, otherwise B-Seva's own comparison."""
    given = str(res.get("name_match_result") or "").strip().upper()
    return given or local_name_match(profile_name, res.get("name_at_bank"))


def _classify_bank(res: dict, profile_name: str) -> str:
    if str(res.get("account_status") or "").upper() != "VALID":
        return "invalid"
    return "verified" if (_name_result(res, profile_name) or "") in GOOD_MATCHES else "name_mismatch"


def _classify_upi(res: dict, profile_name: str) -> str:
    status = str(res.get("status") or "").upper()
    if status not in ("VALID", "SUCCESS"):
        return "invalid"
    return "verified" if (_name_result(res, profile_name) or "") in GOOD_MATCHES else "name_mismatch"


def run_check(db: Session, pujari_id: str, admin: dict) -> dict[str, Any]:
    """Check the pujari's current payout details with Cashfree Secure ID and record the result. Commits.

    Each check is billed by Cashfree, and a UPI check sends Rs 1, so it runs only when a Super Admin asks."""
    if not settings.cashfree_vrs_configured:
        raise HTTPException(409, "Cashfree Secure ID is not set up, so bank and UPI details cannot be verified yet.")
    details, previous = latest_for_current_details(db, pujari_id)
    if previous and previous["status"] == "verified":
        # These exact details are already verified: do not pay Cashfree to check them again.
        return {"status": "verified", "check": _public(previous), "reused": True}
    phone = details.get("phone")
    status, res, reason = "failed", {}, None
    try:
        if details["instrument"] == "bank":
            res = vrs.verify_bank_account(account=details["account"], ifsc=details["ifsc"], name=details["name"], phone=phone)
            status = _classify_bank(res, details["name"])
            if status == "invalid":
                reason = str(res.get("account_status_code") or "account invalid")
        else:
            consent = db.execute(
                text("SELECT payout_details_consent_at FROM pujari_profiles WHERE user_id = CAST(:p AS uuid)"), {"p": pujari_id}
            ).scalar()
            if not consent:
                raise HTTPException(
                    409,
                    "This pujari has not agreed to UPI verification yet (it sends Rs 1). Ask them to open Bank & UPI "
                    "details in the app and save them again.",
                )
            res = vrs.verify_upi(
                verification_id=f"bsv{uuid4().hex[:24]}", vpa=details["vpa"], name=details["name"], consent_at=consent,
            )
            status = _classify_upi(res, details["name"])
            if status == "invalid":
                reason = str(res.get("status") or "UPI ID invalid")
    except CashfreeError as e:
        logger.warning("payout_verification_failed pujari=%s status=%s code=%s", pujari_id, e.status, e.code)
        if e.status in (401, 403):
            raise HTTPException(502, "Cashfree Secure ID refused our credentials. Check the Secure ID keys and 2FA.") from e
        status = "invalid" if (e.code or "") in INVALID_CODES else "failed"
        reason = f"{e.code or 'error'}: {e}"[:300]
    row = db.execute(
        text(
            """
            INSERT INTO pujari_payout_verifications (
              pujari_id, instrument, details_fingerprint, masked_details, status, name_at_bank, name_match_result,
              name_match_score, provider_reference, provider_status, failure_reason, checked_by
            ) VALUES (
              CAST(:p AS uuid), :inst, :fp, :masked, :st, :nab, :nmr, :nms, :ref, :pst, :fr, CAST(:by AS uuid)
            ) RETURNING *
            """
        ),
        {
            "p": pujari_id, "inst": details["instrument"], "fp": details["fingerprint"], "masked": details["masked"],
            "st": status, "nab": res.get("name_at_bank"),
            "nmr": (_name_result(res, details["name"]) if res.get("name_at_bank") else None),
            "nms": None if res.get("name_match_score") is None else str(res.get("name_match_score")),
            "ref": None if res.get("reference_id") is None else str(res.get("reference_id")),
            "pst": res.get("account_status_code") or res.get("status"), "fr": reason, "by": str(admin["id"]),
        },
    ).mappings().one()
    from app.audit import write_audit

    write_audit(db, str(admin["id"]), f"payout_details_check:{status}", "user", pujari_id)
    db.commit()
    return {"status": status, "check": _public(dict(row)), "reused": False}


def approve_mismatch(db: Session, verification_id: str, admin: dict, reason: str) -> dict[str, Any]:
    """Super Admin accepts a name mismatch after checking documents (e.g. the account is in a short form of the
    name). Only for the pujari's current details. Commits."""
    check = _row(db, verification_id)
    if not check:
        raise HTTPException(404, "Verification not found")
    if check["status"] != "name_mismatch":
        raise HTTPException(400, "Only a name mismatch can be approved")
    details, latest = latest_for_current_details(db, str(check["pujari_id"]))
    if not latest or str(latest["id"]) != str(check["id"]):
        raise HTTPException(409, "The pujari's payout details changed after this check. Verify them again.")
    db.execute(
        text(
            """
            UPDATE pujari_payout_verifications SET approved_by = CAST(:by AS uuid), approved_at = NOW(), approval_reason = :r
            WHERE id = CAST(:id AS uuid) AND approved_at IS NULL
            """
        ),
        {"by": str(admin["id"]), "r": reason.strip()[:300], "id": verification_id},
    )
    from app.audit import write_audit

    write_audit(db, str(admin["id"]), "payout_details_mismatch_approved", "user", str(check["pujari_id"]), reason=reason[:200])
    db.commit()
    return {"ok": True, "payable": True}


def require_payable(db: Session, pujari_id: str) -> None:
    """Refuse a payout to details that were not verified (when verification is required)."""
    if not verification_required(db):
        return
    _details, check = latest_for_current_details(db, pujari_id)
    if is_payable(check):
        return
    if not check:
        raise HTTPException(409, "Verify this pujari's bank / UPI details before paying them.")
    if check["status"] == "name_mismatch":
        raise HTTPException(409, "The bank's name does not match this pujari. Approve the mismatch after checking their documents, or ask them to fix their details.")
    if check["status"] == "invalid":
        raise HTTPException(409, "This pujari's bank / UPI details are invalid. Ask them to update their payout details.")
    raise HTTPException(409, "The last check of this pujari's bank / UPI details did not complete. Verify them again.")


def record_consent(db: Session, pujari_id: str) -> None:
    db.execute(
        text("UPDATE pujari_profiles SET payout_details_consent_at = :t WHERE user_id = CAST(:p AS uuid)"),
        {"t": datetime.now(timezone.utc), "p": pujari_id},
    )
