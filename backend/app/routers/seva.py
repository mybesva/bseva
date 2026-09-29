"""Customer-facing Seva events, registrations, and Family Sankalp."""
from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import row_dict
from app.i18n import resolve_request_lang
from app.platform_config import get_setting
from app.schemas import (
    FamilyMemberIn,
    FamilyMemberPatchIn,
    SevaEventRegisterIn,
)
from app.seva.constants import FAMILY_RELATIONSHIPS, SERVICE_TYPES
from app.seva.helpers import (
    chadhava_enabled,
    get_event,
    list_events,
    pravachan_enabled,
    registration_row,
    seva_enabled,
    service_type_enabled,
)
from app.seva.registrations import RegistrationError, cancel_registration, create_registration, registration_can_join

router = APIRouter(tags=["seva"])


def _require_seva(db: Session) -> None:
    if not seva_enabled(db):
        raise HTTPException(503, "Seva events are temporarily unavailable")


@router.get("/seva/config")
def seva_config(db: Session = Depends(get_db)):
    return {
        "seva_events_enabled": seva_enabled(db),
        "chadhava_enabled": chadhava_enabled(db),
        "pravachan_enabled": pravachan_enabled(db),
    }


@router.get("/seva/services")
def list_seva_services(
    request: Request,
    service_type: str = Query(..., pattern="^(puja|chadhava|pravachan)$"),
    q: str | None = None,
    lang: str | None = None,
    db: Session = Depends(get_db),
):
    _require_seva(db)
    if service_type == "chadhava" and not chadhava_enabled(db):
        return []
    if service_type == "pravachan" and not pravachan_enabled(db):
        return []
    from app.catalog import enrich_service

    resolve_request_lang(lang, request)
    where = ["s.service_type = :stype", "s.active = TRUE"]
    params: dict = {"stype": service_type}
    if q:
        where.append("(s.name ILIKE :q OR s.slug ILIKE :q)")
        params["q"] = f"%{q.strip()}%"
    rows = db.execute(
        text(f"SELECT s.* FROM services s WHERE {' AND '.join(where)} ORDER BY s.display_order, s.name"),
        params,
    ).mappings().all()
    return [enrich_service(db, dict(r), lang=resolve_request_lang(lang, request)) for r in rows]


