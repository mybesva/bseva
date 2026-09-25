"""Booking lifecycle: accept, OTP start, complete, ratings, location, settlements, rewards."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.booking_state import set_booking_status
from app.booking_visibility import booking_for_role, public_pujari
from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import apply_wallet, hours_until, row_dict
from app.platform_config import get_setting
from app.rbac import require_admin, require_permission
from app.schemas import BookingRejectIn, NoShowPenaltyIn
from app.no_show import apply_no_show_to_booking
from app.pricing import dakshina_share_percent

router = APIRouter(tags=["lifecycle"])


class AcceptIn(BaseModel):
    terms_accepted: bool = True
    terms_version: str = "2026-01"


class StartOtpVerifyIn(BaseModel):
    code: str = Field(min_length=4, max_length=8)


class RatingIn(BaseModel):
    stars: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = None
    skip: bool = False


class LocationPingIn(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: float | None = None


class AdminOverrideIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class CompleteOtpVerifyIn(BaseModel):
    code: str = Field(min_length=4, max_length=8)


class SettlementOverrideIn(BaseModel):
    reason: str = Field(min_length=3)
    mark_settled: bool = True
    payment_reference: str | None = None


@router.get("/bookings/{booking_id}")
def get_booking(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    row = None
    # UUID id
    try:
        row = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
                       pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name,
                       s.slug AS service_slug, s.duration_minutes
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.id = CAST(:id AS uuid)
                  AND COALESCE(b.booking_kind, 'puja') = 'puja'
                """
            ),
            {"id": booking_id},
        ).mappings().first()
    except Exception:
        row = None
    if not row:
        row = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
                       pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name,
                       s.slug AS service_slug, s.duration_minutes
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.booking_number = :num
                  AND COALESCE(b.booking_kind, 'puja') = 'puja'
                """
            ),
            {"num": booking_id},
        ).mappings().first()
    if not row:
        raise HTTPException(404, "Booking not found")
    try:
        data = booking_for_role(db, dict(row), user)
    except PermissionError:
        raise HTTPException(403, "Not allowed")
    # Samagri snapshot + localized preparation view
    try:
        sam = db.execute(
            text("SELECT * FROM booking_samagri_snapshot WHERE booking_id = CAST(:id AS uuid) ORDER BY sort_order"),
            {"id": str(row["id"])},
        ).mappings().all()
        data["samagri"] = [row_dict(r) for r in sam]
    except Exception:
        data["samagri"] = []
    try:
        from app.preparation import get_booking_preparation

        data["preparation"] = get_booking_preparation(db, str(row["id"]))
    except Exception:
        data["preparation"] = None
    return data


@router.get("/bookings/{booking_id}/preparation")
def booking_preparation(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT * FROM bookings
            WHERE id = CAST(:id AS uuid)
              AND COALESCE(booking_kind, 'puja') = 'puja'
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if not row:
        row = db.execute(
            text(
                """
                SELECT * FROM bookings
                WHERE booking_number = :num
                  AND COALESCE(booking_kind, 'puja') = 'puja'
                """
            ),
            {"num": booking_id},
        ).mappings().first()
    if not row:
        raise HTTPException(404, "Booking not found")
    try:
        booking_for_role(db, dict(row), user)
    except PermissionError:
        raise HTTPException(403, "Not allowed")
    from app.preparation import get_booking_preparation

    return get_booking_preparation(db, str(row["id"]))


@router.post("/bookings/{booking_id}/accept")
def accept_booking(booking_id: str, body: AcceptIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    if not body.terms_accepted:
        raise HTTPException(400, "Terms must be accepted")
    from app.booking_access import accept_denied, prepare_pujari_booking_action, same_id
    from app.booking_offers import withdraw_open_offers

    b, booking_id = prepare_pujari_booking_action(db, booking_id, user)
    pid = str(user["id"])
    assigned = same_id(b.get("pujari_id"), pid)
    denial = accept_denied(assigned, b.get("pujari_id"), pid)
    if denial:
        raise HTTPException(409, denial)
    if b["status"] not in ("pending", "pending_acceptance", "confirmed"):
        raise HTTPException(400, "Booking cannot be accepted in current status")
    if not assigned:
        db.execute(
            text(
                """
                UPDATE bookings SET
                  pujari_id = CAST(:pid AS uuid),
                  needs_reassignment = FALSE,
                  rejection_reason = NULL
                WHERE id = CAST(:id AS uuid) AND pujari_id IS NULL
                """
            ),
            {"pid": pid, "id": booking_id},
        )
        chk = db.execute(
            text("SELECT pujari_id FROM bookings WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        ).scalar()
        if not same_id(chk, pid):
            raise HTTPException(409, "Another pujari already accepted this booking")
        withdraw_open_offers(db, booking_id, except_pujari_id=pid, mark_accepted_for=pid)
        b = {**dict(b), "pujari_id": pid}
    from app.pujari_schedule import assert_pujari_available_for_booking

    db.execute(
        text("SELECT user_id FROM pujari_profiles WHERE user_id = CAST(:pid AS uuid) FOR UPDATE"),
        {"pid": pid},
    )
    db.execute(
        text(
            """
            SELECT id FROM bookings
            WHERE pujari_id = CAST(:pid AS uuid)
              AND status IN ('confirmed', 'in_progress')
            FOR UPDATE
            """
        ),
        {"pid": pid},
    )
    assert_pujari_available_for_booking(db, pid, dict(b), exclude_booking_id=booking_id)
    db.execute(
        text(
            """
            INSERT INTO booking_terms_acceptances (booking_id, pujari_id, terms_version, terms_slug)
            VALUES (CAST(:bid AS uuid), CAST(:pid AS uuid), :ver, 'pujari_booking_terms')
            ON CONFLICT (booking_id, pujari_id) DO UPDATE SET accepted_at = NOW(), terms_version = EXCLUDED.terms_version
            """
        ),
        {"bid": booking_id, "pid": user["id"], "ver": body.terms_version},
    )
    if b["status"] != "confirmed":
        set_booking_status(db, booking_id, "confirmed", actor_id=str(user["id"]))
    else:
        db.execute(
            text("UPDATE bookings SET accepted_at = COALESCE(accepted_at, NOW()) WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        )
    write_audit(db, str(user["id"]), "booking_accept", "booking", booking_id)

    try:
        from app.booking_offers import refresh_offers_for_open_bookings

        refresh_offers_for_open_bookings(
            db,
            booking_date=b["booking_date"],
            customer_id=str(b["customer_id"]),
        )
    except Exception:
        pass

    meet_info: dict = {}
    if str(b.get("mode") or "") == "virtual":
        try:
            from app.meetings.service import ensure_virtual_meeting

            cust_email_row = db.execute(
                text("SELECT email FROM users WHERE id = CAST(:id AS uuid)"),
                {"id": str(b["customer_id"])},
            ).mappings().first()
            dur = db.execute(
                text("SELECT duration_minutes, name FROM services WHERE id = CAST(:id AS uuid)"),
                {"id": str(b["service_id"])},
            ).mappings().first()
            meet_info = ensure_virtual_meeting(
                db,
                dict(b),
                service_name=str((dur or {}).get("name") or "Virtual Puja"),
                customer_email=str((cust_email_row or {}).get("email") or ""),
                pujari_email=str(user.get("email") or ""),
                duration_minutes=int((dur or {}).get("duration_minutes") or 90),
                send_google_invites=True,
            )
            if meet_info.get("meeting_url"):
                b = {**dict(b), **meet_info}
        except Exception:
            meet_info = {}

    try:
        from app.routers.notifications import create_notification, customer_booking_link

        meet_note = ""
        if meet_info.get("meeting_url") or meet_info.get("public_invite_url"):
            meet_note = " Virtual Meet link is ready in your booking."
        create_notification(
            db,
            user_id=str(b["customer_id"]),
            title="Booking confirmed",
            body=f"Your booking {b.get('booking_number') or booking_id[:8]} was accepted by the pujari.{meet_note}",
            category="booking",
            link=customer_booking_link(booking_id),
            extra_data={"booking_id": booking_id},
            message_key="accepted",
            message_vars={"number": str(b.get("booking_number") or booking_id[:8])},
        )
    except Exception:
        pass
    db.commit()
    try:
        from app.mail.booking_payload import booking_email_data_from_row, load_service_name
        from app.mail.senders import send_booking_confirmation_email
        from app.meetings.service import public_invite_url_for

        cust = db.execute(
            text("SELECT email, name, preferred_language FROM users WHERE id = CAST(:id AS uuid)"),
            {"id": str(b["customer_id"])},
        ).mappings().first()
        svc_name = load_service_name(
            db, str(b["service_id"]), str((cust or {}).get("preferred_language") or "en")
        )
        if cust and cust.get("email"):
            extra = {"status": "confirmed"}
            data = booking_email_data_from_row(
                dict(b),
                customer_name=str(cust.get("name") or ""),
                service_name=svc_name,
                language=str(cust.get("preferred_language") or "en"),
                extra=extra,
            )
            if str(b.get("mode") or "") == "virtual":
                meet_url = meet_info.get("meeting_url") or b.get("meeting_url")
                invite = meet_info.get("public_invite_url") or public_invite_url_for(
                    b.get("meeting_invite_token") or meet_info.get("meeting_invite_token")
                )
                rows = list(data.extra_rows)
                if meet_url:
                    rows.append(("Google Meet", str(meet_url)))
                if invite:
                    rows.append(("Public invite link", str(invite)))
                data.extra_rows = rows
            send_booking_confirmation_email(to=str(cust["email"]), data=data)
    except Exception:
        pass
    return {
        "ok": True,
        "status": "confirmed",
        "meeting_url": meet_info.get("meeting_url") or b.get("meeting_url"),
        "public_invite_url": meet_info.get("public_invite_url"),
    }


@router.post("/bookings/{booking_id}/reject")
def reject_booking(
    booking_id: str,
    body: BookingRejectIn = BookingRejectIn(),
    user=Depends(require_roles("pujari")),
    db: Session = Depends(get_db),
):
    reason = body.reason
    from app.booking_access import prepare_pujari_booking_action, same_id
    from app.booking_offers import count_invited_offers, reject_offer

    b, booking_id = prepare_pujari_booking_action(db, booking_id, user)
    pid = str(user["id"])
    assigned = same_id(b.get("pujari_id"), pid)
    if not assigned:
        if b.get("pujari_id"):
            raise HTTPException(403, "Not allowed")
        if not reject_offer(db, booking_id, pid, reason):
            raise HTTPException(403, "Not allowed")
        write_audit(db, pid, f"booking_offer_reject:{reason or 'no_reason'}", "booking", booking_id)
        remaining = count_invited_offers(db, booking_id)
        if remaining == 0:
            db.execute(
                text(
                    """
                    UPDATE bookings SET needs_reassignment = TRUE
                    WHERE id = CAST(:id AS uuid) AND pujari_id IS NULL
                    """
                ),
                {"id": booking_id},
            )
            try:
                from app.routers.notifications import notify_ops_staff

                notify_ops_staff(
                    db,
                    title="Booking needs pujari assignment",
                    body=f"{b.get('booking_number') or booking_id[:8]} — all nearby pujaris declined.",
                    category="ops",
                    link="/admin/bookings?status=needs_reassignment",
                )
            except Exception:
                pass
        db.commit()
        return {"ok": True, "status": "offer_rejected", "invites_remaining": remaining}
    if b["status"] not in ("pending", "pending_acceptance"):
        raise HTTPException(400, "Only pending bookings can be rejected")
    set_booking_status(db, booking_id, "rejected", actor_id=str(user["id"]))
    db.execute(
        text(
            """
            UPDATE bookings SET
              rejection_reason = :reason,
              needs_reassignment = TRUE,
              rejected_at = COALESCE(rejected_at, NOW())
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"reason": reason, "id": booking_id},
    )
    write_audit(db, str(user["id"]), f"booking_reject:{reason or 'no_reason'}", "booking", booking_id)
    try:
        from app.routers.notifications import create_notification, customer_booking_link, notify_super_admins

        create_notification(
            db,
            user_id=str(b["customer_id"]),
            title="Booking declined",
            body=f"Booking {b.get('booking_number') or booking_id[:8]} was declined by the pujari. We will reassign shortly.",
            category="booking",
            link=customer_booking_link(booking_id),
            extra_data={"booking_id": booking_id},
        )
        notify_super_admins(
            db,
            title="Booking needs reassignment",
            body=f"{b.get('booking_number') or booking_id} was rejected by pujari.",
            category="ops",
            link="/admin/bookings?status=needs_reassignment",
        )
    except Exception:
        pass
    db.commit()
    return {"ok": True, "status": "rejected", "needs_reassignment": True}


