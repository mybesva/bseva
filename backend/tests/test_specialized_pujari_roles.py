"""Level 1–4 eligibility stays on the old comparison. Levels 5 and 6 are exact-match only."""

from pathlib import Path

from app.pujari_levels import (
    CHAVA_SEVA_CODE,
    CHAVA_SEVA_LEVEL,
    PRAVACHANA_SEVA_CODE,
    PRAVACHANA_SEVA_LEVEL,
    SPECIALIZED_ROLE_SEEDS,
    filter_rows_for_required_level,
    hierarchy_level_eligible,
    pujari_meets_required_level,
)


def _legacy_hierarchy(approved, required) -> bool:
    """The Level 1–4 check that shipped before specialized roles: approved must be set and >= required."""
    if not approved or int(approved) < int(required):
        return False
    return True


def test_levels_1_to_4_match_existing_hierarchy():
    for approved in (1, 2, 3, 4):
        for required in (1, 2, 3, 4):
            assert pujari_meets_required_level(approved, required) == _legacy_hierarchy(approved, required)
            assert hierarchy_level_eligible(approved, required) == _legacy_hierarchy(approved, required)


def test_existing_level_bookings_still_assign_the_same_providers():
    providers = [1, 2, 3, 4]
    for required in providers:
        matched = [level for level in providers if pujari_meets_required_level(level, required)]
        assert matched == [level for level in providers if level >= required]


def test_specialized_roles_are_level_5_and_6_with_stable_codes():
    by_level = {role["level"]: role for role in SPECIALIZED_ROLE_SEEDS}
    assert set(by_level) == {5, 6}
    assert by_level[CHAVA_SEVA_LEVEL]["code"] == CHAVA_SEVA_CODE == "chava_seva"
    assert by_level[CHAVA_SEVA_LEVEL]["title"] == "Chava Seva"
    assert by_level[PRAVACHANA_SEVA_LEVEL]["code"] == PRAVACHANA_SEVA_CODE == "pravachana_seva"
    assert by_level[PRAVACHANA_SEVA_LEVEL]["title"] == "Pravachana Seva"
    assert all(role["level"] > 4 for role in SPECIALIZED_ROLE_SEEDS)


def test_chava_booking_delegates_only_to_level_5():
    assert pujari_meets_required_level(5, 5)
    assert not pujari_meets_required_level(6, 5)
    assert not pujari_meets_required_level(4, 5)
    assert not pujari_meets_required_level(1, 5)


def test_pravachana_booking_delegates_only_to_level_6():
    assert pujari_meets_required_level(6, 6)
    assert not pujari_meets_required_level(5, 6)
    assert not pujari_meets_required_level(4, 6)
    assert not pujari_meets_required_level(2, 6)


def test_specialized_providers_do_not_gain_level_1_to_4_services():
    for required in (1, 2, 3, 4):
        assert not pujari_meets_required_level(5, required)
        assert not pujari_meets_required_level(6, required)


def test_backend_rejects_cross_specialized_assignment():
    assert not pujari_meets_required_level(6, 5)
    assert not pujari_meets_required_level(5, 6)


def test_admin_assignment_filter_keeps_only_matching_specialized_providers():
    rows = [{"id": n, "approved_level": n} for n in (1, 2, 3, 4, 5, 6)]
    chava = filter_rows_for_required_level(rows, 5)
    pravachana = filter_rows_for_required_level(rows, 6)
    assert [row["approved_level"] for row in chava] == [5]
    assert [row["approved_level"] for row in pravachana] == [6]
    for required in (1, 2, 3, 4):
        kept = [row["approved_level"] for row in filter_rows_for_required_level(rows, required)]
        assert kept == [level for level in (1, 2, 3, 4) if level >= required]


def test_available_jobs_and_notifications_follow_the_same_predicate():
    """Offer invites and job lists use filter_rows_for_required_level on the existing lookup."""
    recipients = lambda required: [
        level for level in (1, 2, 3, 4, 5, 6) if pujari_meets_required_level(level, required)
    ]
    assert recipients(5) == [5]
    assert recipients(6) == [6]
    assert recipients(1) == [1, 2, 3, 4]
    assert recipients(4) == [4]
    assert 5 not in recipients(2)
    assert 6 not in recipients(3)


def test_migration_does_not_rewrite_existing_roles():
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase/migrations/021_specialized_pujari_roles.sql").read_text(encoding="utf-8")
    assert "WHERE NOT EXISTS" in sql
    assert "UPDATE pujari_roles" not in sql
    assert "DELETE FROM pujari_roles" not in sql
    assert "chava_seva" in sql
    assert "pravachana_seva" in sql
    seed = (root / "backend/app/schema_migrate.py").read_text(encoding="utf-8")
    assert "WHERE NOT EXISTS" in seed
    assert "_DEFAULT_PUJARI_ROLES" in seed


def test_role_labels_exist_in_every_app_language():
    root = Path(__file__).resolve().parents[2]
    locales = root / "packages/locales/src/resources"
    files = {
        "en": locales / "en.ts",
        "hi": locales / "hi.ts",
        "te": locales / "te.ts",
        "mr": locales / "mr.ts",
        "ta": locales / "ta.ts",
        "kn": locales / "kn.ts",
        "ml": locales / "mlCatalog.ts",
    }
    for lang, path in files.items():
        text = path.read_text(encoding="utf-8")
        assert '"pujari.level.l5"' in text, lang
        assert '"pujari.level.l6"' in text, lang
        assert '"pujari.level.l1"' in text, lang
        assert '"pujari.level.l4"' in text, lang
