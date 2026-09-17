"""Admin sidebar ACTION-REQUIRED badge counts.

These are operational queues, not unread/visit counters. Visiting a page must
not change them — only resolving the underlying record does.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

PUJARI_ACTION_STATUSES = ("pending", "under_review", "correction_required")

_PUJARI_LINES = {
    "pending": ("Pujari pending verification", "Pujaris pending verification"),
    "under_review": ("Pujari under review", "Pujaris under review"),
    "correction_required": ("Pujari needs correction", "Pujaris need correction"),
}

_PAYMENT_LINES = {
    "failed": ("failed payment", "failed payments"),
    "refund_pending": ("refund pending", "refunds pending"),
    "refund_requested": ("refund requested", "refunds requested"),
}


def _qty(n: int, one: str, many: str) -> str:
    label = one if n == 1 else many
    return f"{n} {label}"


def format_tooltip(parts: list[str]) -> str:
    return "\n".join(p for p in parts if p)


def booking_tooltip(
    awaiting: int,
    reassign: int,
    *,
    virtual: bool,
    awaiting_accept: int = 0,
) -> str:
    if virtual:
        if awaiting and not reassign and not awaiting_accept:
            return _qty(
                awaiting,
                "Virtual Puja request requiring action",
                "Virtual Puja requests requiring action",
            )
        if awaiting_accept and not awaiting and not reassign:
            return _qty(
                awaiting_accept,
                "Virtual Puja request awaiting pujari acceptance",
                "Virtual Puja requests awaiting pujari acceptance",
            )
        return format_tooltip(
            [
                _qty(
                    awaiting,
                    "Virtual Puja request awaiting Pujari assignment",
                    "Virtual Puja requests awaiting Pujari assignment",
                )
                if awaiting
                else "",
                _qty(
                    awaiting_accept,
                    "Virtual Puja request awaiting pujari acceptance",
                    "Virtual Puja requests awaiting pujari acceptance",
                )
                if awaiting_accept
                else "",
                _qty(
                    reassign,
                    "Virtual Puja request requiring reassignment",
                    "Virtual Puja requests requiring reassignment",
                )
                if reassign
                else "",
            ]
        )
    return format_tooltip(
        [
            _qty(awaiting, "booking awaiting Pujari assignment", "bookings awaiting Pujari assignment") if awaiting else "",
            _qty(reassign, "booking requiring Pujari reassignment", "bookings requiring Pujari reassignment")
            if reassign
            else "",
        ]
    )


def pujari_tooltip(by_status: dict[str, int], service_reviews: int = 0) -> str:
    parts: list[str] = []
    for key in PUJARI_ACTION_STATUSES:
        n = int(by_status.get(key) or 0)
        if n <= 0:
            continue
        one, many = _PUJARI_LINES[key]
        parts.append(_qty(n, one, many))
    if service_reviews:
        parts.append(
            _qty(
                service_reviews,
                "approved Pujari has services awaiting review",
                "approved Pujaris have services awaiting review",
            )
        )
    return format_tooltip(parts)


def payment_tooltip(by_status: dict[str, int]) -> str:
    parts: list[str] = []
    for key, (one, many) in _PAYMENT_LINES.items():
        n = int(by_status.get(key) or 0)
        if n > 0:
            parts.append(_qty(n, one, many))
    return format_tooltip(parts)


def settlement_tooltip(awaiting: int, blocked: int) -> str:
    return format_tooltip(
        [
            _qty(awaiting, "settlement awaiting payout cycle", "settlements awaiting payout cycle") if awaiting else "",
            _qty(blocked, "blocked settlement needing review", "blocked settlements needing review") if blocked else "",
        ]
    )


def muhurtham_tooltip(requested: int, in_progress: int) -> str:
    return format_tooltip(
        [
            _qty(requested, "new Muhurtham consultation", "new Muhurtham consultations") if requested else "",
            _qty(in_progress, "Muhurtham consultation in progress", "Muhurtham consultations in progress")
            if in_progress
            else "",
        ]
    )


def _count(db: Session, sql: str, params: dict | None = None) -> int:
    return int(db.execute(text(sql), params or {}).scalar() or 0)


def _grouped_counts(db: Session, sql: str, params: dict | None = None) -> dict[str, int]:
    rows = db.execute(text(sql), params or {}).mappings().all()
    out: dict[str, int] = {}
    for row in rows:
        key = str(row.get("key") or "")
        if key:
            out[key] = int(row.get("n") or 0)
    return out


def _table_exists(db: Session, name: str) -> bool:
    return bool(db.execute(text("SELECT to_regclass(:n)"), {"n": f"public.{name}"}).scalar())


def _booking_buckets(db: Session, *, virtual: bool) -> tuple[int, int, int, str]:
    mode_sql = (
        "mode = 'virtual' AND COALESCE(booking_kind, 'puja') = 'puja'"
        if virtual
        else "COALESCE(mode, 'in_person') <> 'virtual' AND COALESCE(booking_kind, 'puja') = 'puja'"
    )
    awaiting = _count(
        db,
        f"""
        SELECT COUNT(*) FROM bookings
        WHERE {mode_sql}
          AND status NOT IN ('cancelled', 'completed')
          AND pujari_id IS NULL
        """,
    )
    reassign = _count(
        db,
        f"""
        SELECT COUNT(*) FROM bookings
        WHERE {mode_sql}
          AND status NOT IN ('cancelled', 'completed')
          AND pujari_id IS NOT NULL
          AND (
            COALESCE(needs_reassignment, FALSE) = TRUE
            OR status = 'rejected'
          )
        """,
    )
    awaiting_accept = 0
    if virtual:
        awaiting_accept = _count(
            db,
            """
            SELECT COUNT(*) FROM bookings
            WHERE mode = 'virtual'
              AND COALESCE(booking_kind, 'puja') = 'puja'
              AND status = 'pending_acceptance'
              AND pujari_id IS NOT NULL
              AND COALESCE(needs_reassignment, FALSE) = FALSE
            """,
        )
    total = awaiting + reassign + awaiting_accept
    return total, awaiting, reassign, booking_tooltip(
        awaiting, reassign, virtual=virtual, awaiting_accept=awaiting_accept
    )


def _pujari_queue(db: Session) -> tuple[int, str]:
    by_status = _grouped_counts(
        db,
        """
        SELECT p.verification_status AS key, COUNT(*) AS n
        FROM pujari_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE COALESCE(u.blocked, FALSE) = FALSE
          AND p.verification_status IN ('pending', 'under_review', 'correction_required')
        GROUP BY p.verification_status
        """,
    )
    verification = sum(int(by_status.get(k) or 0) for k in PUJARI_ACTION_STATUSES)
    service_reviews = 0
    if _table_exists(db, "pujari_service_applications") and _table_exists(db, "pujari_verified_services"):
        service_reviews = _count(
            db,
            """
            SELECT COUNT(DISTINCT a.pujari_id)
            FROM pujari_service_applications a
            JOIN pujari_profiles p ON p.user_id = a.pujari_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN pujari_verified_services v
              ON v.pujari_id = a.pujari_id AND v.service_id = a.service_id
            WHERE v.service_id IS NULL
              AND p.verification_status = 'approved'
              AND COALESCE(u.blocked, FALSE) = FALSE
            """,
        )
    total = verification + service_reviews
    return total, pujari_tooltip(by_status, service_reviews)


def _payment_queue(db: Session) -> tuple[int, str]:
    by_status = _grouped_counts(
        db,
        """
        SELECT payment_status AS key, COUNT(*) AS n
        FROM bookings
        WHERE payment_status IN ('refund_pending', 'refund_requested')
           OR (payment_status = 'failed' AND status <> 'cancelled')
        GROUP BY payment_status
        """,
    )
    total = sum(by_status.values())
    return total, payment_tooltip(by_status)


def _settlement_queue(db: Session) -> tuple[int, str]:
    if not _table_exists(db, "settlements"):
        return 0, ""
    awaiting = _count(
        db,
        """
        SELECT COUNT(*) FROM settlements
        WHERE status IN ('pending', 'eligible', 'held')
        """,
    )
    blocked = _count(
        db,
        """
        SELECT COUNT(*) FROM settlements
        WHERE status = 'blocked'
        """,
    )
    total = awaiting + blocked
    return total, settlement_tooltip(awaiting, blocked)


def _muhurtham_queue(db: Session) -> tuple[int, str]:
    if not _table_exists(db, "muhurta_consultations"):
        return 0, ""
    by_status = _grouped_counts(
        db,
        """
        SELECT status AS key, COUNT(*) AS n
        FROM muhurta_consultations
        WHERE status IN ('requested', 'in_progress')
        GROUP BY status
        """,
    )
    requested = int(by_status.get("requested") or 0)
    in_progress = int(by_status.get("in_progress") or 0)
    return requested + in_progress, muhurtham_tooltip(requested, in_progress)


def admin_action_badges(db: Session) -> dict:
    bookings_n, _ba, _br, bookings_tip = _booking_buckets(db, virtual=False)
    virtual_n, _va, _vr, virtual_tip = _booking_buckets(db, virtual=True)
    pujaris_n, pujaris_tip = _pujari_queue(db)
    payments_n, payments_tip = _payment_queue(db)
    settlements_n, settlements_tip = _settlement_queue(db)
    muhurtham_n, muhurtham_tip = _muhurtham_queue(db)

    support_n = _count(
        db,
        """
        SELECT COUNT(*) FROM support_tickets
        WHERE LOWER(COALESCE(status, 'open')) IN ('open', 'pending', 'new', 'in_progress')
        """,
    )

    tooltips = {
        "pujaris": pujaris_tip,
        "bookings": bookings_tip,
        "virtual_puja": virtual_tip,
        "support": _qty(support_n, "open support ticket", "open support tickets") if support_n else "",
        "payments": payments_tip,
        "settlements": settlements_tip,
        "muhurtham": muhurtham_tip,
    }
    return {
        "pujaris": pujaris_n,
        "bookings": bookings_n,
        "virtual_puja": virtual_n,
        "support": support_n,
        "payments": payments_n,
        "settlements": settlements_n,
        "muhurtham": muhurtham_n,
        "customers": 0,
        "tooltips": tooltips,
    }
