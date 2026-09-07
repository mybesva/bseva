"""Admin pujari detail, document upload, and booking assignment."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.booking_state import set_booking_status
from app.db import get_db
from app.domain import row_dict, slot_conflict
from app.geo import haversine_km
from app.platform_config import get_setting
from app.profile_utils import parse_json_list, pujari_completion
from app.rbac import require_any_permission, require_permission
from app.schemas import BookingAssignIn, JoiningFeeWaiveIn, PujariProfileIn
from app.storage import content_type_for, file_response, upload_bytes

router = APIRouter(prefix="/admin", tags=["admin-pujari"])

ALLOWED_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
DOC_TYPES = {"certificate", "identity", "supporting"}


def _safe_name(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80] or "document"


def _load_admin_pujari(db: Session, pujari_id: str) -> dict:
    row = db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.phone, u.role, u.blocked, u.blocked_at, u.block_reason, u.created_at,
                   p.*
            FROM users u
            JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": pujari_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Pujari not found")
    out = row_dict(row)
    out["qualifications"] = parse_json_list(out.get("qualifications"))
    out["languages"] = parse_json_list(out.get("languages"))
    out["specializations"] = parse_json_list(out.get("specializations"))
    pct = pujari_completion(out)
    out["profile_completion_percentage"] = pct
    out["profile_complete"] = bool(out.get("profile_complete")) or pct >= 100
    out["profile_incomplete"] = not out["profile_complete"]
    return out


def _booking_conflict_excluding(
    db: Session, pujari_id: str, booking_date, start, end, exclude_booking_id: str
) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1 FROM bookings
            WHERE pujari_id = CAST(:pid AS uuid)
              AND booking_date = :d
              AND id <> CAST(:bid AS uuid)
              AND status IN ('pending', 'pending_acceptance', 'confirmed', 'in_progress')
              AND start_time < :end_t AND end_time > :start_t
            LIMIT 1
            """
        ),
        {
            "pid": pujari_id,
            "d": booking_date,
            "bid": exclude_booking_id,
            "start_t": start,
            "end_t": end,
        },
    ).first()
    return row is not None


@router.get("/pujaris/{pujari_id}")
def get_pujari_detail(
    pujari_id: str,
    user=Depends(require_any_permission("view_pujaris", "verify_pujaris", "edit_pujaris")),
    db: Session = Depends(get_db),
):
    profile = _load_admin_pujari(db, pujari_id)
    docs = db.execute(
        text(
            """
            SELECT d.*, u.name AS uploaded_by_name
            FROM pujari_documents d
            LEFT JOIN users u ON u.id = d.uploaded_by
            WHERE d.pujari_id = CAST(:id AS uuid)
            ORDER BY d.uploaded_at DESC
            """
        ),
        {"id": pujari_id},
    ).mappings().all()
    history = db.execute(
        text(
            """
            SELECT a.action, a.created_at, a.entity_id, u.name AS actor_name
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.actor_id
            WHERE a.entity_type = 'pujari' AND a.entity_id = :id
              AND (a.action LIKE 'verify_pujari%%' OR a.action IN ('assign_head_pujari', 'set_pujari_level', 'admin_pujari_update'))
            ORDER BY a.created_at DESC
            LIMIT 50
            """
        ),
        {"id": pujari_id},
    ).mappings().all()
    referral = db.execute(
        text("SELECT referral_code FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": pujari_id},
    ).first()
    return {
        "profile": profile,
        "documents": [row_dict(d) for d in docs],
        "verification_history": [row_dict(h) for h in history],
        "referral_code": referral[0] if referral else None,
    }