@router.get("/seva/events")
def list_public_events(
    service_type: str | None = None,
    participation_mode: str | None = None,
    status_filter: str | None = None,
    temple_id: str | None = None,
    service_id: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _require_seva(db)
    if service_type == "chadhava" and not chadhava_enabled(db):
        return []
    if service_type == "pravachan" and not pravachan_enabled(db):
        return []
    return list_events(
        db,
        service_type=service_type,
        participation_mode=participation_mode,
        status_filter=status_filter,
        temple_id=temple_id,
        service_id=service_id,
        q=q,
        published_only=True,
        limit=limit,
        offset=offset,
    )


@router.get("/seva/events/{event_id}")
def get_public_event(event_id: str, db: Session = Depends(get_db)):
    _require_seva(db)
    event = get_event(db, event_id, published_only=True)
    if not event:
        raise HTTPException(404, "Event not found")
    if not service_type_enabled(db, str(event.get("service_type") or "puja")):
        raise HTTPException(404, "Event not found")
    pkgs = db.execute(
        text(
            """
            SELECT * FROM service_packages
            WHERE service_id = CAST(:sid AS uuid) AND active = TRUE
            ORDER BY sort_order, name
            """
        ),
        {"sid": event["service_id"]},
    ).mappings().all()
    event["packages"] = [row_dict(p) for p in pkgs]
    return event


@router.get("/seva/events/{event_id}/packages")
def list_event_packages(event_id: str, db: Session = Depends(get_db)):
    event = get_event(db, event_id, published_only=True)
    if not event:
        raise HTTPException(404, "Event not found")
    rows = db.execute(
        text(
            """
            SELECT * FROM service_packages
            WHERE service_id = CAST(:sid AS uuid) AND active = TRUE
            ORDER BY sort_order, name
            """
        ),
        {"sid": event["service_id"]},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/seva/events/{event_id}/register")
def register_for_event(
    event_id: str,
    body: SevaEventRegisterIn,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_seva(db)
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    try:
        reg = create_registration(
            db,
            customer_id=str(user["id"]),
            event_id=event_id,
            participation_mode=body.participation_mode,
            package_id=str(body.package_id) if body.package_id else None,
            primary_name=body.primary_name,
            gotra=body.gotra,
            gotra_unknown=body.gotra_unknown,
            sankalp_text=body.sankalp_text,
            family_members=[m.model_dump() for m in (body.family_members or [])],
            prasad_address_id=str(body.prasad_address_id) if body.prasad_address_id else None,
            idempotency_key=body.idempotency_key,
        )
    except RegistrationError as exc:
        raise HTTPException(exc.status, detail={"code": exc.code, "message": exc.message}) from exc

    try:
        from app.routers.notifications import create_notification

        create_notification(
            db,
            user_id=str(user["id"]),
            title="Registration confirmed",
            body=f"Your registration {reg.get('registration_number')} is confirmed.",
            category="booking",
            link=f"/my-seva/{reg['id']}",
            message_key="sevaRegistrationConfirmed",
            message_vars={"number": reg.get("registration_number"), "event_id": event_id},
        )
    except Exception:
        pass
    db.commit()
    return registration_row(db, str(reg["id"]))


@router.get("/seva/my-registrations")
def my_registrations(
    user=Depends(current_user),
    service_type: str | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    where = ["r.customer_id = CAST(:cid AS uuid)"]
    params: dict = {"cid": str(user["id"])}
    if service_type and service_type in SERVICE_TYPES:
        where.append("r.service_type = :stype")
        params["stype"] = service_type
    if status_filter == "upcoming":
        where.append("e.start_at > NOW() AND r.status IN ('confirmed', 'pending')")
    elif status_filter == "completed":
        where.append("r.status = 'completed'")
    elif status_filter == "live":
        where.append("e.start_at <= NOW() AND COALESCE(e.end_at, e.start_at) >= NOW()")
    rows = db.execute(
        text(
            f"""
            SELECT r.*,
                   e.title AS event_title, e.start_at AS event_start_at, e.end_at AS event_end_at,
                   e.participation_mode AS event_participation_mode, e.puja_event_kind,
                   e.online_enabled, e.status AS event_status,
                   s.name AS service_name, s.slug AS service_slug,
                   t.name AS temple_name, t.city AS temple_city
            FROM seva_event_registrations r
            JOIN seva_events e ON e.id = r.event_id
            JOIN services s ON s.id = e.service_id
            LEFT JOIN temples t ON t.id = e.temple_id
            WHERE {' AND '.join(where)}
            ORDER BY e.start_at DESC
            """
        ),
        params,
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/seva/my-registrations/{registration_id}")
def my_registration_detail(registration_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    row = db.execute(
        text(
            """
            SELECT r.* FROM seva_event_registrations r
            WHERE r.id = CAST(:id AS uuid) AND r.customer_id = CAST(:cid AS uuid)
            """
        ),
        {"id": registration_id, "cid": str(user["id"])},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Registration not found")
    detail = registration_row(db, registration_id)
    event = get_event(db, str(row["event_id"]), published_only=False)
    if event and detail:
        ok, msg = registration_can_join(db, detail, event)
        detail["can_join_live"] = ok
        detail["join_message"] = msg
        if ok:
            detail["join_token"] = detail.get("join_token")
    return detail


@router.post("/seva/my-registrations/{registration_id}/cancel")
def cancel_my_registration(registration_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    try:
        reg = cancel_registration(db, registration_id=registration_id, customer_id=str(user["id"]))
    except RegistrationError as exc:
        raise HTTPException(exc.status, detail={"code": exc.code, "message": exc.message}) from exc
    db.commit()
    return reg


# Family Sankalp CRUD
@router.get("/customer/family-members")
def list_family_members(user=Depends(current_user), db: Session = Depends(get_db)):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    rows = db.execute(
        text(
            """
            SELECT * FROM customer_family_members
            WHERE customer_id = CAST(:cid AS uuid)
            ORDER BY created_at ASC
            """
        ),
        {"cid": str(user["id"])},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/customer/family-members")
def create_family_member(body: FamilyMemberIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    if body.relationship not in FAMILY_RELATIONSHIPS:
        raise HTTPException(400, "Invalid relationship")
    mid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO customer_family_members (
              id, customer_id, name, gotra, gotra_unknown, relationship, date_of_birth, notes
            ) VALUES (
              CAST(:id AS uuid), CAST(:cid AS uuid), :name, :gotra, :gu, :rel, :dob, :notes
            )
            """
        ),
        {
            "id": mid,
            "cid": str(user["id"]),
            "name": body.name.strip(),
            "gotra": None if body.gotra_unknown else (body.gotra or "").strip() or None,
            "gu": body.gotra_unknown,
            "rel": body.relationship,
            "dob": body.date_of_birth,
            "notes": body.notes,
        },
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM customer_family_members WHERE id = CAST(:id AS uuid)"),
        {"id": mid},
    ).mappings().first()
    return row_dict(row)


@router.patch("/customer/family-members/{member_id}")
def patch_family_member(
    member_id: str,
    body: FamilyMemberPatchIn,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    existing = db.execute(
        text(
            """
            SELECT id FROM customer_family_members
            WHERE id = CAST(:id AS uuid) AND customer_id = CAST(:cid AS uuid)
            """
        ),
        {"id": member_id, "cid": str(user["id"])},
    ).first()
    if not existing:
        raise HTTPException(404, "Family member not found")
    fields = []
    params: dict = {"id": member_id}
    if body.name is not None:
        fields.append("name = :name")
        params["name"] = body.name.strip()
    if body.gotra is not None:
        fields.append("gotra = :gotra")
        params["gotra"] = body.gotra.strip() or None
    if body.gotra_unknown is not None:
        fields.append("gotra_unknown = :gu")
        params["gu"] = body.gotra_unknown
    if body.relationship is not None:
        if body.relationship not in FAMILY_RELATIONSHIPS:
            raise HTTPException(400, "Invalid relationship")
        fields.append("relationship = :rel")
        params["rel"] = body.relationship
    if body.date_of_birth is not None:
        fields.append("date_of_birth = :dob")
        params["dob"] = body.date_of_birth
    if body.notes is not None:
        fields.append("notes = :notes")
        params["notes"] = body.notes
    if not fields:
        raise HTTPException(400, "No changes")
    fields.append("updated_at = NOW()")
    db.execute(
        text(f"UPDATE customer_family_members SET {', '.join(fields)} WHERE id = CAST(:id AS uuid)"),
        params,
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM customer_family_members WHERE id = CAST(:id AS uuid)"),
        {"id": member_id},
    ).mappings().first()
    return row_dict(row)


@router.delete("/customer/family-members/{member_id}")
def delete_family_member(member_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if user.get("role") != "customer":
        raise HTTPException(403, "Customers only")
    res = db.execute(
        text(
            """
            DELETE FROM customer_family_members
            WHERE id = CAST(:id AS uuid) AND customer_id = CAST(:cid AS uuid)
            RETURNING id
            """
        ),
        {"id": member_id, "cid": str(user["id"])},
    ).first()
    if not res:
        raise HTTPException(404, "Family member not found")
    db.commit()
    return {"ok": True}


@router.get("/pujari/seva-events")
def pujari_assigned_events(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT e.*, s.name AS service_name, s.service_type, t.name AS temple_name, t.city AS temple_city
            FROM seva_events e
            JOIN services s ON s.id = e.service_id
            LEFT JOIN temples t ON t.id = e.temple_id
            WHERE e.assigned_pujari_id = CAST(:pid AS uuid)
              AND e.status NOT IN ('cancelled', 'draft')
            ORDER BY e.start_at ASC
            """
        ),
        {"pid": str(user["id"])},
    ).mappings().all()
    from app.seva.helpers import enrich_event

    return [enrich_event(dict(r)) for r in rows]


@router.get("/pujari/seva-events/{event_id}")
def pujari_event_detail(event_id: str, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    event = get_event(db, event_id, published_only=False)
    if not event or str(event.get("assigned_pujari_id") or "") != str(user["id"]):
        raise HTTPException(404, "Event not found")
    regs = db.execute(
        text(
            """
            SELECT r.registration_number, r.primary_name, r.gotra, r.gotra_unknown,
                   r.sankalp_text, r.family_members, r.package_name, r.participation_mode, r.status
            FROM seva_event_registrations r
            WHERE r.event_id = CAST(:eid AS uuid) AND r.status IN ('confirmed', 'completed')
            ORDER BY r.created_at ASC
            """
        ),
        {"eid": event_id},
    ).mappings().all()
    event["participants"] = [row_dict(r) for r in regs]
    event["registration_count"] = len(regs)
    from app.meetings.service import public_invite_url_for

    if event.get("meeting_invite_token"):
        event["operational_meet_url"] = event.get("meeting_url")
        event["operational_invite_url"] = public_invite_url_for(str(event["meeting_invite_token"]))
    return event


@router.post("/pujari/seva-events/{event_id}/complete")
def pujari_complete_event(event_id: str, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    event = get_event(db, event_id, published_only=False)
    if not event or str(event.get("assigned_pujari_id") or "") != str(user["id"]):
        raise HTTPException(404, "Event not found")
    if str(event.get("status") or "") == "cancelled":
        raise HTTPException(409, "Event is cancelled")
    db.execute(
        text(
            """
            UPDATE seva_events SET status = 'completed', updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": event_id},
    )
    db.execute(
        text(
            """
            UPDATE seva_event_registrations
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE event_id = CAST(:eid AS uuid) AND status = 'confirmed'
            """
        ),
        {"eid": event_id},
    )
    db.commit()
    return get_event(db, event_id, published_only=False)


@router.get("/seva/discovery")
def seva_discovery(db: Session = Depends(get_db)):
    _require_seva(db)
    rows = db.execute(
        text(
            """
            SELECT d.*, s.name AS service_name, s.slug AS service_slug, s.service_type,
                   e.title AS event_title, e.start_at AS event_start_at
            FROM seva_discovery_links d
            LEFT JOIN services s ON s.id = d.service_id
            LEFT JOIN seva_events e ON e.id = d.event_id
            WHERE d.active = TRUE
            ORDER BY d.sort_order, d.created_at
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]
