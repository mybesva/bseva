"""Pujari no-show penalty: auto-apply after grace period; admin can override."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.domain import apply_wallet
from app.platform_config import get_setting


def _parse_start(start: Any) -> time:
    if isinstance(start, time):
        return start
    if isinstance(start, str):
        parts = start.split(":")
        return time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0, int(float(parts[2])) if len(parts) > 2 else 0)
    if hasattr(start, "hour"):
        return time(start.hour, start.minute, getattr(start, "second", 0) or 0)
    return time(0, 0)


def _booking_start_dt(booking_date: Any, start: Any) -> datetime:
    d = booking_date if isinstance(booking_date, date) else date.fromisoformat(str(booking_date)[:10])
    return datetime.combine(d, _parse_start(start))


def penalty_paise_for_booking(db: Session, booking: Any) -> int:
    """No-show penalty is 100% of that puja's cost."""
    for key in ("base_price_paise", "pujari_payable_paise"):
        try:
            value = int(booking.get(key) or 0)
        except (TypeError, ValueError):
            value = 0
        if value > 0:
            return value
    sid = booking.get("service_id")
    if not sid:
        return 0
    row = db.execute(
        text(
            """
            SELECT COALESCE(main_puja_price_paise, standard_price_paise, 0)
            FROM services
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": str(sid)},
    ).first()
    return max(0, int(row[0] or 0)) if row else 0


def grace_hours(db: Session) -> float:
    return max(0.0, float(get_setting(db, "pujari_no_show_grace_hours", 2) or 0))


def penalty_enabled(db: Session) -> bool:
    return bool(get_setting(db, "pujari_no_show_penalty_enabled", True))


def _block_settlement_for_no_show(db: Session, booking: Any, penalty_paise: int) -> None:
    """Hold settlement for this booking equal to the no-show amount (do not auto-pay it)."""
    if penalty_paise <= 0 or not booking.get("pujari_id"):
        return
    bid = str(booking["id"])
    pid = str(booking["pujari_id"])
    try:
        with db.begin_nested():
            db.execute(text("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_paise INTEGER NOT NULL DEFAULT 0"))
            db.execute(text("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_reason TEXT"))
    except Exception:
        pass
    existing = db.execute(
        text("SELECT id, status FROM settlements WHERE booking_id = CAST(:id AS uuid)"),
        {"id": bid},
    ).mappings().first()
    if existing:
        if existing["status"] == "settled":
            db.execute(
                text(
                    """
                    UPDATE settlements SET blocked_paise = :amt, blocked_reason = 'pujari_no_show', updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"amt": penalty_paise, "id": existing["id"]},
            )
        else:
            db.execute(
                text(
                    """
                    UPDATE settlements SET
                      status = 'blocked',
                      blocked_paise = :amt,
                      blocked_reason = 'pujari_no_show',
                      settlement_amount_paise = 0,
                      pujari_payable_paise = 0,
                      updated_at = NOW()
                    WHERE id = :id AND status IN ('pending', 'eligible')
                    """
                ),
                {"amt": penalty_paise, "id": existing["id"]},
            )
            db.execute(
                text("UPDATE bookings SET settlement_status = 'blocked' WHERE id = CAST(:id AS uuid)"),
                {"id": bid},
            )
        return
    db.execute(
        text(
            """
            INSERT INTO settlements (
              booking_id, pujari_id, customer_payment_paise, base_puja_paise,
              platform_fee_paise, gst_paise, pujari_payable_paise, settlement_amount_paise,
              due_date, status, blocked_paise, blocked_reason
            ) VALUES (
              CAST(:bid AS uuid), CAST(:pid AS uuid), :pay, :base, 0, 0, 0, 0,
              CURRENT_DATE, 'blocked', :amt, 'pujari_no_show'
            )
            ON CONFLICT (booking_id) DO UPDATE SET
              status = 'blocked',
              blocked_paise = EXCLUDED.blocked_paise,
              blocked_reason = 'pujari_no_show',
              settlement_amount_paise = 0,
              pujari_payable_paise = 0,
              updated_at = NOW()
            """
        ),
        {
            "bid": bid,
            "pid": pid,
            "pay": int(booking.get("total_paise") or 0),
            "base": int(booking.get("base_price_paise") or penalty_paise),
            "amt": penalty_paise,
        },
    )
    db.execute(
        text("UPDATE bookings SET settlement_status = 'blocked' WHERE id = CAST(:id AS uuid)"),
        {"id": bid},
    )