@router.patch("/pujaris/{pujari_id}")
def patch_pujari_profile(
    pujari_id: str,
    body: PujariProfileIn,
    admin=Depends(require_permission("edit_pujaris")),
    db: Session = Depends(get_db),
):
    exists = db.execute(
        text("SELECT 1 FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": pujari_id},
    ).first()
    if not exists:
        raise HTTPException(404, "Pujari not found")
    year = body.qualification_year
    if year is not None and year > date.today().year:
        raise HTTPException(400, "Qualification year cannot be in the future")
    if body.date_of_birth and body.date_of_birth > date.today():
        raise HTTPException(400, "Date of birth cannot be in the future")
    quals = json.dumps(body.qualifications) if body.qualifications is not None else None
    langs = json.dumps(body.languages) if body.languages is not None else None
    specs = json.dumps(body.specializations) if body.specializations is not None else None
    db.execute(
        text(
            """
            UPDATE pujari_profiles SET
              full_name = COALESCE(:full_name, full_name),
              father_name = COALESCE(:father_name, father_name),
              gotra = COALESCE(:gotra, gotra),
              pravara = COALESCE(:pravara, pravara),
              date_of_birth = COALESCE(:dob, date_of_birth),
              native_place = COALESCE(:native_place, native_place),
              permanent_address = COALESCE(:permanent_address, permanent_address),
              present_address = COALESCE(:present_address, present_address),
              mobile_number = COALESCE(:mobile_number, mobile_number),
              whatsapp_number = COALESCE(:whatsapp_number, whatsapp_number),
              qualifications = COALESCE(:qualifications, qualifications),
              qualification_year = COALESCE(:qualification_year, qualification_year),
              sampradaya = COALESCE(:sampradaya, sampradaya),
              website_publication_consent = COALESCE(:consent, website_publication_consent),
              address_line1 = COALESCE(:a1, address_line1),
              address_line2 = COALESCE(:a2, address_line2),
              city = COALESCE(:city, city),
              district = COALESCE(:district, district),
              state = COALESCE(:state, state),
              pincode = COALESCE(:pincode, pincode),
              country = COALESCE(:country, country),
              location_label = COALESCE(:loc, location_label),
              latitude = COALESCE(:lat, latitude),
              longitude = COALESCE(:lng, longitude),
              languages = COALESCE(:langs, languages),
              specializations = COALESCE(:specs, specializations),
              experience_years = COALESCE(:exp, experience_years),
              available = COALESCE(:avail, available),
              service_radius_km = COALESCE(:radius, service_radius_km),
              bank_account_last4 = COALESCE(:bank4, bank_account_last4),
              bank_ifsc = COALESCE(:ifsc, bank_ifsc),
              bank_holder_name = COALESCE(:holder, bank_holder_name),
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
            "full_name": body.full_name,
            "father_name": body.father_name,
            "gotra": body.gotra,
            "pravara": body.pravara,
            "dob": body.date_of_birth,
            "native_place": body.native_place,
            "permanent_address": body.permanent_address,
            "present_address": body.present_address,
            "mobile_number": body.mobile_number,
            "whatsapp_number": body.whatsapp_number,
            "qualifications": quals,
            "qualification_year": year,
            "sampradaya": body.sampradaya,
            "consent": body.website_publication_consent,
            "a1": body.address_line1,
            "a2": body.address_line2,
            "city": body.city,
            "district": body.district,
            "state": body.state,
            "pincode": body.pincode,
            "country": body.country,
            "loc": body.location_label,
            "lat": body.latitude,
            "lng": body.longitude,
            "langs": langs,
            "specs": specs,
            "exp": body.experience_years,
            "avail": body.available,
            "radius": body.service_radius_km,
            "bank4": body.bank_account_last4,
            "ifsc": body.bank_ifsc,
            "holder": body.bank_holder_name,
            "id": pujari_id,
        },
    )
    if body.full_name:
        db.execute(text("UPDATE users SET name = :n WHERE id = CAST(:id AS uuid)"), {"n": body.full_name, "id": pujari_id})
    if body.mobile_number:
        db.execute(text("UPDATE users SET phone = :p WHERE id = CAST(:id AS uuid)"), {"p": body.mobile_number, "id": pujari_id})
    out = _load_admin_pujari(db, pujari_id)
    db.execute(
        text(
            """
            UPDATE pujari_profiles SET
              profile_complete = :c,
              profile_completion_percentage = :pct
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"c": out["profile_complete"], "pct": out["profile_completion_percentage"], "id": pujari_id},
    )
    write_audit(db, str(admin["id"]), "admin_pujari_update", "pujari", pujari_id)
    db.commit()
    return _load_admin_pujari(db, pujari_id)


@router.post("/pujaris/{pujari_id}/documents/upload")
async def admin_upload_document(
    pujari_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("certificate"),
    admin=Depends(require_any_permission("edit_pujaris", "verify_pujaris")),
    db: Session = Depends(get_db),
):
    exists = db.execute(
        text("SELECT 1 FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": pujari_id},
    ).first()
    if not exists:
        raise HTTPException(404, "Pujari not found")
    if document_type not in DOC_TYPES:
        raise HTTPException(400, "Invalid document type")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Upload a PDF or image (JPG, PNG, WebP)")
    stored = f"{uuid4().hex}_{_safe_name(file.filename or 'document')}"
    rel = f"{pujari_id}/{stored}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File must be under 8 MB")
    upload_bytes(rel, data, content_type_for(file.filename or stored))
    db.execute(
        text(
            """
            INSERT INTO pujari_documents (pujari_id, document_type, storage_path, status, uploaded_by)
            VALUES (CAST(:pid AS uuid), :typ, :path, 'uploaded', CAST(:by AS uuid))
            """
        ),
        {"pid": pujari_id, "typ": document_type, "path": rel, "by": str(admin["id"])},
    )
    write_audit(db, str(admin["id"]), f"admin_upload_doc:{document_type}", "pujari", pujari_id)
    db.commit()
    row = db.execute(
        text("SELECT * FROM pujari_documents WHERE pujari_id = CAST(:id AS uuid) ORDER BY uploaded_at DESC LIMIT 1"),
        {"id": pujari_id},
    ).mappings().first()
    return {"ok": True, "document": row_dict(row)}