@router.post("/bookings/{booking_id}/no-show-penalty")
def mark_no_show_penalty(
    booking_id: str,
    body: NoShowPenaltyIn = NoShowPenaltyIn(),
    admin=Depends(require_permission("manage_bookings")),
    db: Session = Depends(get_db),
):
    """Admin marks accepted pujari as no-show and deducts 100% of that puja's cost from their wallet."""
    waive = bool(body.waive)
    reason = body.reason
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if not b.get("pujari_id"):
        raise HTTPException(400, "No pujari assigned")
    if b["status"] not in ("confirmed", "in_progress", "cancelled", "completed"):
        raise HTTPException(400, "No-show penalty requires an accepted booking")
    if b.get("no_show_marked_at") and int(b.get("no_show_penalty_paise") or 0) > 0 and not waive:
        raise HTTPException(400, "No-show penalty already applied")

    out = apply_no_show_to_booking(
        db,
        b,
        actor_id=str(admin["id"]),
        waive=waive,
        reason=reason,
        auto=False,
    )
    if not out.get("ok"):
        raise HTTPException(400, f"Cannot deduct penalty: {out.get('error') or 'wallet error'}")
    db.commit()
    return {"ok": True, "waived": bool(out.get("waived")), "penalty_paise": int(out.get("penalty_paise") or 0)}