def apply_no_show_to_booking(
    db: Session,
    booking: Any,
    *,
    actor_id: str | None,
    waive: bool = False,
    reason: str | None = None,
    amount_paise: int | None = None,
    auto: bool = False,
) -> dict:
    """Apply or waive no-show on one booking. Idempotent if already marked with penalty."""
    bid = str(booking["id"])
    if not booking.get("pujari_id"):
        return {"ok": False, "error": "No pujari assigned", "booking_id": bid}
    if booking["status"] not in ("confirmed", "in_progress", "cancelled", "completed"):
        return {"ok": False, "error": "Status not eligible", "booking_id": bid}

    already = booking.get("no_show_marked_at")
    already_amt = int(booking.get("no_show_penalty_paise") or 0)
    # Allow admin override/waive even if already marked; auto-skip if already marked
    if auto and already:
        return {"ok": True, "skipped": True, "booking_id": bid, "penalty_paise": already_amt}

    enabled = penalty_enabled(db)
    configured = penalty_paise_for_booking(db, booking)
    amount = configured if amount_paise is None else max(0, int(amount_paise))

    if waive or not enabled or amount <= 0:
        db.execute(
            text(
                """
                UPDATE bookings SET no_show_penalty_paise = 0, no_show_marked_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": bid},
        )
        write_audit(
            db,
            actor_id or "system",
            f"{'auto_' if auto else ''}no_show_waived:{reason or 'waived'}",
            "booking",
            bid,
        )
        return {"ok": True, "waived": True, "penalty_paise": 0, "booking_id": bid, "auto": auto}

    # If re-applying after a previous mark with different amount, only debit the delta when increasing;
    # for simplicity: if already had a penalty, don't double-debit unless amount_paise override and previous was 0.
    if already and already_amt > 0 and amount_paise is None:
        return {"ok": True, "skipped": True, "booking_id": bid, "penalty_paise": already_amt}

    debit = amount
    if already and already_amt > 0 and amount_paise is not None:
        # Adjust: if new amount higher, debit difference; if lower, leave wallet as-is (admin edit records amount)
        if amount > already_amt:
            debit = amount - already_amt
        else:
            debit = 0

    if debit > 0:
        try:
            apply_wallet(
                db,
                str(booking["pujari_id"]),
                -debit,
                "debit",
                f"{'Auto ' if auto else ''}No-show penalty for booking {booking.get('booking_number') or bid}",
                bid,
                f"NOSHOW-{bid[:8]}-{uuid4().hex[:4]}",
                allow_overdraft=True,
            )
        except ValueError as e:
            return {"ok": False, "error": str(e), "booking_id": bid}

    db.execute(
        text(
            """
            UPDATE bookings SET no_show_penalty_paise = :amt, no_show_marked_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"amt": amount, "id": bid},
    )
    try:
        _block_settlement_for_no_show(db, booking, amount)
    except Exception:
        pass
    write_audit(
        db,
        actor_id or "system",
        f"{'auto_' if auto else ''}no_show_penalty:{amount}:{reason or ''}",
        "booking",
        bid,
    )
    return {
        "ok": True,
        "waived": False,
        "penalty_paise": amount,
        "debited_paise": debit,
        "booking_id": bid,
        "auto": auto,
    }


def process_auto_no_shows(db: Session, *, limit: int = 50) -> dict:
    """Mark confirmed bookings past scheduled start + grace as no-show and apply penalty."""
    if not penalty_enabled(db):
        return {"ok": True, "processed": 0, "applied": 0, "errors": [], "disabled": True}

    grace = grace_hours(db)
    cutoff = datetime.now() - timedelta(hours=grace)
    rows = db.execute(
        text(
            """
            SELECT *
            FROM bookings
            WHERE status = 'confirmed'
              AND pujari_id IS NOT NULL
              AND no_show_marked_at IS NULL
              AND booking_date IS NOT NULL
              AND start_time IS NOT NULL
            ORDER BY booking_date ASC, start_time ASC
            LIMIT :lim
            """
        ),
        {"lim": limit},
    ).mappings().all()

    applied = 0
    processed = 0
    errors: list[str] = []
    for r in rows:
        try:
            start_dt = _booking_start_dt(r["booking_date"], r["start_time"])
        except Exception:
            continue
        if start_dt > cutoff:
            continue
        processed += 1
        out = apply_no_show_to_booking(
            db,
            r,
            actor_id=None,
            waive=False,
            reason="auto: past scheduled start + grace",
            auto=True,
        )
        if out.get("ok") and not out.get("skipped") and not out.get("waived"):
            applied += 1
        elif not out.get("ok"):
            errors.append(f"{out.get('booking_id')}: {out.get('error')}")

    if processed:
        db.commit()
    return {"ok": True, "processed": processed, "applied": applied, "errors": errors, "grace_hours": grace}