@router.get("/pujaris/{pujari_id}/documents/{doc_id}/file")
def admin_document_file(
    pujari_id: str,
    doc_id: str,
    user=Depends(require_any_permission("view_pujaris", "verify_pujaris", "edit_pujaris")),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            SELECT * FROM pujari_documents
            WHERE id = CAST(:did AS uuid) AND pujari_id = CAST(:pid AS uuid)
            """
        ),
        {"did": doc_id, "pid": pujari_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Document not found")
    return file_response(str(row["storage_path"]), filename=Path(str(row["storage_path"])).name)


@router.get("/bookings/{booking_id}/available-pujaris")
def available_pujaris_for_booking(
    booking_id: str,
    user=Depends(require_any_permission("view_bookings", "manage_bookings")),
    db: Session = Depends(get_db),
):
    b = db.execute(
        text(
            """
            SELECT b.*, s.required_level, s.name AS service_name
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            WHERE b.id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    required = int(b["required_level"] or 1)
    rings_raw = get_setting(db, "assign_distance_rings_km", [10, 15, 20, 30])
    try:
        rings = [float(x) for x in (rings_raw if isinstance(rings_raw, list) else [10, 15, 20, 30])]
    except (TypeError, ValueError):
        rings = [10.0, 15.0, 20.0, 30.0]
    if not rings:
        rings = [10.0, 15.0, 20.0, 30.0]

    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.phone, p.approved_level, p.verification_status, p.available,
                   p.location_label, p.city, p.district, p.experience_years, p.specializations,
                   p.qualifications, p.latitude, p.longitude, p.service_radius_km, p.pravara
            FROM users u
            JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.blocked = FALSE
              AND u.role IN ('pujari', 'head_pujari')
              AND p.verification_status = 'approved'
              AND p.available = TRUE
              AND COALESCE(p.profile_complete, FALSE) = TRUE
              AND COALESCE(p.approved_level, 0) >= :lvl
            ORDER BY p.approved_level DESC, u.name
            """
        ),
        {"lvl": required},
    ).mappings().all()

    booking_lat = b.get("latitude")
    booking_lng = b.get("longitude")
    has_coords = booking_lat is not None and booking_lng is not None

    eligible = []
    for r in rows:
        conflict = _booking_conflict_excluding(
            db, str(r["id"]), b["booking_date"], b["start_time"], b["end_time"], booking_id
        )
        blocked = db.execute(
            text(
                """
                SELECT 1 FROM pujari_blocked_dates
                WHERE pujari_id = CAST(:pid AS uuid) AND blocked_date = :d
                  AND (
                    start_time IS NULL OR end_time IS NULL
                    OR (start_time < :et AND end_time > :st)
                  )
                """
            ),
            {
                "pid": str(r["id"]),
                "d": b["booking_date"],
                "st": b["start_time"],
                "et": b["end_time"],
            },
        ).first()
        if conflict or blocked:
            continue
        item = row_dict(r)
        item["eligible"] = True
        dist = None
        if has_coords and r.get("latitude") is not None and r.get("longitude") is not None:
            dist = round(
                haversine_km(float(booking_lat), float(booking_lng), float(r["latitude"]), float(r["longitude"])),
                2,
            )
        item["distance_km"] = dist
        item.pop("latitude", None)
        item.pop("longitude", None)
        eligible.append(item)

    matched_ring = None
    filtered = eligible
    if has_coords:
        for ring in rings:
            in_ring = [
                p
                for p in eligible
                if p.get("distance_km") is not None and p["distance_km"] <= ring
            ]
            if in_ring:
                filtered = in_ring
                matched_ring = ring
                break
        else:
            # No one within configured rings — still return all eligible, farthest first by distance
            filtered = eligible
            matched_ring = None

    filtered.sort(
        key=lambda x: (
            x["distance_km"] if x.get("distance_km") is not None else 99999,
            -(x.get("approved_level") or 0),
            x.get("name") or "",
        )
    )
    return {
        "booking_id": booking_id,
        "booking_number": b.get("booking_number"),
        "required_level": required,
        "current_pujari_id": str(b["pujari_id"]) if b.get("pujari_id") else None,
        "distance_rings_km": rings,
        "matched_ring_km": matched_ring,
        "booking_has_coordinates": has_coords,
        "pujaris": filtered,
    }


@router.post("/bookings/{booking_id}/assign")
def assign_pujari_to_booking(
    booking_id: str,
    body: BookingAssignIn,
    admin=Depends(require_permission("manage_bookings")),
    db: Session = Depends(get_db),
):
    b = db.execute(
        text(
            """
            SELECT b.*, s.required_level
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            WHERE b.id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] in ("cancelled", "completed"):
        raise HTTPException(400, "Cannot assign pujari on a cancelled or completed booking")
    pujari = db.execute(
        text(
            """
            SELECT u.id, u.blocked, p.approved_level, p.verification_status, p.available, p.profile_complete
            FROM users u JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": body.pujari_id},
    ).mappings().first()
    if not pujari or pujari["blocked"]:
        raise HTTPException(400, "Pujari is blocked or not found")
    if pujari["verification_status"] != "approved" or not pujari["available"]:
        raise HTTPException(400, "Pujari is not verified/available")
    if not pujari.get("profile_complete"):
        raise HTTPException(400, "Pujari profile is incomplete")
    if int(pujari["approved_level"] or 0) < int(b["required_level"] or 1):
        raise HTTPException(400, "Pujari level is below service requirement")
    if slot_conflict(db, body.pujari_id, b["booking_date"], b["start_time"], b["end_time"]):
        if _booking_conflict_excluding(
            db, body.pujari_id, b["booking_date"], b["start_time"], b["end_time"], booking_id
        ):
            raise HTTPException(400, "Pujari has a conflicting booking")
    prev = str(b["pujari_id"]) if b.get("pujari_id") else None
    hist = b.get("assignment_history") or []
    if isinstance(hist, str):
        try:
            hist = json.loads(hist)
        except Exception:
            hist = []
    if not isinstance(hist, list):
        hist = []
    hist.append(
        {
            "from": prev,
            "to": body.pujari_id,
            "by": str(admin["id"]),
            "at": date.today().isoformat(),
            "prev_status": b.get("status"),
        }
    )
    db.execute(
        text(
            """
            UPDATE bookings SET
              pujari_id = CAST(:pid AS uuid),
              assignment_history = CAST(:hist AS jsonb),
              needs_reassignment = FALSE,
              rejection_reason = NULL
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"pid": body.pujari_id, "hist": json.dumps(hist), "id": booking_id},
    )
    # New assignee must accept again
    if b["status"] in ("rejected", "confirmed"):
        set_booking_status(db, booking_id, "pending_acceptance", actor_id=str(admin["id"]))
    elif b["status"] == "pending":
        set_booking_status(db, booking_id, "pending_acceptance", actor_id=str(admin["id"]))
    write_audit(
        db,
        str(admin["id"]),
        f"assign_pujari:{prev or 'none'}->{body.pujari_id}",
        "booking",
        booking_id,
    )
    db.commit()
    return {
        "ok": True,
        "booking_id": booking_id,
        "pujari_id": body.pujari_id,
        "previous_pujari_id": prev,
        "status": "pending_acceptance",
    }


@router.post("/pujaris/{pujari_id}/joining-fee/waive")
def waive_joining_fee(
    pujari_id: str,
    body: JoiningFeeWaiveIn | None = None,
    admin=Depends(require_permission("edit_pujaris")),
    db: Session = Depends(get_db),
):
    reason = (body.reason if body else None) or "waived by admin"
    row = db.execute(
        text("SELECT joining_fee_status FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": pujari_id},
    ).first()
    if not row:
        raise HTTPException(404, "Pujari not found")
    db.execute(
        text(
            """
            UPDATE pujari_profiles SET
              joining_fee_status = 'waived',
              joining_fee_waived_by = CAST(:aid AS uuid),
              joining_fee_waived_reason = :reason,
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"aid": admin["id"], "reason": reason, "id": pujari_id},
    )
    write_audit(db, str(admin["id"]), f"joining_fee_waived:{reason}", "pujari", pujari_id)
    db.commit()
    return {"ok": True, "joining_fee_status": "waived"}
