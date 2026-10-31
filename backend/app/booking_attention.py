"""Admin booking queues: every puja booking belongs to exactly one queue."""
from sqlalchemy import text
from sqlalchemy.orm import Session

_TODAY = "(NOW() AT TIME ZONE 'Asia/Kolkata')::date"
_IS_PUJA = "COALESCE(b.booking_kind, 'puja') = 'puja'"
_UNRESOLVED = """(
  b.status IN ('pending', 'pending_acceptance')
  OR (b.status = 'confirmed' AND b.pujari_id IS NULL)
  OR (b.status = 'rejected' AND COALESCE(b.needs_reassignment, FALSE) = TRUE)
)"""
# A pujari has been asked and can still answer: assigned, or holding an open offer.
_PUJARI_ASKED = """(
  b.status IN ('pending', 'pending_acceptance')
  AND (
    b.pujari_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM booking_pujari_offers o
      WHERE o.booking_id = b.id AND o.status = 'invited'
    )
  )
)"""

_CONFIRMED = "(b.status = 'confirmed' AND b.pujari_id IS NOT NULL)"

# Dict order is the order the dashboard shows them in.
BOOKING_QUEUES: dict[str, str] = {
    "needs_assignment": f"({_UNRESOLVED} AND b.booking_date >= {_TODAY} AND NOT {_PUJARI_ASKED})",
    "waiting_pujari": f"({_UNRESOLVED} AND b.booking_date >= {_TODAY} AND {_PUJARI_ASKED})",
    "confirmed_upcoming": f"({_CONFIRMED} AND b.booking_date >= {_TODAY})",
    "puja_in_progress": "(b.status = 'in_progress')",
    "puja_completed": "(b.status = 'completed')",
    "puja_closed": "(b.status = 'cancelled' OR (b.status = 'rejected' AND COALESCE(b.needs_reassignment, FALSE) = FALSE))",
    "date_passed": f"({_UNRESOLVED} AND b.booking_date < {_TODAY})",
    "not_completed": f"({_CONFIRMED} AND b.booking_date < {_TODAY})",
}


def booking_queue_counts(db: Session) -> dict[str, int]:
    from app.booking_offers import ensure_offers_table

    ensure_offers_table(db)
    columns = ", ".join(f"COUNT(*) FILTER (WHERE {sql}) AS {name}" for name, sql in BOOKING_QUEUES.items())
    row = db.execute(text(f"SELECT {columns} FROM bookings b WHERE {_IS_PUJA}")).mappings().first()
    return {name: int(row[name] or 0) for name in BOOKING_QUEUES}


def mark_open_offers(db: Session, items: list[dict]) -> None:
    """Set has_open_offer on admin list rows so screens can tell who has actually been asked."""
    from app.booking_offers import ensure_offers_table

    ensure_offers_table(db)
    ids = [str(item["id"]) for item in items]
    open_ids = {
        str(row[0])
        for row in db.execute(
            text(
                """
                SELECT DISTINCT booking_id FROM booking_pujari_offers
                WHERE status = 'invited' AND booking_id = ANY(CAST(:ids AS uuid[]))
                """
            ),
            {"ids": ids},
        )
    }
    for item in items:
        item["has_open_offer"] = str(item["id"]) in open_ids
