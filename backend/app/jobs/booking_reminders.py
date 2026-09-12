"""24-hour booking reminder notifications for pujaris (req #99).

Run periodically (cron / worker):
  python -c "from app.jobs.booking_reminders import send_upcoming_booking_reminders; print(send_upcoming_booking_reminders())"
"""
from __future__ import annotations

from uuid import uuid4

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
                SELECT b.id, b.booking_number, b.pujari_id, b.booking_date, b.start_time, s.name AS service_name
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
            exists = session.execute(
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
                {"uid": str(b["pujari_id"]), "needle": f"%{b['booking_number']}%"},
            ).first()
            if exists:
                skipped += 1
                continue
            session.execute(
                text(
                    """
                    INSERT INTO notifications (id, user_id, channel, title, body, category, is_read)
                    VALUES (
                      CAST(:id AS uuid), CAST(:uid AS uuid), 'in_app',
                      :title, :body, 'booking_reminder', FALSE
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "uid": str(b["pujari_id"]),
                    "title": "Upcoming booking reminder",
                    "body": f"Reminder: {b['service_name']} ({b['booking_number']}) is within {hours_ahead} hours.",
                },
            )
            admins = session.execute(
                text(
                    """
                    SELECT id FROM users
                    WHERE role = 'super_admin' AND COALESCE(blocked, FALSE) = FALSE
                    LIMIT 10
                    """
                )
            ).mappings().all()
            for admin in admins:
                session.execute(
                    text(
                        """
                        INSERT INTO notifications (id, user_id, channel, title, body, category, is_read)
                        VALUES (
                          CAST(:id AS uuid), CAST(:uid AS uuid), 'in_app',
                          :title, :body, 'ops', FALSE
                        )
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "uid": str(admin["id"]),
                        "title": "Pujari booking reminder sent",
                        "body": f"24h reminder queued for {b['booking_number']}.",
                    },
                )
            created += 1
        session.commit()
        return {"created": created, "skipped": skipped}
    finally:
        if own:
            session.close()


if __name__ == "__main__":
    print(send_upcoming_booking_reminders())
