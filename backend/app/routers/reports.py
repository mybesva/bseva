"""Admin analytics reports generated from live booking/payment data."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

from app.db import get_db
from app.domain import row_dict
from app.rbac import require_any_permission

router = APIRouter(prefix="/admin", tags=["admin-reports"])

RANGE_KEYS = ("today", "last_7_days", "last_30_days", "last_90_days", "this_year", "custom")


def period_bounds(
    range_key: str,
    date_from: str | None = None,
    date_to: str | None = None,
    *,
    today: date | None = None,
) -> tuple[date, date, str]:
    today = today or date.today()
    key = (range_key or "last_30_days").strip().lower()
    if key not in RANGE_KEYS:
        key = "last_30_days"
    if key == "custom":
        if not date_from or not date_to:
            raise HTTPException(400, "Custom range needs from and to dates")
        try:
            start = date.fromisoformat(date_from[:10])
            end = date.fromisoformat(date_to[:10])
        except ValueError as e:
            raise HTTPException(400, "Dates must be YYYY-MM-DD") from e
        if start > end:
            start, end = end, start
        return start, end, f"{start.isoformat()} to {end.isoformat()}"
    if key == "today":
        return today, today, "Today"
    if key == "last_7_days":
        return today - timedelta(days=6), today, "Last 7 days"
    if key == "last_90_days":
        return today - timedelta(days=89), today, "Last 90 days"
    if key == "this_year":
        return date(today.year, 1, 1), today, str(today.year)
    return today - timedelta(days=29), today, "Last 30 days"


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return 100.0 if current > 0 else 0.0 if current == 0 else None
    return round(((current - previous) / previous) * 100, 1)


def _q(db: Session, sql: str, params: dict) -> list[dict]:
    try:
        return [row_dict(r) for r in db.execute(text(sql), params).mappings().all()]
    except Exception:
        log.exception("reports query failed")
        db.rollback()
        return []


def _scalar(db: Session, sql: str, params: dict, default: Any = 0):
    try:
        val = db.execute(text(sql), params).scalar()
    except Exception:
        log.exception("reports scalar failed")
        db.rollback()
        return default
    return default if val is None else val


@router.get("/reports")
def generate_report(
    range: str = Query("last_30_days"),
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    user=Depends(require_any_permission("view_reports", "view_bookings")),
    db: Session = Depends(get_db),
):
    start, end, label = period_bounds(range, date_from, date_to)
    days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    params = {"start": start, "end": end, "pstart": prev_start, "pend": prev_end}

    in_period = "b.created_at::date BETWEEN :start AND :end"
    paid = "COALESCE(b.payment_status, 'paid') = 'paid' AND b.status <> 'cancelled'"

    bookings = int(_scalar(db, f"SELECT COUNT(*) FROM bookings b WHERE {in_period}", params))
    bookings_prev = int(_scalar(db, "SELECT COUNT(*) FROM bookings b WHERE b.created_at::date BETWEEN :pstart AND :pend", params))
    revenue = int(
        _scalar(
            db,
            f"SELECT COALESCE(SUM(b.total_paise), 0) FROM bookings b WHERE {in_period} AND {paid}",
            params,
        )
    )
    revenue_prev = int(
        _scalar(
            db,
            f"""
            SELECT COALESCE(SUM(b.total_paise), 0) FROM bookings b
            WHERE b.created_at::date BETWEEN :pstart AND :pend AND {paid}
            """,
            params,
        )
    )
    cancelled = int(
        _scalar(db, f"SELECT COUNT(*) FROM bookings b WHERE {in_period} AND b.status = 'cancelled'", params)
    )
    completed = int(
        _scalar(db, f"SELECT COUNT(*) FROM bookings b WHERE {in_period} AND b.status = 'completed'", params)
    )
    confirmed = int(
        _scalar(
            db,
            f"""
            SELECT COUNT(*) FROM bookings b
            WHERE {in_period} AND b.status IN ('confirmed', 'accepted', 'in_progress', 'pending_acceptance', 'pending')
            """,
            params,
        )
    )

    active_pujaris = int(
        _scalar(
            db,
            """
            SELECT COUNT(*)
            FROM pujari_profiles pp
            JOIN users u ON u.id = pp.user_id
            WHERE pp.verification_status = 'approved'
              AND u.role IN ('pujari', 'head_pujari')
              AND COALESCE(u.blocked, FALSE) = FALSE
            """,
            params,
        )
    )
    serving_pujaris = int(
        _scalar(
            db,
            f"""
            SELECT COUNT(DISTINCT b.pujari_id)
            FROM bookings b
            WHERE {in_period} AND b.pujari_id IS NOT NULL AND b.status <> 'cancelled'
            """,
            params,
        )
    )

    total_customers = int(_scalar(db, "SELECT COUNT(*) FROM users WHERE role = 'customer'", params))
    new_customers = int(
        _scalar(
            db,
            "SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at::date BETWEEN :start AND :end",
            params,
        )
    )
    booked_customers = int(
        _scalar(db, f"SELECT COUNT(DISTINCT b.customer_id) FROM bookings b WHERE {in_period}", params)
    )
    repeat_customers = int(
        _scalar(
            db,
            f"""
            SELECT COUNT(*) FROM (
              SELECT b.customer_id
              FROM bookings b
              WHERE {in_period} AND b.status <> 'cancelled'
              GROUP BY b.customer_id
              HAVING COUNT(*) > 1
            ) r
            """,
            params,
        )
    )
    repeat_rate = round((repeat_customers / booked_customers) * 100, 1) if booked_customers else 0.0

    avg_rating = _scalar(
        db,
        f"""
        SELECT ROUND(AVG(r.stars)::numeric, 2)
        FROM ratings r
        JOIN bookings b ON b.id = r.booking_id
        WHERE {in_period} AND COALESCE(r.skipped, FALSE) = FALSE AND r.stars > 0
          AND r.role_from = 'customer'
        """,
        params,
        None,
    )
    try:
        avg_rating = float(avg_rating) if avg_rating is not None else None
    except (TypeError, ValueError):
        avg_rating = None

    trend = _q(
        db,
        f"""
        SELECT b.created_at::date AS date,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
               COUNT(*) FILTER (WHERE b.status = 'completed') AS completed,
               COUNT(*) FILTER (
                 WHERE b.status IN ('confirmed', 'accepted', 'in_progress', 'pending_acceptance', 'pending')
               ) AS confirmed
        FROM bookings b
        WHERE {in_period}
        GROUP BY 1
        ORDER BY 1
        """,
        params,
    )

    methods = _q(
        db,
        f"""
        SELECT COALESCE(NULLIF(p.provider, ''), 'wallet') AS method,
               COUNT(*) AS count,
               COALESCE(SUM(p.amount_paise), 0) AS amount_paise
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE {in_period} AND p.status IN ('successful', 'paid', 'completed')
        GROUP BY 1
        ORDER BY 3 DESC
        """,
        params,
    )
    if not methods:
        wallet_amt = revenue
        methods = (
            [{"method": "wallet", "count": bookings, "amount_paise": wallet_amt}]
            if wallet_amt or bookings
            else []
        )
    method_total = sum(int(m.get("amount_paise") or 0) for m in methods) or 1
    for m in methods:
        m["percentage"] = round(int(m.get("amount_paise") or 0) * 100 / method_total, 1)
        m["method"] = str(m.get("method") or "wallet").replace("_", " ").replace("demo", "").strip().title() or "Wallet"

    services = _q(
        db,
        f"""
        SELECT s.id::text AS id, s.name,
               COUNT(b.id) AS bookings,
               COALESCE(SUM(b.total_paise) FILTER (WHERE {paid}), 0) AS revenue,
               COALESCE(s.duration_minutes, 90) AS avg_duration
        FROM services s
        JOIN bookings b ON b.service_id = s.id AND {in_period}
        GROUP BY s.id, s.name, s.duration_minutes
        ORDER BY bookings DESC, revenue DESC
        LIMIT 40
        """,
        params,
    )

    pujaris = _q(
        db,
        f"""
        SELECT u.id::text AS id, u.name,
               COUNT(b.id) AS bookings,
               COALESCE(ROUND(AVG(r.stars) FILTER (WHERE COALESCE(r.skipped, FALSE) = FALSE AND r.stars > 0)::numeric, 1), 0) AS rating,
               COALESCE(SUM(COALESCE(b.pujari_payable_paise, 0)) FILTER (WHERE b.status <> 'cancelled'), 0) AS earnings,
               CASE
                 WHEN COALESCE(u.blocked, FALSE) THEN 'unavailable'
                 WHEN COALESCE(p.available, TRUE) THEN 'available'
                 ELSE 'busy'
               END AS availability_status
        FROM users u
        JOIN pujari_profiles p ON p.user_id = u.id
        LEFT JOIN bookings b ON b.pujari_id = u.id AND {in_period}
        LEFT JOIN ratings r ON r.to_user_id = u.id AND r.role_from = 'customer'
          AND r.booking_id = b.id
        WHERE u.role IN ('pujari', 'head_pujari')
          AND p.verification_status = 'approved'
        GROUP BY u.id, u.name, u.blocked, p.available
        HAVING COUNT(b.id) > 0
        ORDER BY bookings DESC, earnings DESC
        LIMIT 50
        """,
        params,
    )

    top_customers = _q(
        db,
        f"""
        SELECT u.id::text AS id, u.name, u.email,
               COUNT(b.id) AS bookings,
               COALESCE(SUM(b.total_paise) FILTER (WHERE {paid}), 0) AS spent_paise
        FROM bookings b
        JOIN users u ON u.id = b.customer_id
        WHERE {in_period}
        GROUP BY u.id, u.name, u.email
        ORDER BY bookings DESC, spent_paise DESC
        LIMIT 25
        """,
        params,
    )

    locations = _q(
        db,
        f"""
        SELECT COALESCE(
                 NULLIF(TRIM(split_part(
                   COALESCE(b.location_label, ''),
                   ',',
                   GREATEST(1, COALESCE(array_length(string_to_array(COALESCE(b.location_label, ''), ','), 1), 1))
                 )), ''),
                 'Unspecified'
               ) AS name,
               COUNT(*) AS bookings,
               COALESCE(SUM(b.total_paise) FILTER (WHERE {paid}), 0) AS revenue,
               COALESCE(MAX(b.mode), 'in_person') AS city
        FROM bookings b
        WHERE {in_period}
        GROUP BY 1
        ORDER BY bookings DESC
        LIMIT 25
        """,
        params,
    )
    modes = _q(
        db,
        f"""
        SELECT COALESCE(b.mode, 'in_person') AS name,
               COUNT(*) AS bookings,
               COALESCE(SUM(b.total_paise) FILTER (WHERE {paid}), 0) AS revenue
        FROM bookings b
        WHERE {in_period}
        GROUP BY 1
        ORDER BY bookings DESC
        """,
        params,
    )

    samagri = _q(
        db,
        f"""
        SELECT si.id::text AS id, si.name, COALESCE(si.unit, 'pcs') AS unit,
               COUNT(x.id) AS consumed,
               COUNT(DISTINCT x.booking_id) AS bookings,
               CASE WHEN COALESCE(si.active, TRUE) THEN 'OK' ELSE 'Inactive' END AS status
        FROM samagri_items si
        LEFT JOIN (
          SELECT ss.id, ss.booking_id, ss.name
          FROM booking_samagri_snapshot ss
          JOIN bookings b ON b.id = ss.booking_id
          WHERE b.created_at::date BETWEEN :start AND :end
        ) x ON lower(x.name) = lower(si.name)
        GROUP BY si.id, si.name, si.unit, si.active
        ORDER BY consumed DESC, si.name
        LIMIT 50
        """,
        params,
    )
    samagri_bookings = int(
        _scalar(
            db,
            f"SELECT COUNT(*) FROM bookings b WHERE {in_period} AND COALESCE(b.samagri_requested, FALSE) = TRUE",
            params,
        )
    )

    commissions = int(
        _scalar(
            db,
            f"SELECT COALESCE(SUM(b.platform_fee_paise), 0) FROM bookings b WHERE {in_period} AND {paid}",
            params,
        )
    )
    priest_payouts = int(
        _scalar(
            db,
            """
            SELECT COALESCE(SUM(s.settlement_amount_paise), 0)
            FROM settlements s
            JOIN bookings b ON b.id = s.booking_id
            WHERE b.created_at::date BETWEEN :start AND :end
              AND s.status = 'settled'
            """,
            params,
        )
    )
    pending_settlements = int(
        _scalar(
            db,
            """
            SELECT COALESCE(SUM(s.settlement_amount_paise), 0)
            FROM settlements s
            JOIN bookings b ON b.id = s.booking_id
            WHERE b.created_at::date BETWEEN :start AND :end
              AND s.status IN ('pending', 'eligible')
            """,
            params,
        )
    )
    refunds = int(
        _scalar(
            db,
            f"SELECT COALESCE(SUM(COALESCE(b.refund_paise, 0)), 0) FROM bookings b WHERE {in_period}",
            params,
        )
    )

    return {
        "period": {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "label": label,
            "range": range if range in RANGE_KEYS else "last_30_days",
        },
        "overview": {
            "revenue_paise": revenue,
            "revenue_change_pct": _pct_change(revenue, revenue_prev),
            "bookings": bookings,
            "bookings_change_pct": _pct_change(bookings, bookings_prev),
            "cancelled": cancelled,
            "completed": completed,
            "confirmed": confirmed,
            "active_pujaris": active_pujaris,
            "serving_pujaris": serving_pujaris,
            "avg_rating": avg_rating,
            "repeat_rate": repeat_rate,
            "trend": trend,
            "payment_methods": methods,
            "top_services": services[:8],
        },
        "pujaris": pujaris,
        "customers": {
            "total_customers": total_customers,
            "new_registrations": new_customers,
            "total_bookings": bookings,
            "booked_customers": booked_customers,
            "repeat_rate": repeat_rate,
            "avg_rating": avg_rating,
            "top": top_customers,
        },
        "temples": locations,
        "modes": modes,
        "services": services,
        "samagri": samagri,
        "samagri_bookings": samagri_bookings,
        "payments": {
            "gmv": revenue,
            "commissions": commissions,
            "priest_payouts": priest_payouts,
            "pending_settlements": pending_settlements,
            "refunds": refunds,
            "by_method": methods,
        },
    }
