#!/usr/bin/env python3
"""Explore Services verification report (read-only).

Compares what the unified Explore Services UI renders against the database:
  - Puja pane == GET /services (all pages) filtered to service_type == puja
  - Chadhava / Pravachan panes are single-type
  - no accidental omissions, duplicates or wrong-type rows

Usage: python scripts/explore_services_verify.py [API_BASE]   (default http://localhost:8000/api/v1)
Exit code 1 when an invariant fails.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.catalog import EXPLORE_VISIBLE_SQL  # noqa: E402
from app.db import SessionLocal  # noqa: E402

API = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api/v1").rstrip("/")


def get(path: str, **params: str):
    qs = urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    url = f"{API}{path}" + (f"?{qs}" if qs else "")
    with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    failures: list[str] = []
    db = SessionLocal()
    try:
        stored = db.execute(text("SELECT service_type, COUNT(*) FROM services GROUP BY 1")).all()
        stored_by_type = {(r[0] or "puja"): int(r[1]) for r in stored}
        visible = db.execute(
            text(f"SELECT s.slug, COALESCE(s.service_type,'puja') FROM services s WHERE {EXPLORE_VISIBLE_SQL}")
        ).all()
        visible_puja_slugs = {r[0] for r in visible if r[1] == "puja"}
        stored_puja = stored_by_type.get("puja", 0)
    finally:
        db.close()

    all_rows = get("/services")
    puja_rows = [r for r in all_rows if (r.get("service_type") or "puja") == "puja"]
    other_rows = [r for r in all_rows if (r.get("service_type") or "puja") != "puja"]
    rendered_slugs = [r["slug"] for r in puja_rows]
    dupes = [s for s, n in Counter(rendered_slugs).items() if n > 1]
    omitted = sorted(visible_puja_slugs - set(rendered_slugs))
    unexpected = sorted(set(rendered_slugs) - visible_puja_slugs)

    print("== Puja Seva ==")
    print(f"stored Puja rows:            {stored_puja}")
    print(f"visible Puja (explore rule): {len(visible_puja_slugs)}")
    print(f"rendered in Puja tab:        {len(rendered_slugs)}")
    print(f"excluded from Puja tab (Chadhava/Pravachan leaked by /services): {len(other_rows)}")
    print(f"stored but not visible:      {stored_puja - len(visible_puja_slugs)}")
    print(f"omissions: {omitted}\nduplicates: {dupes}\nunexpected: {unexpected}")
    if omitted or dupes or unexpected:
        failures.append("Puja pane differs from visible Puja catalogue")

    # Search + category views must also be Puja-only after filtering and never leak other types.
    cats = get("/service-categories")
    for cat in cats:
        rows = get("/services", category=cat["slug"])
        pujas = [r for r in rows if (r.get("service_type") or "puja") == "puja"]
        if len(pujas) != len(rows):
            print(f"  category {cat['slug']}: /services returned {len(rows) - len(pujas)} non-Puja rows (filtered client-side)")
        print(f"  category {cat['slug']:<28} chip count={cat.get('service_count')} rendered={len(pujas)}")
        if int(cat.get("service_count") or 0) != len(rows):
            failures.append(f"category {cat['slug']} count {cat.get('service_count')} != listed {len(rows)}")
    popular = get("/services", category="popular")
    print(f"  popular rendered={len([r for r in popular if (r.get('service_type') or 'puja') == 'puja'])}")

    for stype in ("chadhava", "pravachan"):
        services = get("/seva/services", service_type=stype)
        events = get("/seva/events", service_type=stype)
        wrong_s = [s["slug"] for s in services if s.get("service_type") != stype]
        wrong_e = [e["id"] for e in events if e.get("service_type") not in (None, stype)]
        print(f"== {stype.capitalize()} Seva == services={len(services)} events={len(events)} "
              f"wrong-type services={wrong_s} wrong-type events={wrong_e}")
        modes = Counter((e.get("participation_mode") or "offline") for e in events)
        print(f"   event participation modes: {dict(modes)}")
        if wrong_s or wrong_e:
            failures.append(f"{stype} pane contains other types")

    print("\nRESULT:", "FAIL" if failures else "OK")
    for f in failures:
        print(" -", f)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
