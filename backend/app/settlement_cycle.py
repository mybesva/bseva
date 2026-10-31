"""Pujari payment cycle: paydays fall every N days counted from the pujari's joining date."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import apply_wallet
from app.platform_config import get_setting
from app.sensitive_auth import SYSTEM_ACTOR, log_event
from app.timezones import IST_ZONE

DEFAULT_CYCLE_DAYS = 3


def cycle_days(db: Session) -> int:
    try:
        return max(1, int(get_setting(db, "pujari_settlement_days", DEFAULT_CYCLE_DAYS)))
    except (TypeError, ValueError):
        return DEFAULT_CYCLE_DAYS


def today_ist() -> date:
    return datetime.now(ZoneInfo(IST_ZONE)).date()


def next_payday(joined: date, after: date, every: int) -> date:
    """First payday strictly after `after`, on the pujari's own cycle from `joined`."""
    if after < joined:
        return joined + timedelta(days=every)
    return after + timedelta(days=every - (after - joined).days % every)


def pujari_next_payday(db: Session, pujari_id: str) -> date:
    joined = db.execute(
        text(
            """
            SELECT (created_at AT TIME ZONE :tz)::date FROM users WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": pujari_id, "tz": IST_ZONE},
    ).scalar()
    today = today_ist()
    return next_payday(joined or today, today, cycle_days(db))


def run_due_settlements(db: Session) -> dict:
    """Pay every settlement whose payday has arrived. The caller commits."""
    every = cycle_days(db)
    due = db.execute(
        text(
            """
            SELECT * FROM settlements
            WHERE status IN ('pending', 'eligible')
              AND due_date IS NOT NULL
              AND due_date <= :today
            ORDER BY due_date
            FOR UPDATE SKIP LOCKED
            """
        ),
        {"today": today_ist()},
    ).mappings().all()
    settled = 0
    for s in due:
        try:
            apply_wallet(
                db,
                str(s["pujari_id"]),
                int(s["settlement_amount_paise"] or 0),
                "credit",
                f"Auto settlement (every {every} days)",
                str(s["booking_id"]),
            )
        except ValueError:
            db.execute(
                text("UPDATE settlements SET status = 'eligible' WHERE id = :id AND status = 'pending'"),
                {"id": s["id"]},
            )
            continue
        db.execute(
            text(
                """
                UPDATE settlements SET
                  status = 'settled',
                  settled_at = NOW(),
                  override_flag = FALSE,
                  override_reason = :reason,
                  payment_reference = COALESCE(payment_reference, 'AUTO_CYCLE')
                WHERE id = :id AND status IN ('pending', 'eligible')
                """
            ),
            {"id": s["id"], "reason": f"Automatic settlement on the {every}-day payment cycle"},
        )
        db.execute(
            text("UPDATE bookings SET settlement_status = 'settled' WHERE id = CAST(:id AS uuid)"),
            {"id": str(s["booking_id"])},
        )
        log_event(
            db,
            SYSTEM_ACTOR,
            "settled",
            "success",
            settlement_id=str(s["id"]),
            amount_paise=int(s["settlement_amount_paise"] or 0),
            reference=s["payment_reference"] or "AUTO_CYCLE",
            reason=f"{every}-day payment cycle",
        )
        settled += 1
    return {"settled": settled, "due": len(due)}
