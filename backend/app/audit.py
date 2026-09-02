"""Audit helper for admin/financial/security actions."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def write_audit(
    db: Session,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    previous: Any = None,
    new: Any = None,
    reason: str | None = None,
) -> None:
    try:
        db.execute(
            text(
                """
                INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                VALUES (CAST(:a AS uuid), :act, :et, :eid)
                """
            ),
            {
                "a": actor_id,
                "act": action if not reason else f"{action}:{reason[:80]}",
                "et": entity_type,
                "eid": entity_id,
            },
        )
    except Exception:
        # Never break primary transaction for audit failure in edge cases
        pass
