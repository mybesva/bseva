#!/usr/bin/env python3
"""Copy B-Seva *reference* data (catalog, pricing, translations, settings) from one database to another.

Never copies people, bookings, money, KYC, notifications or audit data: only the tables in TABLES, with the
personal or internal columns in SCRUB replaced. Rows are matched on natural keys (slug, item_key, code, ...),
so the target keeps its own IDs and every existing booking or invoice keeps pointing at the same service.

  export  --source-env FILE --out ref.json   read-only session on the source; writes sanitized JSON
  import  --in ref.json [--apply]           upserts into DATABASE_URL (dry run unless --apply); refuses production
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# (table, natural key columns, foreign keys to remap {column: referenced table})
TABLES: list[tuple[str, tuple[str, ...], dict[str, str]]] = [
    ("service_categories", ("slug",), {}),
    ("services", ("slug",), {}),
    ("samagri_items", ("item_key",), {}),
    ("service_category_map", ("service_id", "category_id"), {"service_id": "services", "category_id": "service_categories"}),
    ("category_translations", ("category_id", "language_code"), {"category_id": "service_categories"}),
    ("service_translations", ("service_id", "language_code"), {"service_id": "services"}),
    ("service_slug_aliases", ("alias_slug",), {"service_id": "services"}),
    ("service_samagri", ("service_id", "samagri_item_id"), {"service_id": "services", "samagri_item_id": "samagri_items"}),
    ("samagri_item_translations", ("samagri_item_id", "language_code"), {"samagri_item_id": "samagri_items"}),
    ("service_preparation_content", ("service_id", "language_code"), {"service_id": "services"}),
    ("service_recommendations", ("service_id", "title"), {"service_id": "services"}),
    ("location_prices", ("id",), {"service_id": "services"}),
    ("surge_rules", ("id",), {"service_id": "services"}),
    ("platform_settings", ("key",), {}),
    ("pricing_config", ("id",), {}),
    ("legal_policies", ("slug",), {}),
    ("legal_policy_translations", ("policy_id", "language_code"), {"policy_id": "legal_policies"}),
    ("pujari_roles", ("level",), {}),
    ("reward_campaigns", ("code",), {}),
    ("temples", ("id",), {}),
    ("promo_banners", ("id",), {}),
]
# Columns that may hold personal or internal data in the source: replaced on export.
SCRUB = {
    "services": {"admin_notes": None},
    "platform_settings": {"updated_by": None},
    "temples": {"contact_phone": "9000000100", "contact_email": "temple@bseva.test", "pujari_name": "Temple Pujari"},
}


def _dsn_from_env_file(path: str) -> str:
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("DATABASE_URL=") and not s.startswith("#"):
            return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"DATABASE_URL not found in {path}")


def export(source_env: str, out: str) -> None:
    import psycopg

    data: dict[str, list] = {}
    with psycopg.connect(_dsn_from_env_file(source_env), options="-c default_transaction_read_only=on") as c:
        c.execute("SET TRANSACTION READ ONLY")
        assert c.execute("SHOW transaction_read_only").fetchone()[0] == "on"
        for table, _key, _fks in TABLES:
            if c.execute("SELECT to_regclass(%s)", (f"public.{table}",)).fetchone()[0] is None:
                continue
            rows = [r[0] for r in c.execute(f'SELECT to_jsonb(t) FROM public."{table}" t')]
            for r in rows:
                r.update(SCRUB.get(table, {}))
            data[table] = rows
    Path(out).write_text(json.dumps(data, default=str), encoding="utf-8")
    os.chmod(out, 0o600)
    print(json.dumps({t: len(v) for t, v in data.items()}))


def _columns(cur, table: str) -> dict[str, str]:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (table,))
    return {r[0]: r[1] for r in cur.fetchall()}


def _pk(cur, table: str) -> list[str]:
    cur.execute("""SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum = ANY(i.indkey)
                   WHERE i.indrelid = %s::regclass AND i.indisprimary""", (f"public.{table}",))
    return [r[0] for r in cur.fetchall()]


def import_(path: str, apply: bool) -> None:
    import psycopg

    if (os.environ.get("ENVIRONMENT") or "").strip().lower() == "production":
        raise SystemExit("Refusing: reference import is for QA/development targets only")
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    idmap: dict[str, dict[str, str]] = {}
    report = {}
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        for table, key, fks in TABLES:
            rows = data.get(table)
            if rows is None:
                continue
            cols = _columns(cur, table)
            pk = _pk(cur, table)
            idmap[table] = {}
            ins = upd = skipped = 0
            for src in rows:
                rec = {k: v for k, v in src.items() if k in cols}
                for col, ref in fks.items():
                    if rec.get(col) is not None:
                        rec[col] = idmap.get(ref, {}).get(str(rec[col]), rec[col])
                if any(rec.get(k) is None for k in key):
                    skipped += 1
                    continue
                where = " AND ".join(f'"{k}" = %s' for k in key)
                select_cols = ", ".join(f'"{c}"' for c in (pk or key))
                cur.execute(f'SELECT {select_cols} FROM public."{table}" WHERE {where}', [rec[k] for k in key])
                existing = cur.fetchone()
                if existing and pk == ["id"] and "id" in rec:
                    idmap[table][str(src["id"])] = str(existing[0])
                    rec["id"] = existing[0]
                elif "id" in rec:
                    idmap[table][str(src["id"])] = str(rec["id"])
                names = list(rec)
                conflict = ", ".join(f'"{c}"' for c in (pk or key))
                updates = [c for c in names if c not in (pk or key)]
                set_sql = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in updates) or None
                sql = (f'INSERT INTO public."{table}" ({", ".join(chr(34) + n + chr(34) for n in names)}) '
                       f'SELECT {", ".join("r." + chr(34) + n + chr(34) for n in names)} '
                       f'FROM jsonb_populate_record(NULL::public."{table}", %s::jsonb) r '
                       f'ON CONFLICT ({conflict}) ' + (f"DO UPDATE SET {set_sql}" if set_sql else "DO NOTHING"))
                cur.execute(sql, [json.dumps(rec, default=str)])
                if existing:
                    upd += 1
                else:
                    ins += 1
            report[table] = {"source": len(rows), "inserted": ins, "updated": upd, "skipped": skipped}
        if apply:
            conn.commit()
        else:
            conn.rollback()
    print(json.dumps({"applied": apply, "tables": report}, indent=1))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export"); e.add_argument("--source-env", required=True); e.add_argument("--out", required=True)
    i = sub.add_parser("import"); i.add_argument("--in", dest="inp", required=True); i.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    if a.cmd == "export":
        export(a.source_env, a.out)
    else:
        import_(a.inp, a.apply)
    return 0


if __name__ == "__main__":
    sys.exit(main())
