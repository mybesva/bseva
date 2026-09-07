"""Muhurta consultations, service recommendations, and astrology service helpers."""
from __future__ import annotations

from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import apply_wallet, row_dict
from app.platform_config import get_setting
from app.rbac import require_permission
from app.schemas import MuhurtaConsultationIn, ServiceRecommendationIn

router = APIRouter(tags=["consultations"])


@router.get("/recommendations")
def list_recommendations(
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    """Active recommended pujas for customers (rule-based; AI can plug in later)."""
    m = month or date.today().month
    rows = db.execute(
        text(
            """
            SELECT r.*, s.name AS service_name, s.slug AS service_slug, s.category,
                   s.standard_price_paise, s.active AS service_active
            FROM service_recommendations r
            JOIN services s ON s.id = r.service_id
            WHERE r.active = TRUE AND s.active = TRUE
              AND (r.month_number IS NULL OR r.month_number = :m)
            ORDER BY r.sort_order, r.title
            """
        ),
        {"m": m},
    ).mappings().all()
    return {"month": m, "items": [row_dict(r) for r in rows]}


@router.get("/admin/recommendations")
def admin_list_recommendations(
    admin=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT r.*, s.name AS service_name, s.slug AS service_slug
            FROM service_recommendations r
            JOIN services s ON s.id = r.service_id
            ORDER BY r.sort_order, r.title
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/recommendations")
def admin_create_recommendation(
    body: ServiceRecommendationIn,
    admin=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    rid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO service_recommendations (
              id, service_id, title, description, audience, month_number, recurrence_hint, active, sort_order
            ) VALUES (
              CAST(:id AS uuid), CAST(:sid AS uuid), :title, :desc, :aud, :m, :rec, :act, :ord
            )
            """
        ),
        {
            "id": rid,
            "sid": str(body.service_id),
            "title": body.title,
            "desc": body.description,
            "aud": body.audience or "customer",
            "m": body.month_number,
            "rec": body.recurrence_hint,
            "act": body.active,
            "ord": body.sort_order,
        },
    )
    write_audit(db, str(admin["id"]), "recommendation_create", "service_recommendation", rid)
    db.commit()
    return {"ok": True, "id": rid}


@router.put("/admin/recommendations/{rec_id}")
def admin_update_recommendation(
    rec_id: str,
    body: ServiceRecommendationIn,
    admin=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            UPDATE service_recommendations SET
              service_id = CAST(:sid AS uuid), title = :title, description = :desc,
              audience = :aud, month_number = :m, recurrence_hint = :rec,
              active = :act, sort_order = :ord, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "id": rec_id,
            "sid": str(body.service_id),
            "title": body.title,
            "desc": body.description,
            "aud": body.audience or "customer",
            "m": body.month_number,
            "rec": body.recurrence_hint,
            "act": body.active,
            "ord": body.sort_order,
        },
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Recommendation not found")
    write_audit(db, str(admin["id"]), "recommendation_update", "service_recommendation", rec_id)
    db.commit()
    return {"ok": True}


@router.delete("/admin/recommendations/{rec_id}")
def admin_delete_recommendation(
    rec_id: str,
    admin=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    db.execute(text("DELETE FROM service_recommendations WHERE id = CAST(:id AS uuid)"), {"id": rec_id})
    write_audit(db, str(admin["id"]), "recommendation_delete", "service_recommendation", rec_id)
    db.commit()
    return {"ok": True}


@router.post("/muhurta-consultations")
def create_muhurta_consultation(
    body: MuhurtaConsultationIn,
    user=Depends(require_roles("customer")),
    db: Session = Depends(get_db),
):
    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid) AND active = TRUE"),
        {"id": str(body.service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    if not svc.get("muhurta_consultation_enabled") and not svc.get("requires_muhurta"):
        raise HTTPException(400, "Muhurta consultation is not enabled for this service")
    fee = svc.get("muhurta_fee_paise")
    if fee is None:
        fee = int(get_setting(db, "muhurta_consultation_fee_paise", 30000) or 0)
    fee = int(fee)
    cid = str(uuid4())
    prefs = [d.isoformat() for d in (body.preferred_dates or [])]
    # Charge wallet when fee > 0
    pay_status = "not_required"
    if fee > 0:
        try:
            apply_wallet(
                db,
                str(user["id"]),
                -fee,
                "debit",
                f"Muhurta consultation for {svc.get('name')}",
                None,
                f"MUH-{cid[:8]}",
            )
            pay_status = "paid"
        except ValueError as e:
            raise HTTPException(400, str(e))
    db.execute(
        text(
            """
            INSERT INTO muhurta_consultations (
              id, customer_id, service_id, fee_paise, payment_status, status, preferred_dates, guidance_notes
            ) VALUES (
              CAST(:id AS uuid), CAST(:cid AS uuid), CAST(:sid AS uuid), :fee, :pay, 'requested',
              CAST(:prefs AS jsonb), :notes
            )
            """
        ),
        {
            "id": cid,
            "cid": user["id"],
            "sid": str(body.service_id),
            "fee": fee,
            "pay": pay_status,
            "prefs": __import__("json").dumps(prefs),
            "notes": body.notes,
        },
    )
    write_audit(db, str(user["id"]), "muhurta_request", "muhurta_consultation", cid)
    db.commit()
    return {"ok": True, "id": cid, "fee_paise": fee, "payment_status": pay_status, "status": "requested"}


@router.get("/muhurta-consultations")
def list_muhurta_consultations(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] in ("admin", "super_admin"):
        rows = db.execute(
            text(
                """
                SELECT m.*, s.name AS service_name, u.name AS customer_name
                FROM muhurta_consultations m
                JOIN services s ON s.id = m.service_id
                JOIN users u ON u.id = m.customer_id
                ORDER BY m.created_at DESC LIMIT 200
                """
            )
        ).mappings().all()
    elif user["role"] in ("pujari", "head_pujari"):
        rows = db.execute(
            text(
                """
                SELECT m.*, s.name AS service_name, u.name AS customer_name
                FROM muhurta_consultations m
                JOIN services s ON s.id = m.service_id
                JOIN users u ON u.id = m.customer_id
                WHERE m.pujari_id = CAST(:id AS uuid) OR m.status = 'requested'
                ORDER BY m.created_at DESC LIMIT 100
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                SELECT m.*, s.name AS service_name
                FROM muhurta_consultations m
                JOIN services s ON s.id = m.service_id
                WHERE m.customer_id = CAST(:id AS uuid)
                ORDER BY m.created_at DESC
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    return [row_dict(r) for r in rows]


@router.patch("/muhurta-consultations/{consultation_id}")
def update_muhurta_consultation(
    consultation_id: str,
    guidance_notes: str | None = None,
    status: str | None = None,
    linked_booking_id: str | None = None,
    pujari_id: str | None = None,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    m = db.execute(
        text("SELECT * FROM muhurta_consultations WHERE id = CAST(:id AS uuid)"),
        {"id": consultation_id},
    ).mappings().first()
    if not m:
        raise HTTPException(404, "Consultation not found")
    if user["role"] == "customer" and str(m["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if user["role"] not in ("admin", "super_admin", "pujari", "head_pujari") and linked_booking_id is None:
        if status or guidance_notes or pujari_id:
            raise HTTPException(403, "Not allowed")
    sets = ["updated_at = NOW()"]
    params: dict = {"id": consultation_id}
    if guidance_notes is not None:
        sets.append("guidance_notes = :notes")
        params["notes"] = guidance_notes
    if status is not None:
        if status not in ("requested", "in_progress", "guided", "completed", "cancelled"):
            raise HTTPException(400, "Invalid status")
        sets.append("status = :st")
        params["st"] = status
    if linked_booking_id is not None:
        sets.append("linked_booking_id = CAST(:bid AS uuid)")
        params["bid"] = linked_booking_id
        db.execute(
            text(
                "UPDATE bookings SET consultation_id = CAST(:cid AS uuid) WHERE id = CAST(:bid AS uuid)"
            ),
            {"cid": consultation_id, "bid": linked_booking_id},
        )
    if pujari_id is not None and user["role"] in ("admin", "super_admin"):
        sets.append("pujari_id = CAST(:pid AS uuid)")
        params["pid"] = pujari_id
    db.execute(text(f"UPDATE muhurta_consultations SET {', '.join(sets)} WHERE id = CAST(:id AS uuid)"), params)
    write_audit(db, str(user["id"]), "muhurta_update", "muhurta_consultation", consultation_id)
    db.commit()
    return {"ok": True}


@router.get("/astrology/services")
def astrology_services(db: Session = Depends(get_db)):
    """Public list of astrology-category services (foundation for Astrology section)."""
    rows = db.execute(
        text(
            """
            SELECT id, name, slug, description, category, standard_price_paise, premium_price_paise,
                   duration_minutes, virtual_available, muhurta_consultation_enabled
            FROM services
            WHERE active = TRUE AND category = 'astrology'
            ORDER BY name
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]
