from datetime import date

from app.pricing import festival_date_set, surge_amount_from_mode


def test_surge_percent_of_puja_base():
    assert surge_amount_from_mode(10_000_00, "percent", 10, 0) == 1_000_00
    assert surge_amount_from_mode(10_000_00, "percent", 0, 99_000) == 0


def test_surge_fixed_amount_ignores_percent():
    assert surge_amount_from_mode(10_000_00, "amount", 50, 200_00) == 200_00
    assert surge_amount_from_mode(10_000_00, "fixed", 50, 0) == 0


def test_festival_date_set_parses_lists_and_csv():
    assert "2026-10-20" in festival_date_set(["2026-10-20", "2026-11-01"])
    assert date(2026, 10, 20).isoformat() in festival_date_set("2026-10-20, 2026-11-01")
    assert festival_date_set([]) == set()
    assert "2026-01-14" not in festival_date_set(["2026-10-20"])
