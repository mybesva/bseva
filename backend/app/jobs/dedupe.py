"""Once-only claims for side effects of scheduled jobs (emails, pushes) — migration 025.

`claim_once(session, key)` inserts the key inside the caller's transaction. Concurrent runs block on
the primary key until the first commits, then see the conflict, so exactly one run sends. If the
caller's transaction rolls back, the claim rolls back with it and the next run retries.
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger("bseva.jobs")


def claim_once(session: Session, key: str) -> bool:
    try:
        with session.begin_nested():
            row = session.execute(
                text("INSERT INTO job_dedupe (key) VALUES (:k) ON CONFLICT (key) DO NOTHING RETURNING key"),
                {"k": key},
            ).first()
    except SQLAlchemyError:
        # Table not created yet (migration 025 not applied): keep the previous behaviour (send).
        logger.error("JOB_DEDUPE_UNAVAILABLE key_prefix=%s (apply supabase/migrations/025)", key.split(":", 1)[0])
        return True
    return row is not None
