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
    assert _pct_change(50, 0) is None


def test_payday_counts_from_joining_date():
    from app.settlement_cycle import next_payday

    joined = date(2026, 10, 1)  # paydays: 4th, 7th, 10th ...
    assert next_payday(joined, date(2026, 10, 2), 3) == date(2026, 10, 4)
    assert next_payday(joined, date(2026, 10, 3), 3) == date(2026, 10, 4)
    assert next_payday(joined, date(2026, 10, 5), 3) == date(2026, 10, 7)


def test_completing_on_a_payday_waits_for_the_next_one():
    from app.settlement_cycle import next_payday

    assert next_payday(date(2026, 10, 1), date(2026, 10, 4), 3) == date(2026, 10, 7)
    assert next_payday(date(2026, 10, 1), date(2026, 10, 1), 3) == date(2026, 10, 4)


def test_different_pujaris_have_their_own_paydays():
    from app.settlement_cycle import next_payday

    after = date(2026, 10, 10)
    assert next_payday(date(2026, 10, 1), after, 3) == date(2026, 10, 13)
    assert next_payday(date(2026, 10, 2), after, 3) == date(2026, 10, 11)
    assert next_payday(date(2026, 10, 3), after, 3) == date(2026, 10, 12)


def test_payday_follows_the_configured_cycle_and_never_lands_early():
    from datetime import timedelta

    from app.settlement_cycle import next_payday

    joined = date(2026, 1, 1)
    for every in (1, 3, 7, 14):
        for offset in range(40):
            after = joined + timedelta(days=offset)
            due = next_payday(joined, after, every)
            assert 0 < (due - after).days <= every and (due - joined).days % every == 0
