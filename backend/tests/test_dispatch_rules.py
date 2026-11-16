import app.pujari_levels as levels
from app.domain import MAX_SERVICE_RADIUS_KM, SERVICE_RADIUS_KM, pujari_reach_km
from app.pujari_levels import dispatch_level_ok, dispatch_level_sql, filter_rows_for_required_level


def test_levels_are_not_used_when_sending_bookings():
    assert levels.DISPATCH_LEVEL_RULE_ENABLED is False
    rows = [{"id": n, "approved_level": n} for n in (None, 1, 2, 3, 4, 5, 6)]
    for required in (1, 2, 3, 4, 5, 6):
        assert filter_rows_for_required_level(rows, required) == rows
        assert dispatch_level_ok(1, required)
    assert dispatch_level_sql() == ""


def test_level_rule_comes_back_with_the_switch(monkeypatch):
    monkeypatch.setattr(levels, "DISPATCH_LEVEL_RULE_ENABLED", True)
    assert not dispatch_level_ok(2, 3)
    assert dispatch_level_ok(3, 3)
    assert not dispatch_level_ok(4, 5)
    assert ">= :lvl" in dispatch_level_sql()


def test_pujari_own_radius_is_used_without_a_10km_cap():
    assert pujari_reach_km(25) == 25
    assert pujari_reach_km(3) == 3
    # Not set → platform default; values above the form's 100 km limit are clamped.
    assert pujari_reach_km(None) == SERVICE_RADIUS_KM
    assert pujari_reach_km(0) == SERVICE_RADIUS_KM
    assert pujari_reach_km(500) == MAX_SERVICE_RADIUS_KM
