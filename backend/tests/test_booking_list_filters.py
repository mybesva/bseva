from datetime import date

from app.routers.bookings import admin_booking_filters


def test_physical_mode_excludes_virtual():
    sql, params = admin_booking_filters(mode="physical")
    assert "virtual" in sql
    assert params == {}


def test_status_and_unassigned():
    sql, params = admin_booking_filters(status="pending_acceptance", assignment="unassigned")
    assert "b.status = :status" in sql
    assert "pujari_id IS NULL" in sql
    assert params["status"] == "pending_acceptance"


def test_date_range_and_search():
    sql, params = admin_booking_filters(
        q="ganapathi",
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert "booking_date >= :date_from" in sql
    assert "booking_date <= :date_to" in sql
    assert "booking_number ILIKE :q" in sql
    assert params["date_from"] == date(2026, 9, 1)
    assert params["q"] == "%ganapathi%"


def test_payment_status_filter():
    sql, params = admin_booking_filters(payment_status="failed")
    assert "payment_status" in sql
    assert params["payment_status"] == "failed"
    sql, _ = admin_booking_filters(status="needs_reassignment")
    assert "needs_reassignment" in sql
    assert "rejected" in sql
