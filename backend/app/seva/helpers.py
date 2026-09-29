from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import row_dict
from app.platform_config import get_setting


def seva_enabled(db: Session | None) -> bool:
    if db is None:
        return True
    return bool(get_setting(db, "seva_events_enabled", True))


def chadhava_enabled(db: Session | None) -> bool:
    if db is None:
        return True
    return bool(get_setting(db, "chadhava_enabled", True))


def pravachan_enabled(db: Session | None) -> bool:
    if db is None:
        return True
    return bool(get_setting(db, "pravachan_enabled", True))


def service_type_enabled(db: Session | None, service_type: str | None) -> bool:
    st = str(service_type or "puja")
    if st == "chadhava" and not chadhava_enabled(db):
        return False
    if st == "pravachan" and not pravachan_enabled(db):
        return False
    return True


def _event_select_sql() -> str:
    return """
        SELECT e.*,
               s.name AS service_name,
               s.slug AS service_slug,
               s.service_type,
               s.image_path AS service_image_path,
               s.image_url AS service_image_url,
               u.name AS pujari_name,
               t.name AS temple_name,
               t.city AS temple_city,
               t.address AS temple_address,
               t.state AS temple_state
        FROM seva_events e
        JOIN services s ON s.id = e.service_id
        LEFT JOIN users u ON u.id = e.assigned_pujari_id
        LEFT JOIN temples t ON t.id = e.temple_id
    """


def enrich_event(row: dict[str, Any]) -> dict[str, Any]:
    data = row_dict(row)
    cap = data.get("capacity")
    count = int(data.get("registration_count") or 0)
    data["seats_remaining"] = None if cap is None else max(0, int(cap) - count)
    data["sold_out"] = cap is not None and count >= int(cap)
    now = datetime.now(timezone.utc)
    start = data.get("start_at")
    end = data.get("end_at")
    try:
        start_dt = datetime.fromisoformat(str(start).replace("Z", "+00:00")) if start else None
        end_dt = datetime.fromisoformat(str(end).replace("Z", "+00:00")) if end else None
    except Exception:
        start_dt = end_dt = None
    if data.get("status") == "live":
        data["display_status"] = "live"
    elif data.get("status") == "completed":
        data["display_status"] = "completed"
    elif data.get("status") == "cancelled":
        data["display_status"] = "cancelled"
    elif start_dt and start_dt <= now and (not end_dt or end_dt >= now):
        data["display_status"] = "live"
    elif start_dt and start_dt > now:
        data["display_status"] = "upcoming"
    else:
        data["display_status"] = data.get("status") or "upcoming"
    cutoff = data.get("booking_cutoff_at")
    try:
        cutoff_dt = datetime.fromisoformat(str(cutoff).replace("Z", "+00:00")) if cutoff else None
    except Exception:
        cutoff_dt = None
    data["registration_open"] = (
        bool(data.get("published"))
        and data.get("status") in ("published", "live")
        and not data["sold_out"]
        and (cutoff_dt is None or cutoff_dt > now)
    )
    return data


def get_event(db: Session, event_id: str, *, published_only: bool = False) -> dict[str, Any] | None:
    where = "WHERE e.id = CAST(:id AS uuid)"
    if published_only:
        where += " AND e.published = TRUE AND e.status NOT IN ('cancelled', 'draft') AND s.active = TRUE"
    row = db.execute(text(_event_select_sql() + where), {"id": event_id}).mappings().first()
    return enrich_event(dict(row)) if row else None


def list_events(
    db: Session,
    *,
    service_type: str | None = None,
    participation_mode: str | None = None,
    status_filter: str | None = None,
    temple_id: str | None = None,
    service_id: str | None = None,
    q: str | None = None,
    published_only: bool = True,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    where = ["1=1"]
    params: dict[str, Any] = {"lim": limit, "off": offset}
    if published_only:
        where.append("e.published = TRUE AND e.status NOT IN ('cancelled', 'draft')")
    if service_type:
        where.append("s.service_type = :stype")
        params["stype"] = service_type
    if participation_mode:
        where.append("e.participation_mode = :pmode")
        params["pmode"] = participation_mode
    if status_filter == "upcoming":
        where.append("e.start_at > NOW() AND e.status IN ('published', 'live')")
    elif status_filter == "live":
        where.append("(e.status = 'live' OR (e.start_at <= NOW() AND COALESCE(e.end_at, e.start_at) >= NOW()))")
    elif status_filter == "completed":
        where.append("e.status = 'completed'")
    if temple_id:
        where.append("e.temple_id = CAST(:tid AS uuid)")
        params["tid"] = temple_id
    if service_id:
        where.append("e.service_id = CAST(:sid AS uuid)")
        params["sid"] = service_id
    if q:
        where.append("(COALESCE(e.title, s.name) ILIKE :q OR s.name ILIKE :q)")
        params["q"] = f"%{q.strip()}%"
    sql = (
        _event_select_sql()
        + " WHERE "
        + " AND ".join(where)
        + " ORDER BY e.start_at ASC LIMIT :lim OFFSET :off"
    )
    rows = db.execute(text(sql), params).mappings().all()
    return [enrich_event(dict(r)) for r in rows]


def next_registration_number(db: Session) -> str:
    n = db.execute(text("SELECT COUNT(*) FROM seva_event_registrations")).scalar() or 0
    return f"SEVA-{int(n) + 1:06d}"


def registration_row(db: Session, registration_id: str) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT r.*,
                   e.title AS event_title,
                   e.start_at AS event_start_at,
                   e.end_at AS event_end_at,
                   e.participation_mode AS event_participation_mode,
                   e.puja_event_kind,
                   e.meeting_url AS event_meeting_url,
                   e.meeting_invite_token AS event_meeting_invite_token,
                   e.online_enabled,
                   e.proof_image_path AS event_proof_image_path,
                   e.proof_released AS event_proof_released,
                   s.name AS service_name,
                   s.slug AS service_slug,
                   s.service_type,
                   t.name AS temple_name,
                   t.city AS temple_city,
                   t.address AS temple_address,
                   u.name AS pujari_name
            FROM seva_event_registrations r
            JOIN seva_events e ON e.id = r.event_id
            JOIN services s ON s.id = e.service_id
            LEFT JOIN temples t ON t.id = e.temple_id
            LEFT JOIN users u ON u.id = e.assigned_pujari_id
            WHERE r.id = CAST(:id AS uuid)
            """
        ),
        {"id": registration_id},
    ).mappings().first()
    return row_dict(row) if row else None


def ensure_join_token(db: Session, registration_id: str) -> str:
    row = db.execute(
        text("SELECT join_token FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
        {"id": registration_id},
    ).first()
    token = row[0] if row and row[0] else None
    if not token:
        token = uuid4().hex
        db.execute(
            text(
                """
                UPDATE seva_event_registrations
                SET join_token = :tok, updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND join_token IS NULL
                """
            ),
            {"tok": token, "id": registration_id},
        )
    return str(token)
