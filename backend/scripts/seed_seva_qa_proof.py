#!/usr/bin/env python3
"""Seed one completed Seva registration with proof + prasad for web/mobile QA."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text

from app.db import SessionLocal


def main() -> int:
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                SELECT r.id, r.registration_number, e.title, e.id AS event_id
                FROM seva_event_registrations r
                JOIN seva_events e ON e.id = r.event_id
                WHERE r.customer_id = (SELECT id FROM users WHERE email = 'customer1@bseva.test' LIMIT 1)
                ORDER BY
                  CASE WHEN e.puja_event_kind = 'group_live' AND e.online_enabled THEN 0 ELSE 1 END,
                  r.created_at DESC
                LIMIT 1
                """
            )
        ).first()
        if row:
            db.execute(
                text(
                    """
                    UPDATE seva_events
                    SET start_at = NOW() - INTERVAL '10 minutes',
                        end_at = NOW() + INTERVAL '2 hours',
                        online_enabled = TRUE,
                        participation_mode = 'hybrid',
                        puja_event_kind = 'group_live',
                        meeting_url = 'https://meet.google.com/demo-seva-qa',
                        status = 'published',
                        updated_at = NOW()
                    WHERE id = CAST(:eid AS uuid)
                    """
                ),
                {"eid": str(row[3])},
            )
            db.execute(
                text(
                    """
                    UPDATE seva_event_registrations
                    SET participation_mode = 'online', updated_at = NOW()
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {"id": str(row[0])},
            )
        if not row:
            print("FAIL: no customer registration found")
            return 1
        reg_id = str(row[0])
        db.execute(
            text(
                """
                UPDATE seva_event_registrations
                SET status = 'completed',
                    proof_image_path = '/media/demo/seva-proof.jpg',
                    proof_released = TRUE,
                    prasad_status = 'shipped',
                    prasad_courier = 'Demo Courier',
                    prasad_tracking = 'DEMO-TRACK-001',
                    join_token = COALESCE(join_token, 'demo-join-token-seva-qa'),
                    updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": reg_id},
        )
        db.execute(
            text(
                """
                UPDATE seva_events e
                SET status = 'completed',
                    proof_image_path = '/media/demo/seva-proof.jpg',
                    proof_released = TRUE,
                    meeting_url = 'https://meet.google.com/demo-seva-qa',
                    updated_at = NOW()
                FROM seva_event_registrations r
                WHERE r.id = CAST(:id AS uuid) AND e.id = r.event_id
                """
            ),
            {"id": reg_id},
        )
        db.commit()
        print(f"PASS: seeded proof/prasad/join for registration {row[1]} ({row[2]})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
