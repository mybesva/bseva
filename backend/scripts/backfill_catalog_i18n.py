"""Backfill stored six-language service/category translations.

Run after applying schema migrations:
    cd backend && python scripts/backfill_catalog_i18n.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.catalog_i18n_seed import ensure_catalog_translations  # noqa: E402
from app.db import engine  # noqa: E402


def main() -> None:
    with engine.begin() as conn:
        result = ensure_catalog_translations(conn)
    print(
        f"Catalog translations upserted: services={result['services']}, "
        f"categories={result['categories']}"
    )


if __name__ == "__main__":
    main()
