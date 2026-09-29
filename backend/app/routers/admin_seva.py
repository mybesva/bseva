"""Admin Seva events, packages, discovery, fulfillment."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain import row_dict
from app.meetings.event_meet import ensure_event_meeting
from app.rbac import require_any_permission, require_permission
from app.schemas import (
    SevaDiscoveryLinkIn,
    SevaEventIn,
    SevaEventPatchIn,
    ServicePackageIn,
    ServicePackagePatchIn,
)
from app.seva.constants import EVENT_STATUSES, PRASAD_STATUSES, PUJA_EVENT_KINDS, SERVICE_TYPES
from app.seva.helpers import get_event, list_events
from app.storage import content_type_for, upload_bytes

router = APIRouter(prefix="/admin/seva", tags=["admin-seva"])


@router.get("/events")
def admin_list_events(
    service_type: str | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(require_any_permission("manage_bookings", "manage_services")),
    db: Session = Depends(get_db),
):
    where = ["1=1"]
    params: dict = {"lim": limit, "off": offset}
    if service_type:
        where.append("s.service_type = :stype")
        params["stype"] = service_type
    if status:
        where.append("e.status = :status")
        params["status"] = status
    rows = db.execute(
        text(
            f"""
            SELECT e.*, s.name AS service_name, s.service_type, u.name AS pujari_name, t.name AS temple_name
            FROM seva_events e
            JOIN services s ON s.id = e.service_id
            LEFT JOIN users u ON u.id = e.assigned_pujari_id
            LEFT JOIN temples t ON t.id = e.temple_id
            WHERE {' AND '.join(where)}
            ORDER BY e.start_at DESC
            LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/events")
