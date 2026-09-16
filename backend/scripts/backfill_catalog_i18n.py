"""Backfill stored six-language service/category translations.

Run after applying schema migrations:
    cd backend && python scripts/backfill_catalog_i18n.py
"""
from app.catalog_i18n_seed import ensure_catalog_translations
from app.db import engine


def main() -> None:
    with engine.begin() as conn:
        result = ensure_catalog_translations(conn)
    print(
        f"Catalog translations upserted: services={result['services']}, "
        f"categories={result['categories']}"
    )


if __name__ == "__main__":
    main()
