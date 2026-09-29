"""Development demo records for Seva expansion QA (not run in migrations)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session


def seed_seva_demo(db: Session) -> dict:
    """Insert demo services/events if none exist. Safe for dev/staging only."""
    existing = db.execute(text("SELECT COUNT(*) FROM seva_events")).scalar() or 0
    if int(existing) > 0:
        return {"skipped": True, "reason": "events already exist"}

    def ensure_service(name: str, slug: str, stype: str, price: int) -> str:
        row = db.execute(text("SELECT id FROM services WHERE slug = :slug"), {"slug": slug}).first()
        if row:
            return str(row[0])
        sid = str(uuid4())
        db.execute(
            text(
                """
                INSERT INTO services (
                  id, name, slug, service_type, category, required_level,
                  standard_price_paise, main_puja_price_paise, duration_minutes, active, pricing_status
                ) VALUES (
                  CAST(:id AS uuid), :name, :slug, :stype, :cat, 1,
                  :price, :price, 90, TRUE, 'priced'
                )
                """
            ),
            {"id": sid, "name": name, "slug": slug, "stype": stype, "cat": stype, "price": price},
        )
        return sid

    now = datetime.now(timezone.utc)
    group_sid = ensure_service("Rudrabhishek Group", "rudrabhishek-group", "puja", 150000)
    chadhava_sid = ensure_service("Temple Flower Offering", "temple-flowers", "chadhava", 50000)
    prav_sid = ensure_service("Bhagavad Gita Pravachan", "gita-pravachan", "pravachan", 0)

    demos = [
        (group_sid, "puja", "group_live", "hybrid", "Kashi Rudrabhishek — Group Live", 150000, False),
        (group_sid, "puja", "proxy", "offline", "Kashi Rudrabhishek — Proxy", 99000, False),
        (chadhava_sid, "chadhava", None, "offline", "Monday Shiva Chadhava", 50000, False),
        (prav_sid, "pravachan", None, "offline", "Hyderabad Gita Pravachan", 0, True),
        (prav_sid, "pravachan", None, "online", "Online Gita Pravachan", 0, True),
        (prav_sid, "pravachan", None, "hybrid", "Hybrid Gita Pravachan", 25000, False),
    ]
    created = []
    for i, (sid, stype, pkind, pmode, title, price, free) in enumerate(demos):
        eid = str(uuid4())
        start = now + timedelta(days=i + 1, hours=7)
        db.execute(
            text(
                """
                INSERT INTO seva_events (
                  id, service_id, title, start_at, end_at, booking_cutoff_at, capacity,
                  status, participation_mode, puja_event_kind, is_free, price_paise,
                  online_enabled, published
                ) VALUES (
                  CAST(:id AS uuid), CAST(:sid AS uuid), :title, :start, :end, :cutoff, :cap,
                  'published', :pmode, :pkind, :free, :price,
                  :online, TRUE
                )
                """
            ),
            {
                "id": eid,
                "sid": sid,
                "title": title,
                "start": start.isoformat(),
                "end": (start + timedelta(hours=2)).isoformat(),
                "cutoff": (start - timedelta(hours=6)).isoformat(),
                "cap": 100 if pkind == "group_live" else 50,
                "pmode": pmode,
                "pkind": pkind,
                "free": free,
                "price": 0 if free else price,
                "online": pmode in ("online", "hybrid"),
            },
        )
        created.append(eid)
    db.commit()
    return {"created_events": len(created), "event_ids": created}
