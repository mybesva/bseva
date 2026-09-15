from app.routers.admin import _sql_order, _USER_SORT_COLUMNS, _PUJARI_SORT_COLUMNS


def test_sql_order_whitelist_ignores_unknown_columns():
    clause = _sql_order("drop table users", "desc", _USER_SORT_COLUMNS, "u.created_at")
    assert "drop table" not in clause.lower()
    assert clause.startswith("ORDER BY u.created_at DESC")


def test_sql_order_name_asc():
    clause = _sql_order("name", "asc", _USER_SORT_COLUMNS, "u.created_at")
    assert "LOWER(u.name) ASC" in clause


def test_sql_order_pujari_location():
    clause = _sql_order("location", "asc", _PUJARI_SORT_COLUMNS, "u.created_at")
    assert "ASC" in clause
    assert "location_label" in clause
    assert "p.city" in clause
