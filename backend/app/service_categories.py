"""Helpers for service category business rules."""
from sqlalchemy import text
from sqlalchemy.orm import Session

DEATH_CATEGORY_SLUGS = (
    "death-ancestor",
    "death",
    "death_anniversary",
    "antyeshti",
    "shraddha-death-anniversary",
)


def service_is_death_related(db: Session, service_id: str) -> bool:
    slugs_sql = ", ".join(f"'{s}'" for s in DEATH_CATEGORY_SLUGS)
    row = db.execute(
        text(
            f"""
            SELECT 1 FROM service_category_map m
            JOIN service_categories c ON c.id = m.category_id
            WHERE m.service_id = CAST(:sid AS uuid)
              AND (
                c.slug IN ({slugs_sql})
                OR c.slug ILIKE '%death%'
                OR c.slug ILIKE '%shraddha%'
              )
            LIMIT 1
            """
        ),
        {"sid": str(service_id)},
    ).first()
    if row:
        return True
    legacy = db.execute(
        text(
            """
            SELECT category FROM services
            WHERE id = CAST(:sid AS uuid)
              AND category IS NOT NULL
              AND (
                lower(category) LIKE '%death%'
                OR lower(category) IN ('death_anniversary', 'antyeshti')
              )
            LIMIT 1
            """
        ),
        {"sid": str(service_id)},
    ).first()
    return legacy is not None
