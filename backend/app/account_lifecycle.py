"""Account deletion: obligations check, deactivation, cancellation and the final delete/anonymise step.

States on account_deletion_requests:
  requested -> pending_resolution (bookings or money still open) -> ready -> deleted
  any open state -> cancelled (user, by email OTP) | escalated (deadline passed while not ready)

users.account_state is 'deletion_requested' from the verified request until it is cancelled or the
account becomes 'deleted'. The API refuses every authenticated call in those states (deps.current_user).
Financial and tax records are never deleted: bookings, payments, wallet ledger, settlements, invoices.
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.platform_config import get_setting

logger = logging.getLogger("bseva.account")

REASONS: dict[str, str] = {
    "no_longer_using": "No longer using B-Seva",
    "not_satisfied": "Not satisfied with service",
    "privacy": "Privacy concerns",
    "payment_settlement": "Payment or settlement concerns",
    "app_issues": "Application issues",
    "duplicate_account": "Duplicate account",
    "other": "Other",
}
OPEN_STATES = ("requested", "pending_resolution", "ready", "escalated")
DEACTIVATED_MESSAGE = (
    "Your account has been deactivated. Your account deletion request will be completed within 14 days, "
    "subject to any legally required retention or unresolved obligations. You will receive confirmation by email."
)
RETENTION_NOTICE = (
    "When your account is deleted we remove or anonymise your profile, addresses, photos, documents, "
    "location history and device data. We keep GST invoices, payment, wallet, refund and settlement records, "
    "and records needed for an open complaint, dispute or legal requirement, for the period the law requires. "
    "Data in backups is removed when those backups expire."
)
# Telugu copy for what the deletion screens show from the server. Needs native-speaker review.
TE = {
    "deactivated": "మీ ఖాతా నిష్క్రియం చేయబడింది. చట్టపరంగా భద్రపరచాల్సిన రికార్డులు లేదా పరిష్కారం కాని బాధ్యతలకు లోబడి, "
    "మీ ఖాతా తొలగింపు అభ్యర్థన 14 రోజుల్లో పూర్తవుతుంది. ధృవీకరణ ఇమెయిల్ ద్వారా వస్తుంది.",
    "retention": "మీ ఖాతా తొలగించినప్పుడు మీ ప్రొఫైల్, చిరునామాలు, ఫోటోలు, పత్రాలు, లొకేషన్ చరిత్ర మరియు పరికర డేటాను తొలగిస్తాం లేదా "
    "గుర్తించలేని విధంగా మారుస్తాం. GST ఇన్వాయిస్‌లు, చెల్లింపు, వాలెట్, వాపసు మరియు సెటిల్‌మెంట్ రికార్డులు, తెరిచి ఉన్న ఫిర్యాదు, "
    "వివాదం లేదా చట్టపరమైన అవసరానికి కావాల్సిన రికార్డులను చట్టం నిర్దేశించిన కాలం వరకు భద్రపరుస్తాం. బ్యాకప్‌లలోని డేటా ఆ బ్యాకప్‌ల "
    "గడువు ముగిసినప్పుడు తొలగిపోతుంది.",
    "reasons": {
        "no_longer_using": "నేను ఇకపై B-Seva ఉపయోగించడం లేదు",
        "not_satisfied": "సేవతో సంతృప్తిగా లేను",
        "privacy": "గోప్యత సమస్యలు",
        "payment_settlement": "చెల్లింపు లేదా సెటిల్‌మెంట్ సమస్య",
        "app_issues": "యాప్‌లో సమస్యలు",
        "duplicate_account": "నాకు మరో ఖాతా ఉంది",
        "other": "ఇతర కారణం",
    },
}
UPCOMING = ("pending", "pending_acceptance", "confirmed")
# Online bookings whose payment never completed: nothing was charged, so they are closed, not cancelled.
UNPAID = ("awaiting_payment",)
ONGOING = ("in_progress",)


def deletion_period_days(db: Session) -> int:
    try:
        return max(1, int(get_setting(db, "account_deletion_period_days", 14) or 14))
    except (TypeError, ValueError):
        return 14


def _actor_name(user: dict | None) -> str:
    if not user:
        return "System"
    return str(user.get("name") or user.get("email") or "User")


def add_event(db: Session, request_id: str, action: str, actor: dict | None = None, **detail: Any) -> None:
    db.execute(
        text(
            """
            INSERT INTO account_deletion_events (request_id, actor_id, actor_name, action, detail)
            VALUES (CAST(:r AS uuid), CAST(:a AS uuid), :n, :act, CAST(:d AS jsonb))
            """
        ),
        {
            "r": request_id,
            "a": str(actor["id"]) if actor and actor.get("id") else None,
            "n": _actor_name(actor),
            "act": action,
            "d": json.dumps(detail, default=str),
        },
    )


def _wallet_balance(db: Session, user_id: str) -> int:
    return int(
        db.execute(text("SELECT balance_paise FROM wallets WHERE user_id = CAST(:id AS uuid)"), {"id": user_id}).scalar()
        or 0
    )


def _booking_rows(db: Session, column: str, user_id: str, statuses: tuple[str, ...]) -> list[dict]:
    rows = db.execute(
        text(
            f"""
            SELECT b.id, b.booking_number, b.booking_date, b.start_time, b.status, b.payment_status,
                   COALESCE(s.name, 'Puja') AS service_name
            FROM bookings b LEFT JOIN services s ON s.id = b.service_id
            WHERE b.{column} = CAST(:id AS uuid) AND b.status = ANY(:st)
            ORDER BY b.booking_date, b.start_time
            """
        ),
        {"id": user_id, "st": list(statuses)},
    ).mappings().all()
    return [dict(r) for r in rows]


def _fmt(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "booking_number": str(row.get("booking_number") or ""),
        "service_name": str(row.get("service_name") or "Puja"),
        "booking_date": row["booking_date"].isoformat() if row.get("booking_date") else "",
        "start_time": row["start_time"].isoformat() if row.get("start_time") else "",
        "status": str(row.get("status") or ""),
    }


def obligations(db: Session, user: dict, *, preview_cancellations: bool = True) -> dict[str, Any]:
    """What is still open for this account. `blocking` lists what final deletion waits for."""
    uid = str(user["id"])
    role = user.get("role") or "customer"
    bookings: list[dict] = []
    blocking: list[str] = []
    pending_settlement = 0
    balance = _wallet_balance(db, uid)
    if role == "customer":
        for row in _booking_rows(db, "customer_id", uid, UNPAID):
            bookings.append({**_fmt(row), "kind": "unpaid", "action": "close"})
        for row in _booking_rows(db, "customer_id", uid, UPCOMING):
            item = {**_fmt(row), "kind": "upcoming"}
            if preview_cancellations:
                item["cancellation"] = _cancellation_preview(db, user, item["id"])
            bookings.append(item)
        for row in _booking_rows(db, "customer_id", uid, ONGOING):
            bookings.append({**_fmt(row), "kind": "ongoing"})
            blocking.append(f"Booking {row['booking_number']} is in progress and will be completed first.")
        if balance > 0:
            blocking.append(
                f"Your wallet balance of ₹{balance / 100:,.0f} will be returned to you by B-Seva before deletion."
            )
        elif balance < 0:
            blocking.append(f"An amount of ₹{-balance / 100:,.0f} is due on your wallet and must be settled.")
    else:
        for row in _booking_rows(db, "pujari_id", uid, UPCOMING):
            bookings.append({**_fmt(row), "kind": "upcoming", "action": "reassign"})
        for row in _booking_rows(db, "pujari_id", uid, ONGOING):
            bookings.append({**_fmt(row), "kind": "ongoing"})
            blocking.append(f"Booking {row['booking_number']} is in progress and will be completed first.")
        pending_settlement = int(
            db.execute(
                text(
                    """
                    SELECT COALESCE(SUM(pujari_payable_paise), 0) FROM bookings
                    WHERE pujari_id = CAST(:id AS uuid) AND status = 'completed' AND settlement_status = 'pending'
                    """
                ),
                {"id": uid},
            ).scalar()
            or 0
        )
        if pending_settlement:
            blocking.append(
                f"Payouts of ₹{pending_settlement / 100:,.0f} for completed pujas will be settled to your bank account first."
            )
        if balance < 0:
            blocking.append(f"An amount of ₹{-balance / 100:,.0f} owed to B-Seva must be settled.")
        elif balance > 0:
            blocking.append(f"Your wallet balance of ₹{balance / 100:,.0f} will be paid out before deletion.")
    return {
        "bookings": bookings,
        "wallet_balance_paise": balance,
        "pending_refunds": 0,
        "pending_settlement_paise": pending_settlement,
        "blocking": blocking,
    }


def _cancellation_preview(db: Session, user: dict, booking_id: str) -> dict:
    from fastapi import HTTPException

    from app.routers.bookings import cancel_preview

    try:
        out = cancel_preview(booking_id, user=user, db=db)
    except HTTPException as e:
        return {"allowed": False, "refund_paise": 0, "fee_paise": 0, "policy_note": str(e.detail)}
    return {
        "allowed": bool(out.get("allowed", True)),
        "refund_paise": int(out.get("refund_paise") or 0),
        "fee_paise": int(out.get("fee_paise") or 0),
        "policy_note": f"Cancellation fee {out.get('fee_percent', 0)}% under the Cancellation Policy",
    }


def open_request(db: Session, user_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT * FROM account_deletion_requests WHERE user_id = CAST(:id AS uuid)
            ORDER BY requested_at DESC LIMIT 1
            """
        ),
        {"id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def request_public(req: dict | None) -> dict | None:
    if not req:
        return None
    iso = lambda v: v.isoformat() if v else None  # noqa: E731
    state = req["state"]
    messages = {
        "requested": DEACTIVATED_MESSAGE,
        "pending_resolution": DEACTIVATED_MESSAGE,
        "ready": DEACTIVATED_MESSAGE,
        "escalated": "Your deletion request needs more time because of an open booking, payment or dispute. "
        "Our team will contact you by email.",
        "cancelled": "This deletion request was cancelled.",
        "deleted": "This account has been deleted.",
    }
    return {
        "id": str(req["id"]),
        "state": state,
        "reason": req["reason"],
        "explanation": req["explanation"],
        "requested_at": iso(req["requested_at"]),
        "deadline_at": iso(req["deadline_at"]),
        "cancelled_at": iso(req.get("cancelled_at")),
        "completed_at": iso(req.get("completed_at")),
        "message": messages.get(state, ""),
    }


def overview(db: Session, user: dict, lang: str = "en") -> dict[str, Any]:
    req = open_request(db, str(user["id"]))
    te = lang == "te"
    public = request_public(req)
    if te and public and public["state"] in ("requested", "pending_resolution", "ready"):
        public["message"] = TE["deactivated"]
    return {
        "account": {"role": user.get("role"), "email": user.get("email"), "name": user.get("name")},
        "request": public,
        "reasons": [{"key": k, "label": TE["reasons"][k] if te else v} for k, v in REASONS.items()],
        "obligations": obligations(db, user, preview_cancellations=user.get("account_state", "active") == "active"),
        "retention_notice": TE["retention"] if te else RETENTION_NOTICE,
    }


def validate_request_fields(reason: str, explanation: str) -> tuple[str, str]:
    from fastapi import HTTPException

    reason = (reason or "").strip()
    explanation = (explanation or "").strip()
    if reason not in REASONS:
        raise HTTPException(400, "Choose a reason for deleting your account")
    if not 10 <= len(explanation) <= 500:
        raise HTTPException(400, "Please explain in 10 to 500 characters")
    return reason, explanation


def create_request(db: Session, user: dict, *, reason: str, explanation: str, source: str) -> dict:
    """Called after the email OTP was verified. Deactivates the account and resolves bookings."""
    from fastapi import HTTPException

    uid = str(user["id"])
    locked = db.execute(
        text("SELECT * FROM users WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": uid}
    ).mappings().first()
    if not locked or locked["role"] not in ("customer", "pujari", "head_pujari"):
        raise HTTPException(400, "This account cannot be deleted here. Please contact B-Seva support.")
    if (locked.get("account_state") or "active") != "active":
        existing = open_request(db, uid)
        db.rollback()
        return {"request": request_public(existing), "already": True}
    user = dict(locked)
    days = deletion_period_days(db)
    deadline = datetime.now(timezone.utc) + timedelta(days=days)
    before = obligations(db, user, preview_cancellations=True)
    req_id = str(
        db.execute(
            text(
                """
                INSERT INTO account_deletion_requests
                  (user_id, role, contact_email, reason, explanation, source, deadline_at, obligations, retention_note)
                VALUES (CAST(:u AS uuid), :role, :email, :reason, :exp, :src, :deadline, CAST(:ob AS jsonb), :ret)
                RETURNING id
                """
            ),
            {
                "u": uid,
                "role": user["role"],
                "email": user.get("email"),
                "reason": reason,
                "exp": explanation,
                "src": source,
                "deadline": deadline,
                "ob": json.dumps(before, default=str),
                "ret": RETENTION_NOTICE,
            },
        ).scalar()
    )
    add_event(db, req_id, "requested", user, reason=reason, source=source, deadline=deadline.isoformat())
    # Deactivate before touching bookings so nothing new can start meanwhile.
    db.execute(
        text(
            """
            UPDATE users SET account_state = 'deletion_requested', sessions_revoked_at = NOW(),
              updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": uid},
    )
    if user["role"] in ("pujari", "head_pujari"):
        db.execute(text("UPDATE pujari_profiles SET available = FALSE WHERE user_id = CAST(:id AS uuid)"), {"id": uid})
        _withdraw_offers(db, uid)
    db.commit()

    resolved = _resolve_bookings(db, user, req_id)
    _refresh_state(db, req_id, user, actor=None)
    db.commit()
    _notify_requested(db, user, req_id, deadline, resolved)
    db.commit()
    return {"request": request_public(open_request(db, uid)), "already": False}


def _withdraw_offers(db: Session, pujari_id: str) -> None:
    try:
        with db.begin_nested():
            db.execute(
                text(
                    """
                    UPDATE booking_pujari_offers SET status = 'withdrawn'
                    WHERE pujari_id = CAST(:id AS uuid) AND status IN ('pending', 'offered', 'open')
                    """
                ),
                {"id": pujari_id},
            )
    except SQLAlchemyError:
        logger.warning("offer_withdraw_skipped pujari=%s", pujari_id)


def _resolve_bookings(db: Session, user: dict, req_id: str) -> list[dict]:
    """Customer: cancel upcoming bookings under the normal policy. Pujari: release accepted bookings for reassignment."""
    from fastapi import HTTPException

    uid = str(user["id"])
    out: list[dict] = []
    if user["role"] == "customer":
        from app.payments.service import abandon_unpaid_booking
        from app.routers.bookings import cancel_booking

        # Unpaid online bookings first: one that turns out to be paid is then cancelled with the upcoming ones below.
        for row in _booking_rows(db, "customer_id", uid, UNPAID):
            bid = str(row["id"])
            try:
                res = abandon_unpaid_booking(db, bid, user, reason="Customer requested account deletion")
                if not res["paid"]:
                    out.append({"booking_id": bid, "action": "closed_unpaid", "refund_paise": 0})
            except Exception as e:  # noqa: BLE001 - a gateway outage must not stop the deletion request
                db.rollback()
                logger.warning("unpaid_booking_close_failed booking=%s", bid, exc_info=True)
                out.append({"booking_id": bid, "action": "needs_admin", "error": str(e)[:200]})
        for row in _booking_rows(db, "customer_id", uid, UPCOMING):
            bid = str(row["id"])
            try:
                res = cancel_booking(bid, reason="Customer requested account deletion", user=user, db=db)
                out.append({"booking_id": bid, "action": "cancelled", "refund_paise": res.get("refund_paise", 0)})
            except HTTPException as e:
                db.rollback()
                out.append({"booking_id": bid, "action": "needs_admin", "error": str(e.detail)})
    else:
        from app.routers.bookings import _pujari_cancel_release

        for row in _booking_rows(db, "pujari_id", uid, UPCOMING):
            bid = str(row["id"])
            b = db.execute(
                text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": bid}
            ).mappings().first()
            if not b or not b.get("pujari_id"):
                continue
            try:
                # No cancellation penalty: the booking goes back out to other pujaris.
                _pujari_cancel_release(db, dict(b), bid, user, "account_deletion", 0, {"policy": "account_deletion"})
                out.append({"booking_id": bid, "action": "reassignment_started"})
            except HTTPException as e:
                db.rollback()
                out.append({"booking_id": bid, "action": "needs_admin", "error": str(e.detail)})
    add_event(db, req_id, "bookings_resolved", None, bookings=out)
    db.commit()
    return out


def _refresh_state(db: Session, req_id: str, user: dict, actor: dict | None) -> str:
    """Move between requested / pending_resolution / ready from the current obligations."""
    req = db.execute(
        text("SELECT * FROM account_deletion_requests WHERE id = CAST(:id AS uuid)"), {"id": req_id}
    ).mappings().first()
    if not req or req["state"] not in ("requested", "pending_resolution", "ready"):
        return req["state"] if req else ""
    ob = obligations(db, user, preview_cancellations=False)
    hard = [b for b in ob["bookings"] if b["kind"] == "ongoing" or (b["kind"] == "upcoming" and user["role"] == "customer")]
    money_open = ob["pending_settlement_paise"] > 0 or ob["wallet_balance_paise"] != 0
    # Money questions need an admin to confirm they were handled (review complete); bookings must be closed.
    if hard or (money_open and not req["review_completed_at"]):
        new_state = "pending_resolution"
    else:
        new_state = "ready"
    if new_state != req["state"]:
        db.execute(
            text(
                """
                UPDATE account_deletion_requests SET state = :s, obligations = CAST(:ob AS jsonb), updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"s": new_state, "ob": json.dumps(ob, default=str), "id": req_id},
        )
        add_event(db, req_id, f"state_{new_state}", actor, blocking=ob["blocking"])
    return new_state


def cancel_request(db: Session, user_row: dict) -> bool:
    req = open_request(db, str(user_row["id"]))
    if not req or req["state"] not in OPEN_STATES:
        return False
    db.execute(
        text(
            """
            UPDATE account_deletion_requests SET state = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": str(req["id"])},
    )
    add_event(db, str(req["id"]), "cancelled", user_row)
    db.execute(
        text(
            """
            UPDATE users SET account_state = 'active', sessions_revoked_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid) AND account_state = 'deletion_requested'
            """
        ),
        {"id": str(user_row["id"])},
    )
    db.commit()
    _email(user_row.get("email"), "Account Deletion Cancelled",
           "Your account deletion request was cancelled and your account is active again. Bookings that were cancelled "
           "when you made the request are not restored.")
    _notify_admins(db, "Account Deletion Cancelled", f"{_actor_name(user_row)} cancelled their deletion request.", str(req["id"]))
    db.commit()
    return True


# --- final deletion -------------------------------------------------------------------------------

def _try(db: Session, sql: str, params: dict) -> None:
    """Run one cleanup statement; tables that do not exist in an environment are skipped."""
    try:
        with db.begin_nested():
            db.execute(text(sql), params)
    except SQLAlchemyError as e:
        logger.warning("account_cleanup_skipped sql=%s error=%s", sql.split()[0:4], str(e).splitlines()[0][:160])


def _storage_paths(db: Session, uid: str) -> list[str]:
    paths: list[str] = []
    for sql in (
        "SELECT storage_path FROM pujari_documents WHERE pujari_id = CAST(:id AS uuid)",
        "SELECT profile_photo_path FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)",
        "SELECT signature_path FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)",
        "SELECT profile_photo_path FROM customer_profiles WHERE user_id = CAST(:id AS uuid)",
    ):
        try:
            with db.begin_nested():
                paths += [p for p in db.execute(text(sql), {"id": uid}).scalars().all() if p]
        except SQLAlchemyError:
            continue
    return paths


def anonymise_user(db: Session, uid: str) -> dict:
    """Delete personal data and anonymise the user row. Financial and tax records stay intact."""
    from app.security import hash_password

    user = db.execute(text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": uid}).mappings().first()
    if not user:
        return {"ok": False}
    email = str(user.get("email") or "")
    p = {"id": uid}
    files = _storage_paths(db, uid)
    removed_files = 0
    if files:
        from app.storage import delete_object

        for path in files:
            try:
                delete_object(path)
                removed_files += 1
            except Exception:
                logger.warning("account_file_delete_failed user=%s", uid)
    # Personal data that serves no remaining purpose.
    for sql in (
        "UPDATE seva_event_registrations SET prasad_address_id = NULL WHERE customer_id = CAST(:id AS uuid)",
        "DELETE FROM customer_addresses WHERE user_id = CAST(:id AS uuid)",
        "DELETE FROM customer_family_members WHERE customer_id = CAST(:id AS uuid)",
        "DELETE FROM customer_profiles WHERE user_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_documents WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_angikara WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_document_versions WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_blocked_dates WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_service_offers WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_service_applications WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_location_pings WHERE pujari_id = CAST(:id AS uuid)",
        "DELETE FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)",
        "DELETE FROM fcm_device_tokens WHERE user_id = CAST(:id AS uuid)",
        "DELETE FROM notifications WHERE user_id = CAST(:id AS uuid)",
        "DELETE FROM security_challenges WHERE user_id = CAST(:id AS uuid)",
        "UPDATE ratings SET comment = NULL WHERE from_user_id = CAST(:id AS uuid)",
        # Kept booking rows lose the personal details; amounts, dates and status stay for the records.
        """UPDATE bookings SET address = NULL, location_label = NULL, latitude = NULL, longitude = NULL,
             special_instructions = NULL, meeting_url = NULL, meeting_invite_token = NULL,
             start_otp_code = NULL, complete_otp_code = NULL
           WHERE customer_id = CAST(:id AS uuid) AND status IN ('completed', 'cancelled', 'rejected', 'no_show')""",
        "UPDATE recurring_series SET address = NULL, latitude = NULL, longitude = NULL WHERE customer_id = CAST(:id AS uuid)",
        """UPDATE seva_event_registrations SET primary_name = 'Deleted User', gotra = NULL, sankalp_text = NULL,
             family_members = '[]'::jsonb WHERE customer_id = CAST(:id AS uuid)""",
        "UPDATE muhurta_consultations SET guidance_notes = NULL WHERE customer_id = CAST(:id AS uuid)",
        "UPDATE support_tickets SET guest_name = NULL, guest_phone = NULL, guest_email = NULL WHERE user_id = CAST(:id AS uuid)",
    ):
        _try(db, sql, p)
    if email:
        _try(db, "DELETE FROM otp_codes WHERE lower(email::text) = lower(:e)", {"e": email})
    _try(
        db,
        """
        UPDATE users SET name = 'Deleted User', first_name = NULL, middle_name = NULL, last_name = NULL,
          email = :email, phone = NULL, password_hash = :pw, account_state = 'deleted', deleted_at = NOW(),
          sessions_revoked_at = NOW(), updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
        """,
        {"id": uid, "email": f"deleted-{uid}@deleted.invalid", "pw": hash_password(secrets.token_urlsafe(32))},
    )
    return {"ok": True, "files_removed": removed_files}


def run_due_deletions(db: Session) -> dict:
    """Daily: refresh open requests, warn three days ahead, delete ready ones at the deadline, escalate the rest."""
    from app.jobs.dedupe import claim_once

    now = datetime.now(timezone.utc)
    stats = {"deleted": 0, "escalated": 0, "warned": 0, "refreshed": 0}
    rows = db.execute(
        text(
            """
            SELECT r.*, u.role AS user_role, u.name AS user_name, u.email AS user_email
            FROM account_deletion_requests r JOIN users u ON u.id = r.user_id
            WHERE r.state IN ('requested', 'pending_resolution', 'ready')
            ORDER BY r.deadline_at
            """
        )
    ).mappings().all()
    for req in rows:
        rid = str(req["id"])
        user = {"id": str(req["user_id"]), "role": req["user_role"], "name": req["user_name"], "email": req["user_email"]}
        state = _refresh_state(db, rid, user, actor=None)
        stats["refreshed"] += 1
        db.commit()
        if req["deadline_at"] > now:
            if req["deadline_at"] - now <= timedelta(days=3) and state != "ready" and claim_once(db, f"deletion_warn:{rid}"):
                _notify_admins(db, "Account Deletion Due Soon",
                               f"{req['user_name']}'s deletion is due on {req['deadline_at']:%d-%m-%Y} and is not ready.", rid)
                stats["warned"] += 1
                db.commit()
            continue
        if state == "ready":
            try:
                result = anonymise_user(db, user["id"])
                db.execute(
                    text(
                        """
                        UPDATE account_deletion_requests SET state = 'deleted', completed_at = NOW(),
                          contact_email = NULL, updated_at = NOW()
                        WHERE id = CAST(:id AS uuid)
                        """
                    ),
                    {"id": rid},
                )
                add_event(db, rid, "deleted", None, files_removed=result.get("files_removed", 0))
                db.commit()
                _email(req["contact_email"], "Your B-Seva Account Has Been Deleted",
                       "Your account has been deleted. We have removed or anonymised your personal data. Invoices, payment "
                       "and tax records are kept for the period the law requires.")
                _notify_admins(db, "Account Deleted", f"Deletion request {rid[:8]} was completed.", rid)
                db.commit()
                stats["deleted"] += 1
            except Exception:
                db.rollback()
                logger.exception("account_deletion_failed request=%s", rid)
        else:
            db.execute(
                text(
                    """
                    UPDATE account_deletion_requests SET state = 'escalated', updated_at = NOW(),
                      escalated_reason = 'Deadline reached with open bookings or payments'
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {"id": rid},
            )
            add_event(db, rid, "escalated", None, reason="deadline_reached_not_ready")
            db.commit()
            _email(req["contact_email"], "Your Account Deletion Needs More Time",
                   "We could not complete your account deletion within 14 days because a booking, payment or dispute is "
                   "still open. Our team will contact you and complete it as soon as it is resolved.")
            _notify_admins(db, "Account Deletion Overdue", f"{req['user_name']}'s deletion passed its deadline.", rid)
            db.commit()
            stats["escalated"] += 1
    return stats


def purge_location_history(db: Session) -> int:
    try:
        days = max(1, int(get_setting(db, "location_history_retention_days", 30) or 30))
    except (TypeError, ValueError):
        days = 30
    try:
        n = db.execute(
            text("DELETE FROM pujari_location_pings WHERE recorded_at < NOW() - make_interval(days => :d)"), {"d": days}
        ).rowcount
        db.commit()
        return int(n or 0)
    except SQLAlchemyError:
        db.rollback()
        return 0


# --- notices --------------------------------------------------------------------------------------

def _email(to: str | None, title: str, message: str) -> None:
    if not to or str(to).endswith("@deleted.invalid"):
        return
    try:
        from app.mail.senders import send_admin_notification_email

        send_admin_notification_email(to=str(to), title=title, message=message)
    except Exception:
        logger.exception("account_email_failed title=%s", title)


def _notify_admins(db: Session, title: str, body: str, request_id: str) -> None:
    try:
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(db, title=title, body=body, category="ops", link=f"/admin/account-deletions?id={request_id}")
    except Exception:
        logger.exception("account_admin_notify_failed")


def _notify_requested(db: Session, user: dict, req_id: str, deadline: datetime, resolved: list[dict]) -> None:
    _email(user.get("email"), "Account Deletion Requested",
           f"{DEACTIVATED_MESSAGE} You can cancel the request before {deadline:%d-%m-%Y} from "
           "https://www.b-seva.com/delete-account.")
    reassign = sum(1 for r in resolved if r["action"] == "reassignment_started")
    extra = f" {reassign} booking(s) need a new pujari." if reassign else ""
    _notify_admins(db, "Account Deletion Requested", f"{_actor_name(user)} ({user.get('role')}) asked to delete their account.{extra}", req_id)


def notify_password_changed(db: Session, user: dict) -> None:
    _email(user.get("email"), "Your B-Seva Password Was Changed",
           "Your password was changed and you were signed out on other devices. If this was not you, reset your "
           "password from the sign-in page and contact support@b-seva.com.")
