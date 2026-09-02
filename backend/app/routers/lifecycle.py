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
from app.security import hash_password, verify_password

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
                       pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name, s.slug AS service_slug
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.id = CAST(:id AS uuid)
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
                       pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name, s.slug AS service_slug
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.booking_number = :num
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
    # Samagri snapshot
    try:
        sam = db.execute(
            text("SELECT * FROM booking_samagri_snapshot WHERE booking_id = CAST(:id AS uuid) ORDER BY sort_order"),
            {"id": str(row["id"])},
        ).mappings().all()
        data["samagri"] = [row_dict(r) for r in sam]
    except Exception:
        data["samagri"] = []
    return data


@router.post("/bookings/{booking_id}/accept")
def accept_booking(booking_id: str, body: AcceptIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    if not body.terms_accepted:
        raise HTTPException(400, "Terms must be accepted")
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] not in ("pending", "pending_acceptance", "confirmed"):
        raise HTTPException(400, "Booking cannot be accepted in current status")
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
    db.commit()
    try:
        from app.email_service import send_booking_event_email
        from app.platform_config import get_setting as _gs

        cust = db.execute(
            text("SELECT email, name FROM users WHERE id = CAST(:id AS uuid)"),
            {"id": str(b["customer_id"])},
        ).mappings().first()
        if cust and cust.get("email"):
            send_booking_event_email(
                to=str(cust["email"]),
                subject=f"BSeva — Booking accepted ({b.get('booking_number') or booking_id[:8]})",
                text_body=(
                    f"Namaste {cust.get('name') or ''},\n\n"
                    f"Your pujari has accepted booking {b.get('booking_number') or booking_id}.\n"
                    f"Scheduled: {b.get('booking_date')} {b.get('start_time')}\n\nOm Shanti,\nBSeva\n"
                ),
                from_addr=str(_gs(db, "email_from_support", "support@b-seva.com")),
            )
    except Exception:
        pass
    return {"ok": True, "status": "confirmed"}


