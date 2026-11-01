"""Customer puja rescheduling. The booking keeps its id and payment; only the slot and pujari change."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.booking_state import set_booking_status
from app.domain import apply_wallet
from app.i18n import coded_http
from app.platform_config import get_setting
from app.timezones import IST_ZONE, ist_date_time, to_utc

logger = logging.getLogger(__name__)

RESCHEDULABLE_STATUSES = ("pending", "pending_acceptance", "confirmed")
DEFAULT_CUTOFF_HOURS = 48.0


def _number(db: Session, key: str, default: float) -> float:
    try:
        return max(0.0, float(get_setting(db, key, default)))
    except (TypeError, ValueError):
        return float(default)


def reschedule_rules(db: Session) -> dict[str, Any]:
    return {
        "enabled": bool(get_setting(db, "reschedule_enabled", True)),
        "cutoff_hours": _number(db, "reschedule_cutoff_hours", DEFAULT_CUTOFF_HOURS),
        "fee_enabled": bool(get_setting(db, "reschedule_fee_enabled", False)),
        "first_fee_paise": int(_number(db, "reschedule_first_fee_paise", 0)),
        "subsequent_fee_paise": int(_number(db, "reschedule_subsequent_fee_paise", 0)),
        "performance_rule_enabled": bool(get_setting(db, "reschedule_performance_rule_enabled", False)),
        "performance_min_rating": _number(db, "reschedule_performance_min_rating", 4),
        "performance_fee_paise": int(_number(db, "reschedule_performance_fee_paise", 0)),
    }


def pujari_rating_summary(db: Session, pujari_id: str) -> dict[str, Any]:
    """Approved customer ratings only, matching the public pujari profile."""
    row = db.execute(
        text(
            """
            SELECT AVG(stars) AS average, COUNT(*) AS count
            FROM ratings
            WHERE to_user_id = CAST(:id AS uuid) AND skipped = FALSE AND role_from = 'customer'
              AND COALESCE(moderation_status, 'approved') = 'approved'
            """
        ),
        {"id": str(pujari_id)},
    ).mappings().first()
    count = int((row or {}).get("count") or 0)
    return {"average": round(float(row["average"]), 1) if count else None, "count": count}


def pujari_performance(db: Session, pujari_id: str | None) -> dict[str, Any] | None:
    if not pujari_id:
        return None
    row = db.execute(
        text(
            """
            SELECT u.name,
              (SELECT COUNT(*) FROM bookings b WHERE b.pujari_id = u.id AND b.status = 'completed') AS completed
            FROM users u WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": str(pujari_id)},
    ).mappings().first()
    if not row:
        return None
    return {"name": row["name"], "completed_pujas": int(row["completed"] or 0), "rating": pujari_rating_summary(db, pujari_id)}


def reschedule_fee(rules: dict[str, Any], prior_count: int, pujari_rating: float | None) -> tuple[int, str]:
    """Fee for the next reschedule of this booking, and the rule that set it."""
    if not rules["fee_enabled"]:
        return 0, "free"
    if rules["performance_rule_enabled"] and pujari_rating is not None and pujari_rating < rules["performance_min_rating"]:
        return rules["performance_fee_paise"], "pujari_performance"
    if prior_count <= 0:
        return rules["first_fee_paise"], "first"
    return rules["subsequent_fee_paise"], "subsequent"


def booking_start(booking: dict[str, Any]) -> datetime:
    utc = booking.get("start_at_utc")
    if utc:
        return utc if utc.tzinfo else utc.replace(tzinfo=timezone.utc)
    return datetime.combine(booking["booking_date"], booking["start_time"], tzinfo=ZoneInfo(IST_ZONE))


def outside_cutoff(start: datetime, now: datetime, cutoff_hours: float) -> bool:
    """Strictly more than the cutoff: at exactly the cutoff, rescheduling is closed."""
    return start - now > timedelta(hours=cutoff_hours)


def blocked_reason(booking: dict[str, Any], rules: dict[str, Any], now: datetime) -> tuple[str, str] | None:
    """(code, message) when this booking cannot be rescheduled, else None."""
    if not rules["enabled"]:
        return "RESCHEDULE_DISABLED", "Rescheduling is not available right now."
    if booking.get("status") not in RESCHEDULABLE_STATUSES or booking.get("payment_status") != "paid":
        return "RESCHEDULE_NOT_ALLOWED", "This booking can no longer be rescheduled."
    if not outside_cutoff(booking_start(booking), now, rules["cutoff_hours"]):
        return (
            "RESCHEDULE_CUTOFF",
            f"Rescheduling closes {rules['cutoff_hours']:g} hours before the puja starts.",
        )
    return None


