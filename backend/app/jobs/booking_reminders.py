"""Automated booking window jobs (Vercel Cron — no manual runs needed).

- Every 10 minutes: 24h-ahead reminders (customer + pujari in-app)
- Every 1 minute: issue start OTP inside the 15-minute pre-start window
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import SessionLocal


def send_upcoming_booking_reminders(db: Session | None = None, hours_ahead: int = 24) -> dict:
    own = db is None
    session = db or SessionLocal()
    created = 0
    skipped = 0
    try:
        rows = session.execute(
            text(
                """
                SELECT b.id, b.booking_number, b.pujari_id, b.customer_id, b.booking_date, b.start_time,
                       b.samagri_requested, s.name AS service_name
                FROM bookings b
                JOIN services s ON s.id = b.service_id
                WHERE b.status IN ('confirmed', 'pending_acceptance')
                  AND b.pujari_id IS NOT NULL
                  AND (b.booking_date + COALESCE(b.start_time, TIME '00:00'))
                      BETWEEN NOW() AND NOW() + make_interval(hours => :hrs)
                """
            ),
            {"hrs": hours_ahead},
        ).mappings().all()
        for b in rows:
            samagri = bool(b.get("samagri_requested"))
            booking_num = b["booking_number"]
            service_name = b.get("service_name") or "Puja"

            # Pujari in-app reminder
            if b.get("pujari_id"):
                exists = session.execute(
                    text(
                        """
                        SELECT id FROM notifications
                        WHERE user_id = CAST(:uid AS uuid)
                          AND category IN ('booking_reminder', 'samagri_reminder')
                          AND body ILIKE :needle
                          AND created_at > NOW() - INTERVAL '36 hours'
                        LIMIT 1
                        """
                    ),
                    {"uid": str(b["pujari_id"]), "needle": f"%{booking_num}%"},
                ).first()
                if exists:
                    skipped += 1
                else:
                    if samagri:
                        title = "Samagri reminder — upcoming puja"
                        body = (
                            f"Booking {booking_num} ({service_name}): the customer selected Samagri. "
                            f"Please review the Samagri list in your Bookings and arrange materials before the puja."
                        )
                        cat = "samagri_reminder"
                    else:
                        title = "Upcoming booking reminder"
                        body = f"Reminder: {service_name} ({booking_num}) is within {hours_ahead} hours."
                        cat = "booking_reminder"
                    from app.routers.notifications import create_notification

                    create_notification(
                        session,
                        user_id=str(b["pujari_id"]),
                        title=title,
                        body=body,
                        category=cat,
                        link="/pujari/bookings",
                        extra_data={"booking_id": str(b["id"])},
                        message_key="samagriReminder" if samagri else "reminder",
                        message_vars={"number": booking_num, "service": service_name, "hours": hours_ahead},
                    )
                    created += 1

            # Customer in-app reminder (24h)
            if b.get("customer_id"):
                c_exists = session.execute(
                    text(
                        """
                        SELECT id FROM notifications
                        WHERE user_id = CAST(:uid AS uuid)
                          AND category = 'booking_reminder'
                          AND body ILIKE :needle
                          AND created_at > NOW() - INTERVAL '36 hours'
                        LIMIT 1
                        """
                    ),
                    {"uid": str(b["customer_id"]), "needle": f"%{booking_num}%"},
                ).first()
                if not c_exists:
                    from app.routers.notifications import create_notification

                    create_notification(
                        session,
                        user_id=str(b["customer_id"]),
                        title="Upcoming puja reminder",
                        body=(
                            f"Reminder: {service_name} ({booking_num}) starts within "
                            f"{hours_ahead} hours. Your start OTP will appear in the app "
                            f"15 minutes before the puja."
                        ),
                        category="booking_reminder",
                        link="/customer/bookings",
                        extra_data={"booking_id": str(b["id"])},
                        message_key="reminder",
                        message_vars={"service": service_name, "number": booking_num, "hours": hours_ahead},
                    )
                    created += 1

            # Admin reminder: call pujari to confirm booking (+ Samagri if applicable)
            try:
                from app.routers.notifications import notify_ops_staff

                admin_exists = session.execute(
                    text(
                        """
                        SELECT id FROM notifications
                        WHERE category = 'admin_pujari_call_reminder'
                          AND body ILIKE :needle
                          AND created_at > NOW() - INTERVAL '36 hours'
                        LIMIT 1
                        """
                    ),
                    {"needle": f"%{booking_num}%"},
                ).first()
                if not admin_exists:
                    sam_bit = (
                        " Customer selected Samagri — confirm Samagri arrangements with the pujari."
                        if samagri
                        else ""
                    )
                    notify_ops_staff(
                        session,
                        title="Call pujari — 24h booking confirmation",
                        body=(
                            f"Please call the assigned pujari for {service_name} ({booking_num}) "
                            f"to confirm the booking and service details.{sam_bit}"
                        ),
                        category="admin_pujari_call_reminder",
                        link="/admin/bookings",
                    )
                    created += 1
            except Exception:
                pass

            # Customer email reminder (best-effort)
            try:
                from app.mail.booking_payload import booking_email_data_from_row, load_customer_email_context
                from app.mail.senders import send_booking_reminder_email

                cust_id = b.get("customer_id")
                if cust_id:
                    ctx = load_customer_email_context(session, str(cust_id))
                    brow = session.execute(
                        text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"),
                        {"id": str(b["id"])},
                    ).mappings().first()
                    if ctx.get("email") and brow:
                        data = booking_email_data_from_row(
                            dict(brow),
                            customer_name=ctx["name"],
                            service_name=str(b.get("service_name") or "Puja"),
                            language=ctx["language"],
                        )
                        send_booking_reminder_email(to=ctx["email"], data=data, hours_ahead=hours_ahead)
            except Exception:
                pass
        session.commit()
        return {"created": created, "skipped": skipped}
    finally:
        if own:
            session.close()


def issue_start_otps_nearing_start(db: Session | None = None) -> dict:
    """Auto-issue start OTP for confirmed bookings inside the configured pre-start window."""
    from app.puja_otp import PURPOSE_START, _active_row, issue_puja_otp, otp_window_minutes, within_start_window

    own = db is None
    session = db or SessionLocal()
    issued = 0
    skipped = 0
    try:
        mins = otp_window_minutes(session)
        look_hours = max(mins / 60.0, 0.25) + (10 / 60.0)
        rows = session.execute(
            text(
                """
                SELECT b.*, s.name AS service_name
                FROM bookings b
                JOIN services s ON s.id = b.service_id
                WHERE b.status = 'confirmed'
                  AND b.customer_id IS NOT NULL
                  AND (b.booking_date + COALESCE(b.start_time, TIME '00:00'))
                      BETWEEN NOW() - INTERVAL '30 minutes'
                          AND NOW() + make_interval(secs => :secs)
                """
            ),
            {"secs": int(look_hours * 3600)},
        ).mappings().all()
        for b in rows:
            if not within_start_window(session, b["booking_date"], b["start_time"]):
                skipped += 1
                continue
            if _active_row(session, str(b["id"]), PURPOSE_START):
                skipped += 1
                continue
            issue_puja_otp(session, dict(b), PURPOSE_START, notify=True, skip_rate_limit=True)
            issued += 1
        session.commit()
        return {"issued": issued, "skipped": skipped, "window_minutes": mins}
    finally:
        if own:
            session.close()


def issue_complete_otps_nearing_end(db: Session | None = None) -> dict:
    from app.puja_otp import PURPOSE_COMPLETE, _active_row, issue_puja_otp, within_complete_window

    own = db is None
    session = db or SessionLocal()
    issued = 0
    skipped = 0
    try:
        rows = session.execute(
            text(
                """
                SELECT b.*, s.name AS service_name
                FROM bookings b
                JOIN services s ON s.id = b.service_id
                WHERE b.status = 'in_progress'
                  AND b.pujari_id IS NOT NULL
                """
            )
        ).mappings().all()
        for b in rows:
            booking = dict(b)
            if not within_complete_window(session, booking):
                skipped += 1
                continue
            if _active_row(session, str(booking["id"]), PURPOSE_COMPLETE):
                skipped += 1
                continue
            try:
                issue_puja_otp(session, booking, PURPOSE_COMPLETE, notify=True, skip_rate_limit=True)
                issued += 1
            except Exception:
                skipped += 1
        session.commit()
        return {"issued": issued, "skipped": skipped}
    finally:
        if own:
            session.close()


def notify_location_unlocked(db: Session | None = None) -> dict:
    from app.booking_visibility import pujari_hours_before_full
    from app.domain import hours_until

    own = db is None
    session = db or SessionLocal()
    created = 0
    skipped = 0
    try:
        hours = float(pujari_hours_before_full(session))
        rows = session.execute(
            text(
                """
                SELECT b.id, b.booking_number, b.pujari_id, b.booking_date, b.start_time,
                       s.name AS service_name
                FROM bookings b
                JOIN services s ON s.id = b.service_id
                WHERE b.status = 'confirmed'
                  AND b.pujari_id IS NOT NULL
                  AND COALESCE(b.mode, 'in_person') <> 'virtual'
                """
            )
        ).mappings().all()
        for b in rows:
            if hours_until(b["booking_date"], b["start_time"]) > hours:
                skipped += 1
                continue
            exists = session.execute(
                text(
                    """
                    SELECT id FROM notifications
                    WHERE user_id = CAST(:uid AS uuid)
                      AND category = 'location_unlocked'
                      AND COALESCE(link, '') LIKE :needle
                      AND created_at > NOW() - INTERVAL '36 hours'
                    LIMIT 1
                    """
                ),
                {"uid": str(b["pujari_id"]), "needle": f"%{b['id']}%"},
            ).first()
            if exists:
                skipped += 1
                continue
            from app.routers.notifications import create_notification

            num = b.get("booking_number") or str(b["id"])[:8]
            create_notification(
                session,
                user_id=str(b["pujari_id"]),
                title="Service location is now available",
                body=(
                    f"The customer service location for {b.get('service_name') or 'Puja'} ({num}) "
                    "is now available. Open Bookings for maps and directions."
                ),
                category="location_unlocked",
                link="/pujari/bookings",
                extra_data={"booking_id": str(b["id"])},
                message_key="locationUnlocked",
                message_vars={"service": b.get("service_name") or "Puja", "number": num},
            )
            created += 1
        session.commit()
        return {"created": created, "skipped": skipped, "hours": hours}
    finally:
        if own:
            session.close()


def run_booking_window_jobs() -> dict:
    return {
        "reminders_24h": send_upcoming_booking_reminders(hours_ahead=24),
        "start_otp": issue_start_otps_nearing_start(),
        "complete_otp": issue_complete_otps_nearing_end(),
        "location_unlock": notify_location_unlocked(),
    }


if __name__ == "__main__":
    print(run_booking_window_jobs())