def create_event(
    body: SevaEventIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    svc = db.execute(
        text("SELECT id, service_type, name, duration_minutes FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(body.service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    if body.puja_event_kind and body.puja_event_kind not in PUJA_EVENT_KINDS:
        raise HTTPException(400, "Invalid puja event kind")
    eid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO seva_events (
              id, service_id, assigned_pujari_id, temple_id, title, description,
              start_at, end_at, booking_cutoff_at, capacity, status, participation_mode,
              puja_event_kind, is_free, price_paise, online_enabled, language_code,
              tithi, festival_slug, series_id, session_number, published
            ) VALUES (
              CAST(:id AS uuid), CAST(:sid AS uuid), CAST(:pid AS uuid), CAST(:tid AS uuid),
              :title, :desc, :start, :end, :cutoff, :cap, :status, :pmode,
              :pkind, :free, :price, :online, :lang, :tithi, :fest, CAST(:series AS uuid),
              :sess, :pub
            )
            """
        ),
        {
            "id": eid,
            "sid": str(body.service_id),
            "pid": str(body.assigned_pujari_id) if body.assigned_pujari_id else None,
            "tid": str(body.temple_id) if body.temple_id else None,
            "title": body.title,
            "desc": body.description,
            "start": body.start_at.isoformat(),
            "end": body.end_at.isoformat() if body.end_at else None,
            "cutoff": body.booking_cutoff_at.isoformat() if body.booking_cutoff_at else None,
            "cap": body.capacity,
            "status": body.status or "draft",
            "pmode": body.participation_mode,
            "pkind": body.puja_event_kind,
            "free": body.is_free,
            "price": body.price_paise,
            "online": body.online_enabled,
            "lang": body.language_code,
            "tithi": body.tithi,
            "fest": body.festival_slug,
            "series": str(body.series_id) if body.series_id else None,
            "sess": body.session_number,
            "pub": body.published,
        },
    )
    if body.online_enabled and body.published:
        event = get_event(db, eid, published_only=False)
        if event:
            pujari_email = None
            if body.assigned_pujari_id:
                pe = db.execute(
                    text("SELECT email FROM users WHERE id = CAST(:id AS uuid)"),
                    {"id": str(body.assigned_pujari_id)},
                ).first()
                pujari_email = pe[0] if pe else None
            ensure_event_meeting(
                db,
                event,
                service_name=str(svc["name"]),
                pujari_email=pujari_email,
                duration_minutes=int(svc.get("duration_minutes") or 90),
            )
    db.commit()
    return get_event(db, eid, published_only=False)


@router.patch("/events/{event_id}")
def patch_event(
    event_id: str,
    body: SevaEventPatchIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    existing = get_event(db, event_id, published_only=False)
    if not existing:
        raise HTTPException(404, "Event not found")
    fields = []
    params: dict = {"id": event_id}
    for attr in (
        "title", "description", "status", "participation_mode", "puja_event_kind",
        "is_free", "price_paise", "online_enabled", "language_code", "tithi",
        "festival_slug", "session_number", "published", "proof_released", "cancellation_reason",
    ):
        val = getattr(body, attr, None)
        if val is not None:
            col = "cancellation_reason" if attr == "cancellation_reason" else attr
            fields.append(f"{col} = :{attr}")
            params[attr] = val
    for attr in ("start_at", "end_at", "booking_cutoff_at"):
        val = getattr(body, attr, None)
        if val is not None:
            fields.append(f"{attr} = :{attr}")
            params[attr] = val.isoformat()
    for attr in ("assigned_pujari_id", "temple_id", "series_id"):
        val = getattr(body, attr, None)
        if val is not None:
            fields.append(f"{attr} = CAST(:{attr} AS uuid)")
            params[attr] = str(val) if val else None
    if body.capacity is not None:
        fields.append("capacity = :capacity")
        params["capacity"] = body.capacity
    if body.status == "cancelled":
        fields.append("cancelled_at = NOW()")
    if not fields:
        raise HTTPException(400, "No changes")
    fields.append("updated_at = NOW()")
    db.execute(text(f"UPDATE seva_events SET {', '.join(fields)} WHERE id = CAST(:id AS uuid)"), params)
    updated = get_event(db, event_id, published_only=False)
    if updated and updated.get("online_enabled") and updated.get("published"):
        svc = db.execute(
            text("SELECT name, duration_minutes FROM services WHERE id = CAST(:id AS uuid)"),
            {"id": updated["service_id"]},
        ).mappings().first()
        pujari_email = None
        if updated.get("assigned_pujari_id"):
            pe = db.execute(
                text("SELECT email FROM users WHERE id = CAST(:id AS uuid)"),
                {"id": updated["assigned_pujari_id"]},
            ).first()
            pujari_email = pe[0] if pe else None
        ensure_event_meeting(
            db,
            updated,
            service_name=str(svc["name"]) if svc else "Seva",
            pujari_email=pujari_email,
            duration_minutes=int(svc["duration_minutes"] or 90) if svc else 90,
        )
    db.commit()
    return get_event(db, event_id, published_only=False)


@router.get("/events/{event_id}/registrations")
def event_registrations(
    event_id: str,
    user=Depends(require_any_permission("manage_bookings", "manage_services")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT r.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
            FROM seva_event_registrations r
            JOIN users u ON u.id = r.customer_id
            WHERE r.event_id = CAST(:eid AS uuid)
            ORDER BY r.created_at ASC
            """
        ),
        {"eid": event_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/events/{event_id}/sankalp-manifest")
def sankalp_manifest(
    event_id: str,
    user=Depends(require_any_permission("manage_bookings", "manage_services")),
    db: Session = Depends(get_db),
):
    """Consolidated participant/Sankalp list for group puja and proxy puja."""
    event = get_event(db, event_id, published_only=False)
    if not event:
        raise HTTPException(404, "Event not found")
    rows = db.execute(
        text(
            """
            SELECT r.registration_number, r.primary_name, r.gotra, r.gotra_unknown,
                   r.sankalp_text, r.family_members, r.package_name, r.participation_mode,
                   r.status, u.name AS customer_name
            FROM seva_event_registrations r
            JOIN users u ON u.id = r.customer_id
            WHERE r.event_id = CAST(:eid AS uuid) AND r.status IN ('confirmed', 'completed')
            ORDER BY r.created_at ASC
            """
        ),
        {"eid": event_id},
    ).mappings().all()
    return {"event": event, "participants": [row_dict(r) for r in rows]}


@router.patch("/registrations/{registration_id}/prasad")
def update_prasad_status(
    registration_id: str,
    prasad_status: str = Query(...),
    prasad_courier: str | None = None,
    prasad_tracking: str | None = None,
    user=Depends(require_any_permission("manage_bookings", "manage_services")),
    db: Session = Depends(get_db),
):
    if prasad_status not in PRASAD_STATUSES:
        raise HTTPException(400, "Invalid prasad status")
    db.execute(
        text(
            """
            UPDATE seva_event_registrations
            SET prasad_status = :st, prasad_courier = :courier, prasad_tracking = :track, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": registration_id, "st": prasad_status, "courier": prasad_courier, "track": prasad_tracking},
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM seva_event_registrations WHERE id = CAST(:id AS uuid)"),
        {"id": registration_id},
    ).mappings().first()
    return row_dict(row)


@router.post("/events/{event_id}/proof")
async def upload_event_proof(
    event_id: str,
    file: UploadFile = File(...),
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    event = get_event(db, event_id, published_only=False)
    if not event:
        raise HTTPException(404, "Event not found")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    ext = (file.filename or "proof.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Images only (jpg, png, webp)")
    path = f"seva-events/{event_id}/proof.{ext}"
    upload_bytes(path, data, content_type=content_type_for(ext))
    db.execute(
        text(
            """
            UPDATE seva_events SET proof_image_path = :path, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"path": path, "id": event_id},
    )
    db.commit()
    return {"proof_image_path": path}


@router.post("/registrations/{registration_id}/proof")
async def upload_registration_proof(
    registration_id: str,
    file: UploadFile = File(...),
    user=Depends(require_any_permission("manage_bookings", "manage_services")),
    db: Session = Depends(get_db),
):
    ext = (file.filename or "proof.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Images only")
    data = await file.read()
    path = f"seva-registrations/{registration_id}/proof.{ext}"
    upload_bytes(path, data, content_type=content_type_for(ext))
    db.execute(
        text(
            """
            UPDATE seva_event_registrations
            SET proof_image_path = :path, proof_released = TRUE, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"path": path, "id": registration_id},
    )
    db.commit()
    return {"proof_image_path": path}


# Service packages CRUD
@router.get("/services/{service_id}/packages")
def list_service_packages(
    service_id: str,
    user=Depends(require_any_permission("manage_services", "manage_bookings")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT * FROM service_packages
            WHERE service_id = CAST(:sid AS uuid)
            ORDER BY sort_order, name
            """
        ),
        {"sid": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/services/{service_id}/packages")
def create_service_package(
    service_id: str,
    body: ServicePackageIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    pid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO service_packages (
              id, service_id, slug, name, price_paise, max_members, prasad_included, inclusions, active, sort_order
            ) VALUES (
              CAST(:id AS uuid), CAST(:sid AS uuid), :slug, :name, :price, :max, :prasad, :inc, :active, :ord
            )
            """
        ),
        {
            "id": pid,
            "sid": service_id,
            "slug": body.slug,
            "name": body.name,
            "price": body.price_paise,
            "max": body.max_members,
            "prasad": body.prasad_included,
            "inc": body.inclusions,
            "active": body.active,
            "ord": body.sort_order,
        },
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM service_packages WHERE id = CAST(:id AS uuid)"),
        {"id": pid},
    ).mappings().first()
    return row_dict(row)


@router.patch("/packages/{package_id}")
def patch_service_package(
    package_id: str,
    body: ServicePackagePatchIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    fields = []
    params: dict = {"id": package_id}
    for attr in ("slug", "name", "price_paise", "max_members", "prasad_included", "inclusions", "active", "sort_order"):
        val = getattr(body, attr, None)
        if val is not None:
            fields.append(f"{attr} = :{attr}")
            params[attr] = val
    if not fields:
        raise HTTPException(400, "No changes")
    fields.append("updated_at = NOW()")
    db.execute(text(f"UPDATE service_packages SET {', '.join(fields)} WHERE id = CAST(:id AS uuid)"), params)
    db.commit()
    row = db.execute(
        text("SELECT * FROM service_packages WHERE id = CAST(:id AS uuid)"),
        {"id": package_id},
    ).mappings().first()
    return row_dict(row)


@router.post("/discovery")
def create_discovery_link(
    body: SevaDiscoveryLinkIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    lid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO seva_discovery_links (
              id, link_type, service_id, event_id, festival_slug, tithi, month_number, day_number, title, sort_order, active
            ) VALUES (
              CAST(:id AS uuid), :ltype, CAST(:sid AS uuid), CAST(:eid AS uuid),
              :fest, :tithi, :mon, :day, :title, :ord, :active
            )
            """
        ),
        {
            "id": lid,
            "ltype": body.link_type,
            "sid": str(body.service_id) if body.service_id else None,
            "eid": str(body.event_id) if body.event_id else None,
            "fest": body.festival_slug,
            "tithi": body.tithi,
            "mon": body.month_number,
            "day": body.day_number,
            "title": body.title,
            "ord": body.sort_order,
            "active": body.active,
        },
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM seva_discovery_links WHERE id = CAST(:id AS uuid)"),
        {"id": lid},
    ).mappings().first()
    return row_dict(row)
