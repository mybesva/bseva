"""Explore Services catalogue invariants used by the unified Puja/Chadhava/Pravachan UI."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from sqlalchemy import text

from app.catalog import EXPLORE_VISIBLE_SQL


def _norm(sql: str) -> str:
    return re.sub(r"\s+", " ", sql).replace("( ", "(").replace(" )", ")").strip()


def test_explore_visibility_predicate_matches_list_services():
    """Category counts must use the same visibility rule as GET /services."""
    src = (Path(__file__).resolve().parents[1] / "app" / "routers" / "bookings.py").read_text(encoding="utf-8")
    assert _norm(EXPLORE_VISIBLE_SQL) in _norm(src)


def _db():
    from app.db import SessionLocal

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        return db
    except Exception:  # pragma: no cover - environment dependent
        pytest.skip("database not reachable")


def test_category_service_count_matches_explore_visible_services():
    from app.catalog import list_categories_public

    db = _db()
    try:
        cats = list_categories_public(db)
        for cat in cats:
            expected = db.execute(
                text(
                    f"""
                    SELECT COUNT(*) FROM service_category_map m
                    JOIN services s ON s.id = m.service_id
                    WHERE m.category_id = :cid AND {EXPLORE_VISIBLE_SQL}
                    """
                ),
                {"cid": cat["id"]},
            ).scalar()
            assert int(cat["service_count"]) == int(expected), cat.get("slug")
    finally:
        db.close()


def test_category_count_does_not_change_service_visibility():
    """Counting awaiting-pricing services must not activate or alter any service row."""
    from app.catalog import list_categories_public

    db = _db()
    try:
        before = db.execute(text("SELECT COUNT(*) FILTER (WHERE active), COUNT(*) FROM services")).one()
        list_categories_public(db)
        after = db.execute(text("SELECT COUNT(*) FILTER (WHERE active), COUNT(*) FROM services")).one()
        assert tuple(before) == tuple(after)
    finally:
        db.close()
