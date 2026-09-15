from datetime import date

from app.routers.reports import _pct_change, period_bounds


def test_period_bounds_default_last_30_days():
    start, end, label = period_bounds("last_30_days", today=date(2026, 9, 15))
    assert end == date(2026, 9, 15)
    assert start == date(2026, 8, 17)
    assert label == "Last 30 days"


def test_period_bounds_custom_swaps_if_reversed():
    start, end, _ = period_bounds("custom", "2026-09-20", "2026-09-01")
    assert start == date(2026, 9, 1)
    assert end == date(2026, 9, 20)


def test_pct_change():
    assert _pct_change(110, 100) == 10.0
    assert _pct_change(0, 0) == 0.0
    assert _pct_change(50, 0) == 100.0