@router.post("/bookings/{booking_id}/start-otp/request")
def request_start_otp(booking_id: str, user=Depends(require_roles("pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Booking must be confirmed to start")
    mins = int(get_setting(db, "puja_start_otp_before_minutes", 10))
    hrs = hours_until(b["booking_date"], b["start_time"])
    if hrs * 60 > mins and get_setting(db, "environment", "development") == "x":
        pass  # allow early in all envs for temp deploy; window check soft
    # Soft window: allow if within 2 hours before or already past start
    if hrs > 2:
        raise HTTPException(400, f"OTP available from {mins} minutes before scheduled start (soft window: 2h)")
    from app.config import settings as app_settings

    code = app_settings.otp_dev_code if app_settings.environment != "production" else f"{uuid4().int % 1_000_000:06d}"
    code_hash = hash_password(code)
    expires = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.execute(
        text(
            """
            INSERT INTO otp_codes (phone, email, purpose, code_hash, expires_at)
            VALUES (:phone, :email, 'start_puja', :h, :exp)
            """
        ),
        {
            "phone": f"booking:{booking_id}",
            "email": str(b["customer_id"]),
            "h": code_hash,
            "exp": expires,
        },
    )
    db.execute(
        text("UPDATE bookings SET otp_sent_at = NOW() WHERE id = CAST(:id AS uuid)"),
        {"id": booking_id},
    )
    db.commit()
    # Dev/temp: return code when not production
    out = {"ok": True, "expires_at": expires.isoformat(), "sent_to": "customer"}
    if app_settings.environment != "production":
        out["dev_code"] = code
    return out


@router.post("/bookings/{booking_id}/start-otp/verify")
def verify_start_otp(booking_id: str, body: StartOtpVerifyIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Booking must be confirmed")
    # Rate limit: max 10 attempts via recent OTPs
    row = db.execute(
        text(
            """
            SELECT * FROM otp_codes
            WHERE phone = :phone AND purpose = 'start_puja' AND consumed = FALSE
              AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"phone": f"booking:{booking_id}"},
    ).mappings().first()
    if not row or not verify_password(body.code, row["code_hash"]):
        raise HTTPException(400, "Invalid or expired OTP")
    db.execute(text("UPDATE otp_codes SET consumed = TRUE WHERE id = :id"), {"id": row["id"]})
    set_booking_status(db, booking_id, "in_progress", actor_id=str(user["id"]))
    write_audit(db, str(user["id"]), "puja_started", "booking", booking_id)
    db.commit()
    return {"ok": True, "status": "in_progress"}


@router.post("/bookings/{booking_id}/complete")
def complete_booking(booking_id: str, user=Depends(require_roles("pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] != "in_progress":
        raise HTTPException(400, "Booking must be in progress")
    set_booking_status(db, booking_id, "completed", actor_id=str(user["id"]))
    # Create settlement pending for new model (skip legacy)
    share = float(get_setting(db, "pujari_share_percent", 85)) / 100.0
    days = int(get_setting(db, "pujari_settlement_days", 14))
    base = int(b["base_price_paise"])
    platform = int(round(base * (1 - share)))
    payable = int(round(base * share))
    due = date.today() + timedelta(days=days)
    try:
        st = b.get("settlement_status") or "not_applicable"
        if st != "legacy":
            db.execute(
                text(
                    """
                    INSERT INTO settlements (
                      booking_id, pujari_id, customer_payment_paise, base_puja_paise,
                      platform_fee_paise, gst_paise, pujari_payable_paise, settlement_amount_paise,
                      due_date, status
                    ) VALUES (
                      CAST(:bid AS uuid), CAST(:pid AS uuid), :pay, :base, :plat, :gst, :payable, :payable, :due, 'pending'
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
                    "due": due,
                },
            )
            db.execute(
                text("UPDATE bookings SET settlement_status = 'pending', pujari_payable_paise = :p WHERE id = CAST(:id AS uuid)"),
                {"p": payable, "id": booking_id},
            )
    except Exception:
        pass
    _maybe_loyalty(db, str(b["pujari_id"]), booking_id)
    _maybe_referral_reward(db, str(b["customer_id"]), booking_id)
    # Customer + settlement invoice snapshots
    try:
        from app.invoice_docs import create_customer_invoice, create_settlement_invoice

        create_customer_invoice(db, booking=dict(b), user_id=str(b["customer_id"]))
        sett = db.execute(
            text("SELECT * FROM settlements WHERE booking_id = CAST(:id AS uuid)"),
            {"id": booking_id},
        ).mappings().first()
        if sett:
            create_settlement_invoice(db, booking=dict(b), settlement=dict(sett))
    except Exception:
        pass
    write_audit(db, str(user["id"]), "puja_completed", "booking", booking_id)
    db.commit()
    return {"ok": True, "status": "completed"}


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
                INSERT INTO ratings (booking_id, from_user_id, to_user_id, role_from, stars, comment, skipped)
                VALUES (CAST(:b AS uuid), CAST(:f AS uuid), CAST(:t AS uuid), :r, :s, :c, FALSE)
                ON CONFLICT (booking_id, from_user_id) DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, skipped = FALSE
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
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    mins = int(get_setting(db, "pujari_location_tracking_before_minutes", 15))
    hrs = hours_until(b["booking_date"], b["start_time"])
    if b["status"] not in ("confirmed", "in_progress") or hrs > (mins / 60.0 + 0.01):
        if b["status"] != "in_progress":
            raise HTTPException(400, "Location tracking not active for this booking yet")
    db.execute(
        text(
            """
            INSERT INTO pujari_location_pings (booking_id, pujari_id, latitude, longitude)
            VALUES (CAST(:b AS uuid), CAST(:p AS uuid), :lat, :lng)
            """
        ),
        {"b": booking_id, "p": user["id"], "lat": body.latitude, "lng": body.longitude},
    )
    db.commit()
    return {"ok": True}


@router.get("/bookings/{booking_id}/location")
def get_location(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    allowed = user["role"] in ("admin", "super_admin") or str(user["id"]) in (str(b["customer_id"]), str(b["pujari_id"]))
    if not allowed:
        raise HTTPException(403, "Not allowed")
    # 24h rule for customer viewing before window? Customer can see during active tracking
    row = db.execute(
        text(
            """
            SELECT latitude, longitude, recorded_at FROM pujari_location_pings
            WHERE booking_id = CAST(:b AS uuid) ORDER BY recorded_at DESC LIMIT 1
            """
        ),
        {"b": booking_id},
    ).mappings().first()
    return row_dict(row) if row else None


@router.get("/settlements")
def list_settlements(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] in ("admin", "super_admin"):
        rows = db.execute(text("SELECT * FROM settlements ORDER BY created_at DESC LIMIT 200")).mappings().all()
    elif user["role"] == "pujari":
        rows = db.execute(
            text("SELECT * FROM settlements WHERE pujari_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
            {"id": user["id"]},
        ).mappings().all()
    else:
        raise HTTPException(403, "Not allowed")
    # Mark eligible
    days = int(get_setting(db, "pujari_settlement_days", 14))
    for r in rows:
        if r["status"] == "pending" and r["due_date"] and r["due_date"] <= date.today():
            db.execute(
                text("UPDATE settlements SET status = 'eligible' WHERE id = :id AND status = 'pending'"),
                {"id": r["id"]},
            )
    db.commit()
    return [row_dict(r) for r in rows]


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
        "bseva_whatsapp_number": str(get_setting(db, "bseva_whatsapp_number", "919876543210")),
        "pujari_full_booking_details_before_hours": int(get_setting(db, "pujari_full_booking_details_before_hours", 24)),
        "puja_start_otp_before_minutes": int(get_setting(db, "puja_start_otp_before_minutes", 10)),
        "email_from_contact": str(get_setting(db, "email_from_contact", "contact@b-seva.com")),
        "email_from_support": str(get_setting(db, "email_from_support", "support@b-seva.com")),
        "email_delivery": smtp_status(),
    }
