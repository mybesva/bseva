"""Pujari settlement payouts to bank account / UPI through Cashfree Payouts.

A settlement is paid either to the pujari's B-Seva wallet (settlement_payout_mode = "wallet", the default and
today's behaviour) or by bank/UPI transfer ("bank") — never both:
- In bank mode the payday sweep only marks settlements eligible; it credits no wallet.
- A transfer starts only from a Super Admin action verified with MPIN + OTP bound to the settlement, its amount
  and the pujari's current bank/UPI details. The settlement moves to "processing", which the wallet sweep and
  the manual override both refuse, and a unique index allows one live or successful transfer per settlement.
- "successful" is recorded only when Cashfree reports SUCCESS (webhook re-checked by API, or the poller),
  never because the create call was accepted. FAILED/REJECTED returns the settlement to eligible; REVERSED
  after success re-opens it and alerts ops.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.payments.cashfree_pg import CashfreeError
from app.payouts import cashfree_payouts as cf
from app.sensitive_auth import SYSTEM_ACTOR, log_event

logger = logging.getLogger(__name__)
PROVIDER = "cashfree"


def _instrument(profile: dict) -> dict | None:
    account = re.sub(r"\s", "", str(profile.get("bank_account_number") or ""))
    ifsc = str(profile.get("bank_ifsc") or "").strip().upper()
    upi = str(profile.get("upi_id") or "").strip().lower()
    name = re.sub(r"[^A-Za-z ]", " ", str(profile.get("bank_holder_name") or profile.get("name") or ""))
    name = re.sub(r"\s+", " ", name).strip()[:100]
    if account and ifsc and name:
        return {"instrument": "bank", "account": account, "ifsc": ifsc, "vpa": None, "name": name,
                "mode": "imps", "masked": f"A/c ••••{account[-4:]} · {ifsc}"}
    if upi and name:
        return {"instrument": "upi", "account": None, "ifsc": None, "vpa": upi, "name": name,
                "mode": "upi", "masked": f"UPI {upi[:2]}•••@{upi.split('@')[-1]}"}
    return None


def _fingerprint(inst: dict) -> str:
    raw = "|".join(str(inst.get(k) or "") for k in ("instrument", "account", "ifsc", "vpa", "name"))
    return hashlib.sha256(raw.encode()).hexdigest()


def pujari_payout_details(db: Session, pujari_id: str) -> dict:
    row = db.execute(
        text(
            """
            SELECT u.name, u.phone, u.email, p.bank_account_number, p.bank_ifsc, p.bank_holder_name, p.upi_id
            FROM users u LEFT JOIN pujari_profiles p ON p.user_id = u.id WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": pujari_id},
    ).mappings().first()
    inst = _instrument(dict(row)) if row else None
    if not inst:
        raise HTTPException(400, "This pujari has no complete bank account or UPI ID for payouts")
    return {**inst, "phone": (row or {}).get("phone"), "email": (row or {}).get("email"), "fingerprint": _fingerprint(inst)}


def payout_split(db: Session, settlement: dict, *, lock: bool = False) -> dict:
    """Gross settlement, the penalty recovered from it and the net bank transfer.

    Penalties (pujari cancel, no-show) are wallet debits that may take the wallet below zero (migration 030);
    in wallet mode the next settlement credit pays that debt off by itself. A bank payout must do the same, so
    the outstanding debt is kept back from the transfer and credited to the wallet when the transfer succeeds.
    Gross = net + recovered: nothing is deducted twice and nothing is credited twice."""
    gross = int(settlement["settlement_amount_paise"] or 0)
    row = db.execute(
        text(f"SELECT balance_paise FROM wallets WHERE user_id = CAST(:u AS uuid){' FOR UPDATE' if lock else ''}"),
        {"u": str(settlement["pujari_id"])},
    ).first()
    balance = int(row[0]) if row else 0
    # Debt already kept back by payouts still in flight is credited only when they succeed: do not keep it back twice.
    reserved = int(
        db.execute(
            text(
                """
                SELECT COALESCE(SUM(penalty_recovered_paise), 0) FROM payouts
                WHERE pujari_id = CAST(:u AS uuid) AND status IN ('initiated', 'pending')
                  AND settlement_id <> CAST(:s AS uuid)
                """
            ),
            {"u": str(settlement["pujari_id"]), "s": str(settlement["id"])},
        ).scalar_one()
    )
    recovered = min(gross, max(0, -balance - reserved))
    return {"gross_paise": gross, "penalty_recovered_paise": recovered, "net_paise": gross - recovered,
            "wallet_balance_paise": balance, "penalty_reserved_paise": reserved}


