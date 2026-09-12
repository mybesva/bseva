#!/usr/bin/env python3
"""One-shot: rename demo pujari 'Pandit Reddy' -> 'Pandit' and normalize mobile."""
from __future__ import annotations

from pathlib import Path

try:
    import psycopg2
except ImportError:
    raise SystemExit("Install psycopg2-binary first: pip install psycopg2-binary")


def database_url() -> str:
    root = Path(__file__).resolve().parents[1]
    for candidate in (root / ".env", root / "backend" / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            s = line.strip()
            if s.startswith("DATABASE_URL=") and not s.startswith("#"):
                return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL missing from .env")


def main() -> None:
    url = database_url()
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET name = 'Pandit'
        WHERE name ILIKE %s OR email = %s
        RETURNING id::text, name, email, role
        """,
        ("%Reddy%", "pujari2@bseva.test"),
    )
    rows = cur.fetchall()
    if not rows:
        print("users: no matching rows (already updated?)")
    else:
        for r in rows:
            print("users updated:", r)

    cur.execute(
        """
        UPDATE pujari_profiles pp
        SET full_name = 'Pandit',
            mobile_number = CASE
              WHEN length(regexp_replace(COALESCE(pp.mobile_number, u.phone, ''), '\\D', '', 'g')) >= 10
                THEN right(regexp_replace(COALESCE(pp.mobile_number, u.phone, ''), '\\D', '', 'g'), 10)
              ELSE regexp_replace(COALESCE(pp.mobile_number, u.phone, ''), '\\D', '', 'g')
            END
        FROM users u
        WHERE pp.user_id = u.id
          AND (pp.full_name ILIKE %s OR lower(u.email) = 'pujari2@bseva.test')
        RETURNING pp.user_id::text, pp.full_name, pp.mobile_number
        """,
        ("%Reddy%",),
    )
    for r in cur.fetchall():
        print("profile updated:", r)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