@router.post("/bookings/{booking_id}/start-otp/request")
def request_start_otp(booking_id: str, user=Depends(require_roles("pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    from app.puja_otp import (
        PURPOSE_START,
        PujaOtpError,
        has_active_display,
        issue_puja_otp,
        otp_window_minutes,
        within_start_window,
    )

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Booking must be confirmed to start")
    mins = otp_window_minutes(db)
    if not within_start_window(db, b["booking_date"], b["start_time"]):
        raise HTTPException(400, f"OTP is available only from {mins} minutes before the scheduled start")
    svc = db.execute(
        text("SELECT name FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(b["service_id"])},
    ).scalar()
    booking = dict(b)
    booking["service_name"] = svc or "Puja"
    is_resend = has_active_display(booking, PURPOSE_START) or bool(booking.get("otp_sent_at"))
    try:
        issue_puja_otp(
            db, booking, PURPOSE_START, notify=True, is_resend=is_resend, actor_id=str(user["id"])
        )
    except PujaOtpError as e:
        raise HTTPException(e.status, e.message)
    db.commit()
    return {"ok": True, "sent_to": "customer", "window_minutes": mins, "resent": is_resend}


@router.get("/bookings/{booking_id}/start-otp")
def get_start_otp(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    """Customer (and admin) can view start OTP only inside the pre-start window. Never reveal to pujari."""
    from app.puja_otp import PURPOSE_START, otp_window_minutes, reveal_display_code, within_start_window

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    is_customer = str(b["customer_id"]) == str(user["id"])
    is_pujari = str(b.get("pujari_id") or "") == str(user["id"])
    is_admin = user["role"] in ("admin", "super_admin")
    if not (is_customer or is_pujari or is_admin):
        raise HTTPException(403, "Not allowed")
    mins = otp_window_minutes(db)
    in_window = b["status"] == "confirmed" and within_start_window(db, b["booking_date"], b["start_time"])
    code = reveal_display_code(dict(b), PURPOSE_START)
    reveal = bool(code) and in_window and (is_customer or is_admin)
    return {
        "available": in_window and bool(code),
        "window_minutes": mins,
        "status": b["status"],
        "otp_sent_at": b.get("otp_sent_at"),
        "code": code if reveal else None,
        "message": (
            None
            if reveal
            else (
                f"OTP appears here from {mins} minutes before start"
                if b["status"] == "confirmed"
                else "OTP not available for this booking status"
            )
        ),
    }


@router.post("/bookings/{booking_id}/start-otp/verify")
def verify_start_otp(booking_id: str, body: StartOtpVerifyIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    from app.puja_otp import PURPOSE_START, PujaOtpError, verify_puja_otp

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Booking must be confirmed")
    try:
        verify_puja_otp(db, dict(b), PURPOSE_START, body.code, actor_id=str(user["id"]))
    except PujaOtpError as e:
        db.commit()
        raise HTTPException(e.status, e.message)
    set_booking_status(db, booking_id, "in_progress", actor_id=str(user["id"]))
    write_audit(db, str(user["id"]), "puja_started", "booking", booking_id)
    try:
        from app.routers.notifications import create_notification, customer_booking_link, pujari_booking_link

        num = str(b.get("booking_number") or booking_id[:8])
        create_notification(
            db,
            user_id=str(b["customer_id"]),
            title="Puja started",
            body=f"Your puja {num} has started.",
            category="booking",
            link=customer_booking_link(booking_id),
            extra_data={"booking_id": booking_id},
            message_key="pujaStarted",
            message_vars={"number": num},
        )
        create_notification(
            db,
            user_id=str(b["pujari_id"]),
            title="Puja started",
            body=f"Booking {num} is now in progress.",
            category="booking",
            link=pujari_booking_link(booking_id),
            extra_data={"booking_id": booking_id},
            message_key="pujaStarted",
            message_vars={"number": num},
        )
    except Exception:
        pass
    db.commit()
    return {"ok": True, "status": "in_progress"}


@router.post("/bookings/{booking_id}/admin/start")
def admin_start_booking(booking_id: str, body: AdminOverrideIn, user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Booking must be confirmed")
    set_booking_status(db, booking_id, "in_progress", actor_id=str(user["id"]))
    write_audit(db, str(user["id"]), "admin_start_override", "booking", booking_id, reason=body.reason)
    db.commit()
    return {"ok": True, "status": "in_progress", "override": True}


def _run_completion_pipeline(db: Session, b, booking_id: str, actor_id: str) -> None:
    """Existing completion side effects — call exactly once after status → completed."""
    no_show_blocked = bool(b.get("no_show_marked_at")) and int(b.get("no_show_penalty_paise") or 0) > 0
    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(b["service_id"])},
    ).mappings().first()
    share = dakshina_share_percent(svc) / 100.0
    days = int(get_setting(db, "pujari_settlement_days", 14))
    base = int(b["base_price_paise"])
    platform = int(round(base * (1 - share)))
    payable = int(round(base * share))
    reimbursement = int(b.get("pujari_reimbursement_paise") or 0)
    settlement_total = payable + reimbursement
    due = date.today() + timedelta(days=days)
    try:
        st = b.get("settlement_status") or "not_applicable"
        if st != "legacy" and not no_show_blocked:
            db.execute(
                text(
                    """
                    INSERT INTO settlements (
                      booking_id, pujari_id, customer_payment_paise, base_puja_paise,
                      platform_fee_paise, gst_paise, pujari_payable_paise, settlement_amount_paise,
                      due_date, status, reimbursement_paise
                    ) VALUES (
                      CAST(:bid AS uuid), CAST(:pid AS uuid), :pay, :base, :plat, :gst, :payable, :settle, :due, 'pending', :reimb
                    )
                    ON CONFLICT (booking_id) DO NOTHING
                    """
                ),
                {
                    "bid": booking_id,
                    "pid": str(b["pujari_id"]),
                    "pay": int(b["total_paise"]),
                    "base": base,
                    "plat": platform,
                    "gst": int(b["gst_amount_paise"] or 0),
                    "payable": payable,
                    "settle": settlement_total,
                    "due": due,
                    "reimb": reimbursement,
                },
            )
            db.execute(
                text("UPDATE bookings SET settlement_status = 'pending', pujari_payable_paise = :p WHERE id = CAST(:id AS uuid)"),
                {"p": settlement_total, "id": booking_id},
            )
    except Exception:
        pass
    _maybe_loyalty(db, str(b["pujari_id"]), booking_id)
    _maybe_referral_reward(db, str(b["customer_id"]), booking_id)
    try:
        from app.invoice_docs import create_settlement_invoice

        sett = db.execute(
            text("SELECT * FROM settlements WHERE booking_id = CAST(:id AS uuid)"),
            {"id": booking_id},
        ).mappings().first()
        if sett and str(sett.get("status") or "") != "blocked":
            create_settlement_invoice(db, booking=dict(b), settlement=dict(sett))
    except Exception:
        pass
    write_audit(db, actor_id, "puja_completed", "booking", booking_id)
    try:
        from app.routers.notifications import create_notification, pujari_booking_link

        num = str(b.get("booking_number") or booking_id[:8])
        create_notification(
            db,
            user_id=str(b["customer_id"]),
            title="Puja completed",
            body=f"Your puja {num} is complete. Thank you for booking with BSeva.",
            category="booking",
            link="/customer/history",
            extra_data={"booking_id": booking_id},
            message_key="completed",
            message_vars={"number": num},
        )
        if b.get("pujari_id"):
            create_notification(
                db,
                user_id=str(b["pujari_id"]),
                title="Booking completed",
                body=f"Booking {num} was marked complete.",
                category="booking",
                link=pujari_booking_link(booking_id),
                extra_data={"booking_id": booking_id},
                message_key="completed",
                message_vars={"number": num},
            )
    except Exception:
        pass


@router.post("/bookings/{booking_id}/complete")
def complete_booking(booking_id: str, user=Depends(require_roles("pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    """Pujari cannot bypass customer completion OTP. Admin must use /admin/complete."""
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari":
        raise HTTPException(
            400,
            "Waiting for customer completion verification. Ask the customer to enter the Completion OTP in their BSeva app.",
        )
    raise HTTPException(400, "Admins must use the auditable /bookings/{id}/admin/complete override")


@router.post("/bookings/{booking_id}/complete-otp/request")
def request_complete_otp(booking_id: str, user=Depends(require_roles("pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    from app.puja_otp import (
        PURPOSE_COMPLETE,
        PujaOtpError,
        complete_otp_before_minutes,
        has_active_display,
        issue_puja_otp,
        within_complete_window,
    )

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "in_progress":
        raise HTTPException(400, "Booking must be in progress")
    booking = dict(b)
    svc = db.execute(text("SELECT name FROM services WHERE id = CAST(:id AS uuid)"), {"id": str(b["service_id"])}).scalar()
    booking["service_name"] = svc or "Puja"
    if not within_complete_window(db, booking):
        mins = complete_otp_before_minutes(db)
        raise HTTPException(400, f"Completion OTP is available from {mins} minutes before the expected end")
    is_resend = has_active_display(booking, PURPOSE_COMPLETE) or bool(booking.get("complete_otp_sent_at"))
    try:
        issue_puja_otp(
            db, booking, PURPOSE_COMPLETE, notify=True, is_resend=is_resend, actor_id=str(user["id"])
        )
    except PujaOtpError as e:
        raise HTTPException(e.status, e.message)
    db.commit()
    return {"ok": True, "sent_to": "pujari", "resent": is_resend}


@router.get("/bookings/{booking_id}/complete-otp")
def get_complete_otp(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    """Pujari (and admin) see completion OTP. Customer never receives the code from this API."""
    from app.puja_otp import (
        PURPOSE_COMPLETE,
        complete_otp_before_minutes,
        expected_end_utc,
        reveal_display_code,
        within_complete_window,
    )

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    is_customer = str(b["customer_id"]) == str(user["id"])
    is_pujari = str(b.get("pujari_id") or "") == str(user["id"])
    is_admin = user["role"] in ("admin", "super_admin")
    if not (is_customer or is_pujari or is_admin):
        raise HTTPException(403, "Not allowed")
    booking = dict(b)
    in_window = within_complete_window(db, booking)
    code = reveal_display_code(booking, PURPOSE_COMPLETE)
    reveal = bool(code) and in_window and (is_pujari or is_admin)
    end = expected_end_utc(db, booking)
    return {
        "available": in_window and bool(code),
        "window_minutes": complete_otp_before_minutes(db),
        "status": b["status"],
        "expected_end_at": end.isoformat(),
        "otp_sent_at": b.get("complete_otp_sent_at"),
        "code": code if reveal else None,
        "customer_can_verify": is_customer and in_window and bool(code) and b["status"] == "in_progress",
        "message": (
            None
            if reveal
            else (
                "Share the Completion OTP with the customer when the Puja is finished."
                if is_pujari and in_window
                else (
                    "Enter the Completion OTP your pujari shares when the Puja is finished."
                    if is_customer
                    else "Completion OTP is not available yet."
                )
            )
        ),
    }


@router.post("/bookings/{booking_id}/complete-otp/verify")
def verify_complete_otp(booking_id: str, body: CompleteOtpVerifyIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.puja_otp import PURPOSE_COMPLETE, PujaOtpError, verify_puja_otp

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    is_customer = str(b["customer_id"]) == str(user["id"]) and user["role"] == "customer"
    if not is_customer:
        raise HTTPException(403, "Only the customer can verify the completion OTP")
    if b["status"] != "in_progress":
        raise HTTPException(400, "Booking must be in progress")
    try:
        verify_puja_otp(db, dict(b), PURPOSE_COMPLETE, body.code, actor_id=str(user["id"]))
    except PujaOtpError as e:
        db.commit()
        raise HTTPException(e.status, e.message)
    set_booking_status(db, booking_id, "completed", actor_id=str(user["id"]))
    _run_completion_pipeline(db, b, booking_id, str(user["id"]))
    db.commit()
    return {"ok": True, "status": "completed"}


@router.post("/bookings/{booking_id}/admin/complete")
def admin_complete_booking(booking_id: str, body: AdminOverrideIn, user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "in_progress":
        raise HTTPException(400, "Booking must be in progress")
    set_booking_status(db, booking_id, "completed", actor_id=str(user["id"]))
    write_audit(db, str(user["id"]), "admin_complete_override", "booking", booking_id, reason=body.reason)
    _run_completion_pipeline(db, b, booking_id, str(user["id"]))
    db.commit()
    return {"ok": True, "status": "completed", "override": True}


def _maybe_loyalty(db: Session, pujari_id: str, booking_id: str) -> None:
    if not get_setting(db, "loyalty_pujari_active", True):
        return
    threshold = int(get_setting(db, "loyalty_pujari_puja_count", 10))
    reward = int(get_setting(db, "loyalty_pujari_reward_paise", 50000))
    count = db.execute(
        text("SELECT COUNT(*) FROM bookings WHERE pujari_id = CAST(:id AS uuid) AND status = 'completed'"),
        {"id": pujari_id},
    ).scalar() or 0
    if count < threshold or count % threshold != 0:
        return
    exists = db.execute(
        text(
            """
            SELECT 1 FROM reward_ledger
            WHERE user_id = CAST(:u AS uuid) AND reward_type = 'pujari_loyalty'
              AND reference_booking_id = CAST(:b AS uuid)
            """
        ),
        {"u": pujari_id, "b": booking_id},
    ).first()
    if exists:
        return
    camp = db.execute(text("SELECT id FROM reward_campaigns WHERE code = 'PUJARI_LOYALTY_10'")).first()
    db.execute(
        text(
            """
            INSERT INTO reward_ledger (user_id, campaign_id, reward_type, reference_booking_id, amount_paise, status, credited_at)
            VALUES (CAST(:u AS uuid), :c, 'pujari_loyalty', CAST(:b AS uuid), :amt, 'credited', NOW())
            """
        ),
        {"u": pujari_id, "c": camp[0] if camp else None, "b": booking_id, "amt": reward},
    )
    try:
        apply_wallet(db, pujari_id, reward, "credit", "Pujari loyalty reward", booking_id)
    except ValueError:
        pass


def _maybe_referral_reward(db: Session, customer_id: str, booking_id: str) -> None:
    ref = db.execute(
        text("SELECT * FROM referrals WHERE referee_id = CAST(:id AS uuid) AND status = 'pending'"),
        {"id": customer_id},
    ).mappings().first()
    if not ref:
        return
    if str(ref["referrer_id"]) == str(customer_id):
        return
    scope = str(ref.get("role_scope") or "customer")
    if scope == "customer" and not get_setting(db, "referral_customer_active", True):
        return
    if scope == "pujari" and not get_setting(db, "referral_pujari_active", True):
        return
    # First completed booking qualifies
    prior = db.execute(
        text(
            """
            SELECT COUNT(*) FROM bookings
            WHERE customer_id = CAST(:id AS uuid) AND status = 'completed' AND id <> CAST(:b AS uuid)
            """
        ),
        {"id": customer_id, "b": booking_id},
    ).scalar() or 0
    if prior > 0:
        return
    # Duplicate reward protection
    already = db.execute(
        text(
            """
            SELECT 1 FROM reward_ledger
            WHERE reference_user_id = CAST(:ref AS uuid)
              AND reward_type IN ('customer_referral', 'pujari_referral')
              AND status = 'credited'
            """
        ),
        {"ref": customer_id},
    ).first()
    if already:
        db.execute(
            text("UPDATE referrals SET status = 'rewarded', qualified_booking_id = CAST(:b AS uuid) WHERE id = :id"),
            {"b": booking_id, "id": ref["id"]},
        )
        return
    if scope == "pujari":
        reward = int(get_setting(db, "referral_pujari_reward_paise", 10000))
        rtype = "pujari_referral"
        note = "Pujari referral reward"
    else:
        reward = int(get_setting(db, "referral_customer_reward_paise", 10000))
        rtype = "customer_referral"
        note = "Customer referral reward"
    db.execute(
        text(
            """
            UPDATE referrals SET status = 'rewarded', qualified_booking_id = CAST(:b AS uuid)
            WHERE id = :id
            """
        ),
        {"b": booking_id, "id": ref["id"]},
    )
    db.execute(
        text(
            """
            INSERT INTO reward_ledger (user_id, reward_type, reference_booking_id, reference_user_id, amount_paise, status, credited_at)
            VALUES (CAST(:u AS uuid), :rt, CAST(:b AS uuid), CAST(:ref AS uuid), :amt, 'credited', NOW())
            """
        ),
        {"u": str(ref["referrer_id"]), "rt": rtype, "b": booking_id, "ref": customer_id, "amt": reward},
    )
    try:
        apply_wallet(db, str(ref["referrer_id"]), reward, "credit", note, booking_id)
    except ValueError:
        pass


@router.post("/bookings/{booking_id}/ratings")
def submit_rating(booking_id: str, body: RatingIn, user=Depends(current_user), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "completed":
        raise HTTPException(400, "Booking must be completed")
    if str(user["id"]) not in (str(b["customer_id"]), str(b["pujari_id"])):
        raise HTTPException(403, "Not allowed")
    role_from = "customer" if str(user["id"]) == str(b["customer_id"]) else "pujari"
    to_id = str(b["pujari_id"]) if role_from == "customer" else str(b["customer_id"])
    if body.skip:
        db.execute(
            text(
                """
                INSERT INTO ratings (booking_id, from_user_id, to_user_id, role_from, stars, skipped)
                VALUES (CAST(:b AS uuid), CAST(:f AS uuid), CAST(:t AS uuid), :r, 1, TRUE)
                ON CONFLICT (booking_id, from_user_id) DO UPDATE SET skipped = TRUE
                """
            ),
            {"b": booking_id, "f": user["id"], "t": to_id, "r": role_from},
        )
    else:
        if not body.stars:
            raise HTTPException(400, "stars required unless skip")
        db.execute(
            text(
                """
                INSERT INTO ratings (booking_id, from_user_id, to_user_id, role_from, stars, comment, skipped, moderation_status)
                VALUES (CAST(:b AS uuid), CAST(:f AS uuid), CAST(:t AS uuid), :r, :s, :c, FALSE, 'pending')
                ON CONFLICT (booking_id, from_user_id) DO UPDATE SET
                  stars = EXCLUDED.stars, comment = EXCLUDED.comment, skipped = FALSE, moderation_status = 'pending'
                """
            ),
            {"b": booking_id, "f": user["id"], "t": to_id, "r": role_from, "s": body.stars, "c": body.comment},
        )
    # Update rating_status
    rows = db.execute(
        text("SELECT role_from, skipped FROM ratings WHERE booking_id = CAST(:b AS uuid)"),
        {"b": booking_id},
    ).mappings().all()
    roles = {r["role_from"] for r in rows if not r["skipped"]}
    skipped = {r["role_from"] for r in rows if r["skipped"]}
    if "customer" in roles and "pujari" in roles:
        st = "completed"
    elif "customer" in roles:
        st = "customer_done"
    elif "pujari" in roles:
        st = "pujari_done"
    elif skipped:
        st = "skipped"
    else:
        st = "pending"
    db.execute(text("UPDATE bookings SET rating_status = :s WHERE id = CAST(:id AS uuid)"), {"s": st, "id": booking_id})
    db.commit()
    return {"ok": True, "rating_status": st}


@router.post("/bookings/{booking_id}/location")
def ping_location(booking_id: str, body: LocationPingIn, user=Depends(require_roles("pujari", "head_pujari")), db: Session = Depends(get_db)):
    from app.booking_tracking import maybe_detect_arrival, tracking_should_be_active

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    booking = dict(b)
    if not tracking_should_be_active(db, booking):
        raise HTTPException(400, "Live tracking is not active for this booking")
    try:
        db.execute(
            text(
                """
                INSERT INTO pujari_location_pings (booking_id, pujari_id, latitude, longitude, accuracy_m)
                VALUES (CAST(:b AS uuid), CAST(:p AS uuid), :lat, :lng, :acc)
                """
            ),
            {
                "b": booking_id,
                "p": user["id"],
                "lat": body.latitude,
                "lng": body.longitude,
                "acc": body.accuracy_m,
            },
        )
    except Exception:
        db.execute(
            text(
                """
                INSERT INTO pujari_location_pings (booking_id, pujari_id, latitude, longitude)
                VALUES (CAST(:b AS uuid), CAST(:p AS uuid), :lat, :lng)
                """
            ),
            {"b": booking_id, "p": user["id"], "lat": body.latitude, "lng": body.longitude},
        )
    arrived = maybe_detect_arrival(
        db, booking, lat=body.latitude, lng=body.longitude, accuracy_m=body.accuracy_m
    )
    try:
        from app.routers.notifications import create_notification

        already = db.execute(
            text(
                """
                SELECT id FROM notifications
                WHERE user_id = CAST(:uid AS uuid)
                  AND category = 'pujari_arriving'
                  AND COALESCE(link, '') LIKE :needle
                  AND created_at > NOW() - INTERVAL '12 hours'
                LIMIT 1
                """
            ),
            {"uid": str(b["customer_id"]), "needle": f"%{booking_id}%"},
        ).first()
        if not already:
            num = str(b.get("booking_number") or booking_id[:8])
            create_notification(
                db,
                user_id=str(b["customer_id"]),
                title="Pujari is on the way",
                body=f"Live tracking is available for booking {num}.",
                category="pujari_arriving",
                link=f"/booking/{booking_id}",
                extra_data={"booking_id": booking_id},
                message_key="arriving",
                message_vars={"number": num},
            )
        if arrived:
            arrived_note = db.execute(
                text(
                    """
                    SELECT id FROM notifications
                    WHERE user_id = CAST(:uid AS uuid)
                      AND category = 'pujari_arrived'
                      AND COALESCE(link, '') LIKE :needle
                      AND created_at > NOW() - INTERVAL '12 hours'
                    LIMIT 1
                    """
                ),
                {"uid": str(b["customer_id"]), "needle": f"%{booking_id}%"},
            ).first()
            if not arrived_note:
                num = str(b.get("booking_number") or booking_id[:8])
                create_notification(
                    db,
                    user_id=str(b["customer_id"]),
                    title="Pujari has arrived",
                    body=f"Your pujari has reached the puja location for booking {num}.",
                    category="pujari_arrived",
                    link=f"/booking/{booking_id}",
                    extra_data={"booking_id": booking_id},
                    message_key="arrived",
                    message_vars={"number": num},
                )
    except Exception:
        pass
    db.commit()
    return {"ok": True, "arrived": arrived, "tracking_active": not arrived}


@router.get("/bookings/{booking_id}/location")
def get_location(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.booking_tracking import location_payload, tracking_should_be_active

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    is_admin = user["role"] in ("admin", "super_admin")
    is_customer = str(user["id"]) == str(b["customer_id"])
    is_pujari = str(user["id"]) == str(b["pujari_id"])
    if not (is_admin or is_customer or is_pujari):
        raise HTTPException(403, "Not allowed")
    booking = dict(b)
    ping = None
    if tracking_should_be_active(db, booking) or is_admin:
        try:
            ping = db.execute(
                text(
                    """
                    SELECT latitude, longitude, recorded_at, accuracy_m FROM pujari_location_pings
                    WHERE booking_id = CAST(:b AS uuid) ORDER BY recorded_at DESC LIMIT 1
                    """
                ),
                {"b": booking_id},
            ).mappings().first()
        except Exception:
            ping = db.execute(
                text(
                    """
                    SELECT latitude, longitude, recorded_at FROM pujari_location_pings
                    WHERE booking_id = CAST(:b AS uuid) ORDER BY recorded_at DESC LIMIT 1
                    """
                ),
                {"b": booking_id},
            ).mappings().first()
    include_dest = is_customer or is_admin or (is_pujari and booking.get("latitude") is not None)
    # Pujari only receives destination coords if booking_for_role would already unlock them.
    if is_pujari and not is_admin:
        from app.booking_visibility import can_pujari_see_full

        unlocked = booking.get("status") in ("in_progress", "completed", "cancelled") or can_pujari_see_full(
            db, booking.get("booking_date"), booking.get("start_time")
        )
        include_dest = include_dest and unlocked
        if not unlocked:
            booking = {**booking, "latitude": None, "longitude": None}
    out = location_payload(
        db,
        booking,
        dict(ping) if ping else None,
        include_destination=include_dest,
    )
    if not tracking_should_be_active(db, booking) and not is_admin:
        out["latitude"] = None
        out["longitude"] = None
        out["available"] = False
    return out


@router.get("/pujari/tracking-assignments")
def pujari_tracking_assignments(user=Depends(require_roles("pujari", "head_pujari")), db: Session = Depends(get_db)):
    from app.booking_tracking import gps_interval_seconds, tracking_should_be_active

    rows = db.execute(
        text(
            """
            SELECT * FROM bookings
            WHERE pujari_id = CAST(:pid AS uuid)
              AND status = 'confirmed'
              AND COALESCE(mode, 'in_person') <> 'virtual'
              AND COALESCE(booking_kind, 'puja') = 'puja'
            ORDER BY booking_date, start_time
            """
        ),
        {"pid": str(user["id"])},
    ).mappings().all()
    items = []
    interval = gps_interval_seconds(db)
    for r in rows:
        booking = dict(r)
        if tracking_should_be_active(db, booking):
            items.append(
                {
                    "booking_id": str(booking["id"]),
                    "booking_number": booking.get("booking_number"),
                    "gps_interval_seconds": interval,
                }
            )
    return {"items": items, "gps_interval_seconds": interval}


@router.get("/settlements")
def list_settlements(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    q: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if user["role"] not in ("admin", "super_admin", "pujari"):
        raise HTTPException(403, "Not allowed")

    days = int(get_setting(db, "pujari_settlement_days", 14) or 14)

    # Biweekly auto-settle: when hold period ends, credit pujari wallet and mark settled.
    due = db.execute(
        text(
            """
            SELECT * FROM settlements
            WHERE status IN ('pending', 'eligible')
              AND due_date IS NOT NULL
              AND due_date <= CURRENT_DATE
            ORDER BY due_date
            FOR UPDATE SKIP LOCKED
            """
        )
    ).mappings().all()
    for s in due:
        try:
            apply_wallet(
                db,
                str(s["pujari_id"]),
                int(s["settlement_amount_paise"] or 0),
                "credit",
                f"Auto settlement (every {days} days)",
                str(s["booking_id"]),
            )
            db.execute(
                text(
                    """
                    UPDATE settlements SET
                      status = 'settled',
                      settled_at = NOW(),
                      override_flag = FALSE,
                      override_reason = :reason,
                      payment_reference = COALESCE(payment_reference, 'AUTO_BIWEEKLY')
                    WHERE id = :id AND status IN ('pending', 'eligible')
                    """
                ),
                {
                    "id": s["id"],
                    "reason": f"Automatic settlement after {days}-day (2-week) hold",
                },
            )
            db.execute(
                text("UPDATE bookings SET settlement_status = 'settled' WHERE id = CAST(:id AS uuid)"),
                {"id": str(s["booking_id"])},
            )
        except ValueError:
            db.execute(
                text(
                    """
                    UPDATE settlements SET status = 'eligible'
                    WHERE id = :id AND status = 'pending'
                    """
                ),
                {"id": s["id"]},
            )
    db.commit()

    if user["role"] not in ("admin", "super_admin"):
        rows = db.execute(
            text("SELECT * FROM settlements WHERE pujari_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
            {"id": user["id"]},
        ).mappings().all()
        return [row_dict(r) for r in rows]

    extra = ""
    filter_params: dict = {}
    st = (status or "").strip().lower()
    if st in {"pending", "eligible", "settled", "blocked"}:
        extra += " AND s.status = :status "
        filter_params["status"] = st
    elif st == "awaiting":
        extra += " AND s.status IN ('pending', 'eligible') "
    query = (q or "").strip()
    if query:
        extra += """
          AND (
            COALESCE(b.booking_number, '') ILIKE :q
            OR COALESCE(pu.name, '') ILIKE :q
            OR COALESCE(cu.name, '') ILIKE :q
            OR CAST(s.booking_id AS text) ILIKE :q
          )
        """
        filter_params["q"] = f"%{query}%"
    if date_from:
        extra += " AND COALESCE(s.due_date, s.created_at::date) >= :date_from "
        filter_params["date_from"] = date_from
    if date_to:
        extra += " AND COALESCE(s.due_date, s.created_at::date) <= :date_to "
        filter_params["date_to"] = date_to

    join_sql = """
        FROM settlements s
        LEFT JOIN bookings b ON b.id = s.booking_id
        LEFT JOIN users pu ON pu.id = s.pujari_id
        LEFT JOIN users cu ON cu.id = b.customer_id
    """
    total = int(
        db.execute(text(f"SELECT COUNT(*) {join_sql} WHERE 1=1 {extra}"), filter_params).scalar() or 0
    )
    stats = db.execute(
        text(
            """
            SELECT
              COUNT(*) FILTER (WHERE status IN ('pending', 'eligible')) AS awaiting,
              COUNT(*) FILTER (WHERE status = 'settled') AS settled,
              COUNT(*) FILTER (WHERE status = 'blocked') AS blocked
            FROM settlements
            """
        )
    ).mappings().first()
    rows = db.execute(
        text(
            f"""
            SELECT s.*, b.booking_number, pu.name AS pujari_name, cu.name AS customer_name
            {join_sql}
            WHERE 1=1 {extra}
            ORDER BY s.created_at DESC
            LIMIT :lim OFFSET :off
            """
        ),
        {**filter_params, "lim": limit, "off": (page - 1) * limit},
    ).mappings().all()
    return {
        "items": [row_dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
        "hold_days": days,
        "stats": {
            "awaiting": int((stats or {}).get("awaiting") or 0),
            "settled": int((stats or {}).get("settled") or 0),
            "blocked": int((stats or {}).get("blocked") or 0),
        },
    }


@router.post("/settlements/{settlement_id}/override")
def override_settlement(
    settlement_id: str,
    body: SettlementOverrideIn,
    user=Depends(require_permission("manage_settlements")),
    db: Session = Depends(get_db),
):
    s = db.execute(text("SELECT * FROM settlements WHERE id = CAST(:id AS uuid)"), {"id": settlement_id}).mappings().first()
    if not s:
        raise HTTPException(404, "Settlement not found")
    if s["status"] == "settled":
        raise HTTPException(400, "Already settled")
    if s["status"] == "blocked":
        raise HTTPException(400, "This settlement is blocked for a pujari no-show and cannot be paid out")
    if body.mark_settled:
        # Credit pujari if not legacy/double
        try:
            apply_wallet(
                db,
                str(s["pujari_id"]),
                int(s["settlement_amount_paise"]),
                "credit",
                f"Settlement override {settlement_id[:8]}",
                str(s["booking_id"]),
            )
        except ValueError as e:
            raise HTTPException(400, str(e))
        db.execute(
            text(
                """
                UPDATE settlements SET status = 'settled', settled_at = NOW(), override_flag = TRUE,
                  override_reason = :r, override_by = CAST(:u AS uuid), payment_reference = :pref
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"r": body.reason, "u": user["id"], "pref": body.payment_reference, "id": settlement_id},
        )
        db.execute(
            text("UPDATE bookings SET settlement_status = 'settled' WHERE id = CAST(:id AS uuid)"),
            {"id": str(s["booking_id"])},
        )
    write_audit(db, str(user["id"]), "settlement_override", "settlement", settlement_id, reason=body.reason)
    db.commit()
    return {"ok": True}


@router.get("/config/public")
def public_config(db: Session = Depends(get_db)):
    from app.email_service import smtp_status

    return {
        "virtual_puja_enabled": bool(get_setting(db, "virtual_puja_enabled", False)),
        "service_area_unavailable_heading": str(
            get_setting(db, "service_area_unavailable_heading", "BSeva is not available in this area yet")
        ),
        "service_area_unavailable_description": str(
            get_setting(
                db,
                "service_area_unavailable_description",
                "We could not find an eligible BSeva pujari near this location. Please try another address or check again soon.",
            )
        ),
        "customer_timezones": __import__("app.timezones", fromlist=["CUSTOMER_TIMEZONES"]).CUSTOMER_TIMEZONES,
        "bseva_whatsapp_number": str(get_setting(db, "bseva_whatsapp_number", "919014654994")),
        "pujari_full_booking_details_before_hours": int(get_setting(db, "pujari_full_booking_details_before_hours", 20)),
        "puja_start_otp_before_minutes": int(get_setting(db, "puja_start_otp_before_minutes", 15)),
        "pujari_location_tracking_before_minutes": int(
            get_setting(db, "pujari_location_tracking_before_minutes", 15)
        ),
        "pujari_gps_update_interval_seconds": int(get_setting(db, "pujari_gps_update_interval_seconds", 60)),
        "customer_tracking_refresh_seconds": int(get_setting(db, "customer_tracking_refresh_seconds", 60)),
        "pujari_arrival_radius_meters": int(get_setting(db, "pujari_arrival_radius_meters", 100)),
        "puja_complete_otp_before_minutes": int(get_setting(db, "puja_complete_otp_before_minutes", 15)),
        "puja_otp_resend_cooldown_seconds": int(get_setting(db, "puja_otp_resend_cooldown_seconds", 60)),
        "registration_captcha_enabled": bool(get_setting(db, "registration_captcha_enabled", False)),
        "recaptcha_site_key": __import__("os").environ.get("VITE_RECAPTCHA_SITE_KEY")
        or __import__("os").environ.get("RECAPTCHA_SITE_KEY")
        or "",
        "customer_cancel_fee_over_48h_percent": int(get_setting(db, "customer_cancel_fee_over_48h_percent", 10)),
        "customer_cancel_fee_24_48h_percent": int(get_setting(db, "customer_cancel_fee_24_48h_percent", 50)),
        "customer_cancel_fee_under_24h_percent": int(get_setting(db, "customer_cancel_fee_under_24h_percent", 100)),
        "customer_cancel_min_hours": int(get_setting(db, "customer_cancel_min_hours", 24)),
        "email_from_contact": str(get_setting(db, "email_from_contact", "contact@b-seva.com")),
        "email_from_support": str(get_setting(db, "email_from_support", "support@b-seva.com")),
        "email_delivery": smtp_status(),
    }