def payout_reference(db: Session, settlement: dict) -> str:
    """What the Super Admin's OTP is bound to besides settlement and gross amount: the destination and the net
    transfer. A bank-details change or a new penalty after the OTP voids it."""
    fp = pujari_payout_details(db, str(settlement["pujari_id"]))["fingerprint"][:24]
    return f"payout:{fp}:{payout_split(db, settlement)['net_paise']}"


def payout_preview(db: Session, settlement: dict) -> dict:
    d = pujari_payout_details(db, str(settlement["pujari_id"]))
    return {
        "instrument": d["instrument"], "destination": d["masked"], "mode": d["mode"],
        "reference": payout_reference(db, settlement), **payout_split(db, settlement),
    }


def _recover_penalty(db: Session, p: dict, *, reverse: bool = False) -> None:
    """Credit the kept-back penalty to the wallet when the transfer succeeds; debit it again if it is reversed."""
    amount = int(p.get("penalty_recovered_paise") or 0)
    if amount <= 0:
        return
    from app.domain import apply_wallet

    if reverse:
        apply_wallet(db, str(p["pujari_id"]), -amount, "debit", f"Penalty recovery undone (payout {p['transfer_id']} reversed)",
                     None, f"PAYOUT-REVERSE-{p['transfer_id']}", allow_overdraft=True)
    else:
        # A credit only reduces what is owed, so it may land on a wallet that stays below zero.
        apply_wallet(db, str(p["pujari_id"]), amount, "credit", f"Penalty recovered from settlement payout {p['transfer_id']}",
                     None, f"PAYOUT-RECOVER-{p['transfer_id']}", allow_overdraft=True)


def _existing_beneficiary(db: Session, pujari_id: str, beneficiary_id: str, d: dict) -> dict:
    """A 409 means our id exists already, or Cashfree holds this bank account under another id (it allows one
    beneficiary per account + IFSC). Reuse it only if no other pujari here has ever used that beneficiary."""
    try:
        return cf.get_beneficiary(beneficiary_id)
    except CashfreeError as e:
        if e.status != 404 or not (d["account"] and d["ifsc"]):
            raise HTTPException(502, f"Cashfree Payouts could not look up the beneficiary: {e}") from e
    try:
        found = cf.find_beneficiary_by_bank(d["account"], d["ifsc"])
    except CashfreeError as e:
        raise HTTPException(502, f"Cashfree Payouts could not look up the beneficiary: {e}") from e
    other = db.execute(
        text(
            """
            SELECT 1 FROM payout_beneficiaries
            WHERE provider = :p AND beneficiary_id = :bid AND pujari_id <> CAST(:u AS uuid)
            """
        ),
        {"p": PROVIDER, "bid": found.get("beneficiary_id"), "u": pujari_id},
    ).first()
    if other or not found.get("beneficiary_id"):
        raise HTTPException(409, "This bank account is already registered for another pujari's payouts. Ops must review it.")
    return found


def ensure_beneficiary(db: Session, pujari_id: str) -> dict:
    d = pujari_payout_details(db, pujari_id)
    row = db.execute(
        text(
            """
            SELECT * FROM payout_beneficiaries
            WHERE provider = :p AND pujari_id = CAST(:u AS uuid) AND details_fingerprint = :f AND status = 'active'
            """
        ),
        {"p": PROVIDER, "u": pujari_id, "f": d["fingerprint"]},
    ).mappings().first()
    if row:
        return {**dict(row), "mode": d["mode"]}
    beneficiary_id = f"BSVP{UUID(pujari_id).hex[:24]}{d['fingerprint'][:8]}"
    phone = re.sub(r"\D", "", str(d.get("phone") or ""))[-10:] or None
    try:
        created = cf.create_beneficiary(
            beneficiary_id=beneficiary_id, name=d["name"], account=d["account"], ifsc=d["ifsc"], vpa=d["vpa"],
            phone=phone, email=d.get("email"),
        )
    except CashfreeError as e:
        if e.status == 400:
            raise HTTPException(400, f"Cashfree Payouts rejected the pujari's payout details: {e}") from e
        if e.status != 409:
            raise HTTPException(502, f"Cashfree Payouts could not register the beneficiary: {e}") from e
        created = _existing_beneficiary(db, pujari_id, beneficiary_id, d)
        beneficiary_id = created["beneficiary_id"]
    db.execute(
        text(
            """
            UPDATE payout_beneficiaries SET status = 'superseded', updated_at = NOW()
            WHERE provider = :p AND pujari_id = CAST(:u AS uuid) AND status = 'active'
            """
        ),
        {"p": PROVIDER, "u": pujari_id},
    )
    row = db.execute(
        text(
            """
            INSERT INTO payout_beneficiaries (pujari_id, provider, beneficiary_id, instrument, details_fingerprint,
              masked_details, provider_status)
            VALUES (CAST(:u AS uuid), :p, :bid, :inst, :f, :m, :st)
            ON CONFLICT (provider, pujari_id, details_fingerprint) DO UPDATE SET status = 'active', beneficiary_id = EXCLUDED.beneficiary_id,
              masked_details = EXCLUDED.masked_details, provider_status = EXCLUDED.provider_status, updated_at = NOW()
            RETURNING *
            """
        ),
        {
            "u": pujari_id, "p": PROVIDER, "bid": beneficiary_id, "inst": d["instrument"], "f": d["fingerprint"],
            "m": d["masked"], "st": (created or {}).get("beneficiary_status"),
        },
    ).mappings().one()
    return {**dict(row), "mode": d["mode"]}


