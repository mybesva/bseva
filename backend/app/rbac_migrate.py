"""One-time Admin RBAC v2 migration (idempotent; safe to run repeatedly).

Before v2, an admin with no admin_permissions rows silently received a default set, and the
catalogue mixed operational and Super-Admin-only keys. v2:
  1. materialises the old default set for admins that had no rows (so nobody loses access),
  2. expands pre-v2 keys into the finer v2 keys (manage_services -> temples/services/... etc.),
  3. removes Super-Admin-only keys (manage_settlements, view_reports, manage_config,
     manage_admins) from role=admin rows — they were never meant to be effective for admins,
  4. records the marker; from then on "no rows" means "no permissions".

Run:  cd backend && python -c "from app.rbac_migrate import ensure_rbac_v2; ensure_rbac_v2()"
(also invoked from schema_migrate.ensure_schema()).
"""
from __future__ import annotations

from sqlalchemy import text

from app.db import engine
from app.rbac import (
    ADMIN_ASSIGNABLE,
    LEGACY_DEFAULT_ADMIN,
    RBAC_V2_MARKER,
    SUPER_ADMIN_ONLY,
    expand_legacy,
)


def ensure_rbac_v2(*, quiet: bool = False) -> dict:
    report = {"admins": 0, "materialised_defaults": 0, "rows_added": 0, "super_only_removed": 0, "skipped": False}
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS rbac_migrations (key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), details JSONB)"
        ))
        if conn.execute(text("SELECT 1 FROM rbac_migrations WHERE key = :k"), {"k": RBAC_V2_MARKER}).first():
            report["skipped"] = True
            if not quiet:
                print("[rbac] v2 already applied")
            return report

        admins = conn.execute(text("SELECT id FROM users WHERE role = 'admin'")).fetchall()
        report["admins"] = len(admins)
        for (uid,) in admins:
            current = [r[0] for r in conn.execute(
                text("SELECT permission FROM admin_permissions WHERE user_id = :u"), {"u": uid}
            ).fetchall()]
            if not current:
                report["materialised_defaults"] += 1
            target = expand_legacy(current or LEGACY_DEFAULT_ADMIN)
            for p in target:
                if p in current:
                    continue
                conn.execute(
                    text(
                        "INSERT INTO admin_permissions (user_id, permission) VALUES (:u, :p) "
                        "ON CONFLICT (user_id, permission) DO NOTHING"
                    ),
                    {"u": uid, "p": p},
                )
                report["rows_added"] += 1
            stale = [p for p in current if p not in ADMIN_ASSIGNABLE]
            if stale:
                conn.execute(
                    text("DELETE FROM admin_permissions WHERE user_id = :u AND permission = ANY(:ps)"),
                    {"u": uid, "ps": stale},
                )
                report["super_only_removed"] += sum(1 for p in stale if p in SUPER_ADMIN_ONLY)

        conn.execute(
            text("INSERT INTO rbac_migrations (key, details) VALUES (:k, CAST(:d AS jsonb))"),
            {"k": RBAC_V2_MARKER, "d": __import__("json").dumps(report)},
        )
    if not quiet:
        print(f"[rbac] v2 applied: {report}")
    return report


if __name__ == "__main__":
    ensure_rbac_v2()