def reschedule_history(db: Session, booking_id: str) -> list[dict[str, Any]]:
    rows = db.execute(
        text("SELECT * FROM booking_reschedules WHERE booking_id = CAST(:id AS uuid) ORDER BY sequence DESC"),
        {"id": booking_id},
    ).mappings().all()
    return [
        {
            "sequence": r["sequence"],
            "old_date": r["old_date"].isoformat(),
            "old_start_time": r["old_start_time"].isoformat(),
            "new_date": r["new_date"].isoformat(),
            "new_start_time": r["new_start_time"].isoformat(),
            "fee_paise": r["fee_paise"],
            "initiated_by_name": r["initiated_by_name"],
            "initiated_by_role": r["initiated_by_role"],
            "previous_pujari_name": r["previous_pujari_name"],
            "previous_pujari_rating": float(r["previous_pujari_rating"]) if r["previous_pujari_rating"] is not None else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


def pujari_visible_to_customer(db: Session, booking: dict[str, Any]) -> bool:
    """Same rule as the booking screens: accepted, and inside the details window."""
    from app.booking_visibility import can_pujari_see_full

    return booking.get("status") == "confirmed" and can_pujari_see_full(
        db, booking["booking_date"], booking["start_time"]
    )


def reschedule_summary(db: Session, booking: dict[str, Any]) -> dict[str, Any]:
    rules = reschedule_rules(db)
    start = booking_start(booking)
    blocked = blocked_reason(booking, rules, datetime.now(timezone.utc))
    performance = pujari_performance(db, booking.get("pujari_id"))
    rating = ((performance or {}).get("rating") or {}).get("average")
    fee, _ = reschedule_fee(rules, int(booking.get("reschedule_count") or 0), rating)
    if not pujari_visible_to_customer(db, booking):
        performance = None
    lead = db.execute(
        text("SELECT booking_lead_hours FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(booking["service_id"])},
    ).scalar()
    return {
        "eligible": blocked is None,
        "blocked_code": blocked[0] if blocked else None,
        "blocked_message": blocked[1] if blocked else None,
        "cutoff_hours": rules["cutoff_hours"],
        "deadline": (start - timedelta(hours=rules["cutoff_hours"])).isoformat(),
        "next_fee_paise": fee,
        "lead_hours": int(lead) if lead and lead >= 1 else 48,
        "reschedule_count": int(booking.get("reschedule_count") or 0),
        "pujari_performance": performance,
        "history": reschedule_history(db, str(booking["id"])),
    }


def _new_slot(db: Session, booking: dict[str, Any], new_date: date, new_time: time) -> dict[str, Any]:
    """Same slot and notice rules as a new booking, whichever timezone the customer booked in."""
    service = db.execute(
        text("SELECT duration_minutes, booking_lead_hours FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(booking["service_id"])},
    ).mappings().one()
    duration = int(service["duration_minutes"] or 90)
    lead = int(service["booking_lead_hours"]) if service["booking_lead_hours"] else 48
    start_at_utc = None
    ist_day, start = new_date, new_time
    if booking.get("mode") == "virtual":
        zone = booking.get("customer_timezone") or IST_ZONE
        start_at_utc = to_utc(new_date, new_time, zone)
        ist_day, start = ist_date_time(new_date, new_time, zone)
        moment = start_at_utc
    else:
        moment = datetime.combine(new_date, new_time, tzinfo=ZoneInfo(IST_ZONE))
    if moment < datetime.now(timezone.utc) + timedelta(hours=lead):
        raise coded_http(400, "RESCHEDULE_TOO_SOON", f"Choose a time at least {lead} hours from now.")
    if ist_day == booking["booking_date"] and start == booking["start_time"]:
        raise coded_http(400, "RESCHEDULE_SAME_SLOT", "Choose a different date or time.")
    end = (datetime.combine(ist_day, start) + timedelta(minutes=duration)).time()
    return {"date": ist_day, "start": start, "end": end, "start_at_utc": start_at_utc}


def _history_entry(booking: dict[str, Any], user: dict) -> str:
    history = booking.get("assignment_history") or []
    if isinstance(history, str):
        try:
            history = json.loads(history)
        except ValueError:
            history = []
    if not isinstance(history, list):
        history = []
    if booking.get("pujari_id"):
        history.append(
            {
                "from": str(booking["pujari_id"]),
                "to": None,
                "by": str(user["id"]),
                "at": date.today().isoformat(),
                "prev_status": booking.get("status"),
                "reason": "customer_rescheduled",
            }
        )
    return json.dumps(history)


def _send_notifications(
    db: Session,
    booking: dict[str, Any],
    *,
    old_label: str,
    new_label: str,
    invited: list[str],
    service_name: str,
) -> None:
    from app.booking_offers import notify_pujaris_new_offer
    from app.routers.notifications import create_notification, customer_booking_link, notify_ops_staff

    booking_id = str(booking["id"])
    num = str(booking.get("booking_number") or booking_id[:8])
    create_notification(
        db,
        user_id=str(booking["customer_id"]),
        title="Puja rescheduled",
        body=f"Booking {num} moved from {old_label} to {new_label}. We are finding a pujari for the new time.",
        category="booking",
        link=customer_booking_link(booking_id),
        extra_data={"booking_id": booking_id},
    )
    if booking.get("pujari_id"):
        create_notification(
            db,
            user_id=str(booking["pujari_id"]),
            title="Puja rescheduled",
            body=(
                f"The customer moved {service_name} ({num}) from {old_label} to {new_label}. "
                "It is no longer assigned to you. If you are free, you can accept the new request."
            ),
            category="booking",
            link="/pujari/bookings",
            extra_data={"booking_id": booking_id},
        )
    notify_pujaris_new_offer(
        db,
        pujari_ids=invited,
        booking_id=booking_id,
        booking_number=num,
        service_name=service_name,
        service_id=str(booking["service_id"]),
    )
    notify_ops_staff(
        db,
        title="Customer rescheduled a puja",
        body=(
            f"{num} moved to {new_label} and was sent to {len(invited)} pujari(s)."
            if invited
            else f"{num} moved to {new_label}. No eligible pujari available — assign manually."
        ),
        category="ops",
        link="/admin/bookings?status=waiting_pujari" if invited else "/admin/bookings?status=needs_pujari",
    )


def _send_emails(db: Session, booking: dict[str, Any], *, old_date: str, old_time: str, old_label: str, new_label: str) -> None:
    from app.mail.booking_payload import booking_email_data_from_row, load_service_name
    from app.mail.senders import send_admin_notification_email, send_booking_rescheduled_email

    people = {
        str(r["id"]): r
        for r in db.execute(
            text("SELECT id, email, name, preferred_language FROM users WHERE id = ANY(CAST(:ids AS uuid[]))"),
            {"ids": [str(x) for x in (booking["customer_id"], booking.get("previous_pujari_id")) if x]},
        ).mappings()
    }
    customer = people.get(str(booking["customer_id"]))
    if customer and customer.get("email"):
        language = str(customer.get("preferred_language") or "en")
        data = booking_email_data_from_row(
            booking,
            customer_name=str(customer.get("name") or ""),
            service_name=load_service_name(db, str(booking["service_id"]), language),
            language=language,
            extra={"status": "pending_acceptance"},
        )
        send_booking_rescheduled_email(to=str(customer["email"]), data=data, previous_date=old_date, previous_time=old_time)
    pujari = people.get(str(booking.get("previous_pujari_id")))
    if pujari and pujari.get("email"):
        send_admin_notification_email(
            to=str(pujari["email"]),
            title="Puja rescheduled",
            message="The customer moved this puja, so it is no longer assigned to you. If you are free, you can accept the new request.",
            details=[("Booking", str(booking.get("booking_number") or "")), ("Previous time", old_label), ("New time", new_label)],
        )


def reschedule_booking(db: Session, booking_id: str, user: dict, new_date: date, new_time: time) -> dict[str, Any]:
    """Move a paid booking, release its pujari and send it back out through the normal offer flow.

    Everything up to the commit is one transaction, so a failure leaves the booking unchanged."""
    from app.booking_offers import create_offers_for_booking, withdraw_open_offers

    row = db.execute(
        text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"), {"id": booking_id}
    ).mappings().first()
    if not row or str(row["customer_id"]) != str(user["id"]):
        raise coded_http(404, "BOOKING_NOT_FOUND", "Booking not found")
    b = dict(row)
    rules = reschedule_rules(db)
    blocked = blocked_reason(b, rules, datetime.now(timezone.utc))
    if blocked:
        raise coded_http(400, blocked[0], blocked[1])
    slot = _new_slot(db, b, new_date, new_time)

    prior = int(b.get("reschedule_count") or 0)
    previous_pujari = str(b["pujari_id"]) if b.get("pujari_id") else None
    performance = pujari_performance(db, previous_pujari)
    rating = (performance or {}).get("rating", {}).get("average")
    fee, fee_rule = reschedule_fee(rules, prior, rating)
    num = str(b.get("booking_number") or booking_id[:8])
    if fee > 0:
        try:
            apply_wallet(db, str(user["id"]), -fee, "debit", f"Reschedule fee {num}", booking_id)
        except ValueError as e:
            db.rollback()
            raise coded_http(400, "RESCHEDULE_FEE_FAILED", str(e)) from e

    was_visible = pujari_visible_to_customer(db, b)
    old_date, old_start = b["booking_date"], b["start_time"]
    db.execute(
        text(
            """
            UPDATE bookings SET
              booking_date = :d, start_time = :st, end_time = :et, start_at_utc = :utc,
              pujari_id = NULL, accepted_at = NULL, needs_reassignment = FALSE, rejection_reason = NULL,
              assignment_history = CAST(:hist AS jsonb), reschedule_count = reschedule_count + 1,
              meeting_url = NULL, google_calendar_event_id = NULL
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "d": slot["date"],
            "st": slot["start"],
            "et": slot["end"],
            "utc": slot["start_at_utc"],
            "hist": _history_entry(b, user),
            "id": booking_id,
        },
    )
    if b["status"] != "pending_acceptance":
        set_booking_status(db, booking_id, "pending_acceptance", actor_id=str(user["id"]))
    # Offers were for the old slot: close them, then invite whoever is free for the new one.
    withdraw_open_offers(db, booking_id)
    invited: list[str] = []
    if b.get("mode") != "virtual":
        invited = create_offers_for_booking(db, booking_id, reinvite=True)
    db.execute(
        text(
            """
            INSERT INTO booking_reschedules (
              booking_id, sequence, old_date, old_start_time, new_date, new_start_time,
              previous_pujari_id, previous_pujari_name, previous_pujari_rating, fee_paise, fee_rule,
              offers_sent, initiated_by, initiated_by_name, initiated_by_role
            ) VALUES (
              CAST(:b AS uuid), :seq, :od, :ot, :nd, :nt,
              CAST(:pp AS uuid), :ppn, :ppr, :fee, :rule, :offers, CAST(:u AS uuid), :un, :ur
            )
            """
        ),
        {
            "b": booking_id,
            "seq": prior + 1,
            "od": old_date,
            "ot": old_start,
            "nd": slot["date"],
            "nt": slot["start"],
            "pp": previous_pujari,
            "ppn": (performance or {}).get("name") if was_visible else None,
            "ppr": rating if was_visible else None,
            "fee": fee,
            "rule": fee_rule,
            "offers": len(invited),
            "u": str(user["id"]),
            "un": str(user.get("name") or "Customer"),
            "ur": str(user["role"]),
        },
    )
    write_audit(db, str(user["id"]), f"booking_rescheduled:{prior + 1}", "booking", booking_id)

    old_label = f"{old_date.strftime('%d-%m-%Y')} {old_start.strftime('%H:%M')}"
    new_label = f"{slot['date'].strftime('%d-%m-%Y')} {slot['start'].strftime('%H:%M')}"
    service_name = str(
        db.execute(text("SELECT name FROM services WHERE id = CAST(:id AS uuid)"), {"id": str(b["service_id"])}).scalar()
        or "Puja"
    )
    moved = {**b, "booking_date": slot["date"], "start_time": slot["start"], "end_time": slot["end"]}
    try:
        with db.begin_nested():
            _send_notifications(
                db, moved, old_label=old_label, new_label=new_label, invited=invited, service_name=service_name
            )
    except Exception:
        logger.exception("reschedule_notifications_failed booking=%s", booking_id)
    db.commit()
    try:
        _send_emails(
            db,
            {**moved, "pujari_id": None, "previous_pujari_id": previous_pujari},
            old_date=old_date.isoformat(),
            old_time=old_start.strftime("%H:%M"),
            old_label=old_label,
            new_label=new_label,
        )
    except Exception:
        logger.exception("reschedule_email_failed booking=%s", booking_id)
    return {
        "ok": True,
        "status": "pending_acceptance",
        "booking_id": booking_id,
        "reschedule_count": prior + 1,
        "fee_paise": fee,
        "offers_sent": len(invited),
        "booking_date": slot["date"].isoformat(),
        "start_time": slot["start"].isoformat(),
    }