def _transfer_id(settlement_id: str, attempt: int) -> str:
    return f"BSVT{UUID(settlement_id).hex[:28]}A{attempt}"[:40]


def initiate_payout(db: Session, admin: dict, settlement_id: str, *, ip: str | None, expected_net: int | None = None) -> dict:
    """Called after verify_challenge passed. Locks the settlement, records the transfer, commits, then sends it."""
    s = db.execute(
        text("SELECT * FROM settlements WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": settlement_id}
    ).mappings().first()
    if not s:
        raise HTTPException(404, "Settlement not found")
    from app.settlement_cycle import today_ist

    due = s["due_date"] is not None and s["due_date"] <= today_ist()
    if s["status"] not in ("pending", "eligible") or (s["status"] == "pending" and not due):
        raise HTTPException(400, f"This settlement is {s['status']}{'' if due else ' and not yet due'}; nothing was paid")
    gross = int(s["settlement_amount_paise"] or 0)
    live = db.execute(
        text("SELECT id FROM payouts WHERE settlement_id = CAST(:id AS uuid) AND status IN ('initiated', 'pending', 'successful')"),
        {"id": settlement_id},
    ).first()
    if live:
        raise HTTPException(409, "A payout for this settlement already exists")
    # Wallet row locked from here to commit, so a penalty landing now cannot slip past the split.
    split = payout_split(db, dict(s), lock=True)
    if expected_net is not None and split["net_paise"] != expected_net:
        raise HTTPException(409, "The pujari's penalty balance changed after the OTP. Nothing was paid; request a new OTP.")
    if split["net_paise"] == 0 and gross > 0:
        # The whole settlement goes to the penalty the pujari owes: settle it to the wallet, no transfer.
        from app.domain import apply_wallet

        apply_wallet(db, str(s["pujari_id"]), gross, "credit", f"Settlement {settlement_id[:8]} applied to penalty owed", str(s["booking_id"]),
                     f"PENALTY-OFFSET-{settlement_id[:8]}", allow_overdraft=True)
        db.execute(
            text(
                """
                UPDATE settlements SET status = 'settled', settled_at = NOW(), payment_reference = 'PENALTY_OFFSET',
                  override_reason = 'Settlement applied to penalty owed (no bank transfer)', updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": settlement_id},
        )
        db.execute(text("UPDATE bookings SET settlement_status = 'settled' WHERE id = :id"), {"id": s["booking_id"]})
        log_event(db, admin, "settled", "success", settlement_id=settlement_id, amount_paise=gross, reference="PENALTY_OFFSET",
                  reason="Whole settlement applied to the pujari's penalty balance", ip=ip)
        db.commit()
        return {"status": "settled_to_penalty", "net_paise": 0, "penalty_recovered_paise": gross}
    amount = split["net_paise"]
    if amount < 100:
        raise HTTPException(400, "The net payout after penalties is too small for a bank transfer")
    ben = ensure_beneficiary(db, str(s["pujari_id"]))
    attempt = int(
        db.execute(text("SELECT COUNT(*) FROM payouts WHERE settlement_id = CAST(:id AS uuid)"), {"id": settlement_id}).scalar() or 0
    ) + 1
    payout = db.execute(
        text(
            """
            INSERT INTO payouts (settlement_id, pujari_id, provider, transfer_id, beneficiary_id, transfer_mode,
              amount_paise, settlement_amount_paise, penalty_recovered_paise, attempt_no, initiated_by)
            VALUES (CAST(:s AS uuid), CAST(:p AS uuid), :prov, :tid, :bid, :mode, :amt, :gross, :rec, :att, CAST(:by AS uuid))
            RETURNING *
            """
        ),
        {
            "s": settlement_id, "p": str(s["pujari_id"]), "prov": PROVIDER, "tid": _transfer_id(settlement_id, attempt),
            "bid": ben["beneficiary_id"], "mode": ben["mode"], "amt": amount, "gross": gross,
            "rec": split["penalty_recovered_paise"], "att": attempt, "by": str(admin["id"]),
        },
    ).mappings().one()
    db.execute(
        text("UPDATE settlements SET status = 'processing', updated_at = NOW() WHERE id = CAST(:id AS uuid)"),
        {"id": settlement_id},
    )
    db.execute(
        text("UPDATE bookings SET settlement_status = 'processing' WHERE id = CAST(:id AS uuid)"), {"id": str(s["booking_id"])}
    )
    log_event(db, admin, "payout_initiated", "pending", settlement_id=settlement_id, amount_paise=amount,
              reference=payout["transfer_id"], ip=ip,
              reason=f"gross {gross} - penalty recovered {split['penalty_recovered_paise']} = net {amount} paise")
    db.commit()
    return submit_transfer(db, str(payout["id"]))


def submit_transfer(db: Session, payout_id: str) -> dict:
    """Send (or resend, with the same transfer id) one transfer, then record what Cashfree reports. Commits."""
    p = dict(db.execute(text("SELECT * FROM payouts WHERE id = CAST(:id AS uuid)"), {"id": payout_id}).mappings().one())
    if p["status"] != "initiated":
        return refresh_payout(db, p)
    try:
        data = cf.create_transfer(
            transfer_id=p["transfer_id"], amount_paise=int(p["amount_paise"]), beneficiary_id=p["beneficiary_id"],
            mode=p["transfer_mode"] or "banktransfer", remarks="BSeva settlement",
        )
    except CashfreeError as e:
        if e.retryable:
            # Unknown outcome: keep "initiated"; recovery reads it back by transfer id before any resend.
            _touch(db, payout_id, detail=f"Waiting for Cashfree: {e}")
            return {"payout_id": payout_id, "status": "initiated"}
        try:
            data = cf.get_transfer(p["transfer_id"])
        except CashfreeError:
            return apply_transfer_state(db, p, {"status": "failed", "raw_status": "REJECTED", "detail": str(e)[:200]})
    return apply_transfer_state(db, p, cf.normalise_transfer(data))


def refresh_payout(db: Session, p: dict) -> dict:
    try:
        data = cf.get_transfer(p["transfer_id"])
    except CashfreeError as e:
        if e.status == 404 and p["status"] == "initiated":
            # Never reached Cashfree: safe to send now with the same transfer id.
            db.rollback()
            return submit_transfer(db, str(p["id"]))
        _touch(db, str(p["id"]), detail=f"Status check failed: {e}")
        return {"payout_id": str(p["id"]), "status": p["status"]}
    return apply_transfer_state(db, p, cf.normalise_transfer(data))


def _touch(db: Session, payout_id: str, *, detail: str) -> None:
    db.execute(
        text(
            """
            UPDATE payouts SET last_checked_at = NOW(), check_attempts = check_attempts + 1, status_detail = :d,
              updated_at = NOW() WHERE id = CAST(:id AS uuid)
            """
        ),
        {"d": detail[:300], "id": payout_id},
    )
    db.commit()


def _notify_ops(db: Session, title: str, body: str) -> None:
    try:
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(db, title=title, body=body, category="payment", link="/admin/settlements")
    except Exception:
        logger.exception("payout_ops_notify_failed")


ALLOWED = {
    "initiated": {"pending", "successful", "failed", "reversed"},
    "pending": {"successful", "failed", "reversed"},
    "successful": {"reversed"},
    "failed": set(),
    "reversed": set(),
}


def apply_transfer_state(db: Session, payout: dict, state: dict) -> dict:
    """Apply a verified transfer state under row locks. Idempotent and monotonic. Commits."""
    p = dict(db.execute(text("SELECT * FROM payouts WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": str(payout["id"])}).mappings().one())
    new = state["status"]
    if state.get("amount_paise") is not None and int(state["amount_paise"]) != int(p["amount_paise"]):
        _touch(db, str(p["id"]), detail="Amount reported by Cashfree does not match; held for review")
        _notify_ops(db, "Payout needs review", f"Transfer {p['transfer_id']}: Cashfree reported a different amount.")
        db.commit()
        return {"payout_id": str(p["id"]), "status": p["status"], "review": True}
    if new == p["status"] or new not in ALLOWED[p["status"]]:
        db.execute(
            text(
                """
                UPDATE payouts SET provider_status = COALESCE(:raw, provider_status), last_checked_at = NOW(),
                  check_attempts = check_attempts + 1, updated_at = NOW() WHERE id = CAST(:id AS uuid)
                """
            ),
            {"raw": state.get("raw_status"), "id": str(p["id"])},
        )
        db.commit()
        return {"payout_id": str(p["id"]), "status": p["status"]}
    db.execute(
        text(
            """
            UPDATE payouts SET status = :st, provider_status = :raw, status_detail = :d,
              provider_transfer_id = COALESCE(:cfid, provider_transfer_id), utr = COALESCE(:utr, utr),
              completed_at = CASE WHEN :st IN ('successful', 'failed', 'reversed') THEN NOW() ELSE completed_at END,
              last_checked_at = NOW(), check_attempts = check_attempts + 1, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "st": new, "raw": state.get("raw_status"), "d": (state.get("detail") or None), "cfid": state.get("cf_transfer_id"),
            "utr": state.get("utr"), "id": str(p["id"]),
        },
    )
    s = db.execute(
        text("SELECT * FROM settlements WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": str(p["settlement_id"])}
    ).mappings().one()
    audit = {"settlement_id": str(s["id"]), "amount_paise": int(p["amount_paise"]), "reference": p["transfer_id"]}
    if new == "successful":
        db.execute(
            text(
                """
                UPDATE settlements SET status = 'settled', settled_at = NOW(), override_flag = FALSE,
                  override_reason = :r, payment_reference = :ref, updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND status = 'processing'
                """
            ),
            {"r": f"Bank/UPI payout {p['transfer_id']}", "ref": state.get("utr") or p["transfer_id"], "id": str(s["id"])},
        )
        db.execute(text("UPDATE bookings SET settlement_status = 'settled' WHERE id = :id"), {"id": s["booking_id"]})
        _recover_penalty(db, p)
        log_event(db, SYSTEM_ACTOR, "settled", "success", reason="Cashfree payout SUCCESS", **audit)
    elif new in ("failed", "reversed"):
        db.execute(
            text(
                """
                UPDATE settlements SET status = 'eligible', settled_at = NULL,
                  payment_reference = CASE WHEN status = 'settled' THEN NULL ELSE payment_reference END, updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND status IN ('processing', 'settled')
                """
            ),
            {"id": str(s["id"])},
        )
        db.execute(text("UPDATE bookings SET settlement_status = 'eligible' WHERE id = :id"), {"id": s["booking_id"]})
        if new == "reversed" and p["status"] == "successful":
            _recover_penalty(db, p, reverse=True)
        log_event(db, SYSTEM_ACTOR, f"payout_{new}", "failed", reason=str(state.get("detail") or state.get("raw_status") or new)[:200], **audit)
        _notify_ops(
            db,
            "Payout reversed" if new == "reversed" else "Payout failed",
            f"Transfer {p['transfer_id']} {new}. The settlement is eligible again and needs a new approved payout.",
        )
    db.commit()
    return {"payout_id": str(p["id"]), "status": new}


