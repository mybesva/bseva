"""Level 1–4 hierarchy stays as it is. Levels 5 and 6 are exact-match roles beside it.

Stable identifiers:
  5 → chava_seva
  6 → pravachana_seva

Do not match these roles by service display name.
"""
from __future__ import annotations

HIERARCHY_LEVEL_MIN = 1
HIERARCHY_LEVEL_MAX = 4
CHAVA_SEVA_LEVEL = 5
CHAVA_SEVA_CODE = "chava_seva"
PRAVACHANA_SEVA_LEVEL = 6
PRAVACHANA_SEVA_CODE = "pravachana_seva"
MAX_ASSIGNABLE_LEVEL = 6

SPECIALIZED_ROLE_CODES = {
    CHAVA_SEVA_LEVEL: CHAVA_SEVA_CODE,
    PRAVACHANA_SEVA_LEVEL: PRAVACHANA_SEVA_CODE,
}

SPECIALIZED_ROLE_SEEDS = (
    {
        "level": CHAVA_SEVA_LEVEL,
        "code": CHAVA_SEVA_CODE,
        "title": "Chava Seva",
        "summary": "Specialized Chava Seva. Eligible only for Chava Seva services configured by Admin.",
        "examples": ["Chava Seva"],
    },
    {
        "level": PRAVACHANA_SEVA_LEVEL,
        "code": PRAVACHANA_SEVA_CODE,
        "title": "Pravachana Seva",
        "summary": "Specialized Pravachana Seva. Eligible only for Pravachana Seva services configured by Admin.",
        "examples": ["Pravachana Seva"],
    },
)


def _as_int(value) -> int:
    try:
        if value is None or value == "":
            return 0
        return int(value)
    except (TypeError, ValueError):
        return 0


def is_hierarchy_level(level) -> bool:
    n = _as_int(level)
    return HIERARCHY_LEVEL_MIN <= n <= HIERARCHY_LEVEL_MAX


def is_specialized_level(level) -> bool:
    return _as_int(level) in SPECIALIZED_ROLE_CODES


def hierarchy_level_eligible(approved_level, required_level) -> bool:
    """Existing Level 1–4 rule: an approved level must be set and at least the required level."""
    approved = _as_int(approved_level)
    required = _as_int(required_level) or 1
    if not approved or approved < required:
        return False
    return True


def specialized_role_eligible(approved_level, required_level) -> bool:
    """Chava matches only Chava. Pravachana matches only Pravachana."""
    approved = _as_int(approved_level)
    required = _as_int(required_level)
    if approved not in SPECIALIZED_ROLE_CODES or required not in SPECIALIZED_ROLE_CODES:
        return False
    return approved == required


def pujari_meets_required_level(approved_level, required_level) -> bool:
    """Dispatch: Level 1–4 keeps hierarchy_level_eligible; Levels 5 and 6 match exactly."""
    if is_specialized_level(approved_level) or is_specialized_level(required_level):
        return specialized_role_eligible(approved_level, required_level)
    return hierarchy_level_eligible(approved_level, required_level)


def filter_rows_for_required_level(rows, required_level):
    """Drop specialized providers from Level 1–4 results, and keep exact matches for Levels 5 and 6.

    The underlying Level 1–4 query (`approved_level >= required`) is left in place.
    This filter only removes rows that the hierarchy comparison would otherwise accept
    because 5 and 6 are numerically greater.
    """
    return [row for row in rows if pujari_meets_required_level(row.get("approved_level"), required_level)]
