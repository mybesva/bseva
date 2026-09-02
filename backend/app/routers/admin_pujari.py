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
from app.db import get_db
from app.domain import row_dict, slot_conflict
from app.profile_utils import parse_json_list, pujari_completion
from app.rbac import require_any_permission, require_permission
from app.schemas import BookingAssignIn, PujariProfileIn
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
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.phone, p.approved_level, p.verification_status, p.available,
                   p.location_label, p.city, p.district, p.experience_years
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
    out = []
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
        out.append(item)
    return {
        "booking_id": booking_id,
        "booking_number": b.get("booking_number"),
        "required_level": required,
        "current_pujari_id": str(b["pujari_id"]) if b.get("pujari_id") else None,
        "pujaris": out,
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
    db.execute(
        text("UPDATE bookings SET pujari_id = CAST(:pid AS uuid) WHERE id = CAST(:id AS uuid)"),
        {"pid": body.pujari_id, "id": booking_id},
    )
    write_audit(
        db,
        str(admin["id"]),
        f"assign_pujari:{prev or 'none'}->{body.pujari_id}",
        "booking",
        booking_id,
    )
    db.commit()
    return {"ok": True, "booking_id": booking_id, "pujari_id": body.pujari_id, "previous_pujari_id": prev}