def recover_payouts(db: Session, *, limit: int = 50) -> dict:
    rows = db.execute(
        text(
            """
            SELECT * FROM payouts
            WHERE status IN ('initiated', 'pending') AND created_at < NOW() - INTERVAL '1 minute'
              AND (last_checked_at IS NULL
                   OR last_checked_at < NOW() - make_interval(secs => LEAST(3600, 60 * GREATEST(1, check_attempts))))
            ORDER BY last_checked_at NULLS FIRST LIMIT :lim
            """
        ),
        {"lim": limit},
    ).mappings().all()
    db.commit()
    counts: dict[str, int] = {}
    for p in rows:
        try:
            status = refresh_payout(db, dict(p))["status"]
        except Exception:
            db.rollback()
            logger.exception("payout_recover_failed transfer=%s", p["transfer_id"])
            status = "error"
        counts[status] = counts.get(status, 0) + 1
    return counts


def run_payout_jobs(db: Session) -> dict:
    from app.config import settings

    if not settings.cashfree_payouts_configured:
        return {"skipped": "not_configured"}
    return recover_payouts(db)


def payout_by_transfer(db: Session, transfer_id: str) -> dict[str, Any] | None:
    row = db.execute(text("SELECT * FROM payouts WHERE transfer_id = :t"), {"t": transfer_id}).mappings().first()
    return dict(row) if row else None
