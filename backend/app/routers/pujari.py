import json
import re
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.domain import row_dict
from app.schemas import DocumentMetaIn, PujariApplyLevelIn, PujariBlockDateIn, PujariProfileIn, PujariProfileSubmitIn
from app.profile_utils import (
    CURRENT_PRIVACY_VERSION,
    CURRENT_TERMS_VERSION,
    parse_json_list,
    pujari_completion,
    pujari_profile_status,
    utcnow,
)
from app.storage import content_type_for, file_response, upload_bytes

router = APIRouter(prefix="/pujari", tags=["pujari"])

ALLOWED_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
DOC_TYPES = {"certificate", "identity", "supporting"}


def _safe_name(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80] or "document"


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("certificate"),
    user=Depends(require_roles("pujari")),
    db: Session = Depends(get_db),
):
    if document_type not in DOC_TYPES:
        raise HTTPException(400, "Invalid document type")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Upload a PDF or image (JPG, PNG, WebP)")
    stored = f"{uuid4().hex}_{_safe_name(file.filename or 'document')}"
    rel = f"{user['id']}/{stored}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File must be under 8 MB")
    upload_bytes(rel, data, content_type_for(file.filename or stored))
    db.execute(
        text(
            """
            INSERT INTO pujari_documents (pujari_id, document_type, storage_path, status)
            VALUES (:pid, :typ, :path, 'uploaded')
            """
        ),
        {"pid": user["id"], "typ": document_type, "path": rel},
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM pujari_documents WHERE pujari_id = :id ORDER BY uploaded_at DESC LIMIT 1"),
        {"id": user["id"]},
    ).mappings().first()
    return {"ok": True, "document": row_dict(row)}


@router.post("/documents")
def register_document(body: DocumentMetaIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            INSERT INTO pujari_documents (pujari_id, document_type, storage_path, status)
            VALUES (:pid, :typ, :path, 'uploaded')
            """
        ),
        {"pid": user["id"], "typ": body.document_type, "path": body.storage_path},
    )
    db.commit()
    return {"ok": True}


@router.get("/documents")
def my_documents(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM pujari_documents WHERE pujari_id = :id ORDER BY uploaded_at DESC"),
        {"id": user["id"]},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/documents/{doc_id}/file")
def download_document(doc_id: str, user=Depends(require_roles("pujari", "admin")), db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM pujari_documents WHERE id = CAST(:id AS uuid)"),
        {"id": doc_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Document not found")
    if user["role"] != "admin" and str(row["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    return file_response(str(row["storage_path"]), filename=Path(str(row["storage_path"])).name)


@router.get("/storage-info")
def storage_info(user=Depends(require_roles("pujari", "admin"))):
    from app.config import settings
    from app.storage import storage_configured

    return {
        "bucket": settings.storage_bucket or "bseva",
        "backend": "supabase" if storage_configured() else "local",
        "upload_prefix": f"{user['id']}/",
    }


REQUIRED_PROFILE = (
    "full_name",
    "mobile_number",
    "date_of_birth",
    "qualifications",
    "qualification_year",
    "sampradaya",
    "profile_photo_path",
    "address_line1",
    "city",
    "latitude",
    "longitude",
)


def _parse_quals(raw) -> list:
    return parse_json_list(raw)


def _completion(row: dict) -> int:
    return pujari_completion(row)


def _profile_out(row: dict, user: dict, angikara=None) -> dict:
    d = row_dict(row)
    d["qualifications"] = _parse_quals(row.get("qualifications"))
    d["languages"] = parse_json_list(row.get("languages"))
    d["specializations"] = parse_json_list(row.get("specializations"))
    d["full_name"] = d.get("full_name") or user.get("name")
    d["mobile_number"] = d.get("mobile_number") or user.get("phone")
    merged = {**row, "qualifications": d["qualifications"], "full_name": d["full_name"], "mobile_number": d["mobile_number"]}
    pct = _completion(merged)
    d["profile_completion_percentage"] = pct
    d["profile_complete"] = pct >= 100
    d["profile_status"] = pujari_profile_status({**merged, "profile_completion_percentage": pct}, (angikara or {}).get("status"))
    d["angikara"] = angikara
    return d


def _load_profile(db: Session, user: dict):
    row = db.execute(text("SELECT * FROM pujari_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
    if not row:
        raise HTTPException(404, "Pujari profile not found")
    ang = db.execute(text("SELECT * FROM pujari_angikara WHERE pujari_id = :id"), {"id": user["id"]}).mappings().first()
    return _profile_out(dict(row), user, row_dict(ang) if ang else {"status": "not_started"})


@router.get("/profile")
def get_profile(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    return _load_profile(db, user)


@router.post("/apply-level")
def apply_level(body: PujariApplyLevelIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    """Pujari requests a service role (1–4). Admin must set approved_level; bookings still use approved_level only."""
    db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET requested_level = :lvl
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"lvl": body.requested_level, "id": user["id"]},
    )
    db.commit()
    return _load_profile(db, user)


@router.patch("/profile")
def patch_profile(body: PujariProfileIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
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
              gender = COALESCE(:gender, gender),
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
              onboarding_step = COALESCE(:step, onboarding_step),
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
            "full_name": body.full_name,
            "father_name": body.father_name,
            "gotra": body.gotra,
            "dob": body.date_of_birth,
            "gender": body.gender,
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
            "step": body.onboarding_step,
            "id": user["id"],
        },
    )
    if body.full_name:
        db.execute(text("UPDATE users SET name = :n WHERE id = CAST(:id AS uuid)"), {"n": body.full_name, "id": user["id"]})
    if body.mobile_number:
        db.execute(text("UPDATE users SET phone = :p WHERE id = CAST(:id AS uuid)"), {"p": body.mobile_number, "id": user["id"]})
    out = _load_profile(db, user)
    db.execute(
        text(
            """
            UPDATE pujari_profiles SET
              profile_complete = :c,
              profile_completion_percentage = :pct
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"c": out["profile_complete"], "pct": out["profile_completion_percentage"], "id": user["id"]},
    )
    ang = db.execute(text("SELECT status FROM pujari_angikara WHERE pujari_id = :id"), {"id": user["id"]}).first()
    if not ang:
        db.execute(text("INSERT INTO pujari_angikara (pujari_id, status) VALUES (:id, 'draft')"), {"id": user["id"]})
    elif ang[0] in ("not_started",):
        db.execute(text("UPDATE pujari_angikara SET status = 'draft', updated_at = NOW() WHERE pujari_id = :id"), {"id": user["id"]})
    db.commit()
    return _load_profile(db, user)


@router.post("/profile/submit")
def submit_profile(body: PujariProfileSubmitIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    if not body.final_submission_consent:
        raise HTTPException(400, "Final submission consent is required")
    profile = _load_profile(db, user)
    if not profile.get("profile_photo_path"):
        raise HTTPException(400, "Profile photo is required before submission")
    if profile.get("profile_completion_percentage", 0) < 100:
        raise HTTPException(400, "Please complete all required profile fields before submission")
    docs = db.execute(
        text("SELECT document_type FROM pujari_documents WHERE pujari_id = :id"),
        {"id": user["id"]},
    ).mappings().all()
    types = {d["document_type"] for d in docs}
    if not types.intersection({"identity", "certificate"}):
        raise HTTPException(400, "Upload identity and professional documents before submission")
    db.execute(
        text(
            """
            UPDATE pujari_profiles SET
              final_submission_consent = TRUE,
              final_submission_consent_at = NOW(),
              profile_submitted_at = NOW(),
              verification_status = 'under_review',
              onboarding_step = 6,
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"id": user["id"]},
    )
    db.commit()
    return _load_profile(db, user)


async def _store_asset(user_id: str, file: UploadFile, stem: str) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(400, "Upload a JPG, PNG or WebP image")
    stored = f"{stem}{ext}"
    rel = f"{user_id}/{stored}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File must be under 8 MB")
    upload_bytes(rel, data, content_type_for(file.filename or stored))
    return rel


@router.post("/profile/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    rel = await _store_asset(str(user["id"]), file, "profile")
    db.execute(text("UPDATE pujari_profiles SET profile_photo_path = :p WHERE user_id = CAST(:id AS uuid)"), {"p": rel, "id": user["id"]})
    db.commit()
    return _load_profile(db, user)


@router.delete("/profile/photo")
def delete_photo(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    db.execute(text("UPDATE pujari_profiles SET profile_photo_path = NULL WHERE user_id = CAST(:id AS uuid)"), {"id": user["id"]})
    db.commit()
    return _load_profile(db, user)


@router.post("/profile/signature")
async def upload_signature(file: UploadFile = File(...), user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    rel = await _store_asset(str(user["id"]), file, "signature")
    db.execute(text("UPDATE pujari_profiles SET signature_path = :p WHERE user_id = CAST(:id AS uuid)"), {"p": rel, "id": user["id"]})
    db.commit()
    return _load_profile(db, user)


@router.get("/profile/file/{kind}")
def profile_file(kind: str, user=Depends(require_roles("pujari", "admin")), db: Session = Depends(get_db)):
    col = "profile_photo_path" if kind == "photo" else "signature_path"
    if kind not in ("photo", "signature"):
        raise HTTPException(404, "Not found")
    row = db.execute(text(f"SELECT {col} AS p FROM pujari_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
    if not row or not row["p"]:
        raise HTTPException(404, "File missing")
    return file_response(str(row["p"]), filename=Path(str(row["p"])).name)


@router.get("/angikara")
def get_angikara(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    profile = _load_profile(db, user)
    return {"profile": profile, "document": profile.get("angikara")}


@router.post("/angikara/submit")
def submit_angikara(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    profile = _load_profile(db, user)
    if profile["profile_completion_percentage"] < 100:
        raise HTTPException(400, "Complete your profile before submitting Angikara Patram")
    if not profile.get("website_publication_consent"):
        raise HTTPException(400, "Website publication consent is required to submit")
    if not profile.get("signature_path"):
        raise HTTPException(400, "Signature is required to submit")
    snap = json.dumps({k: profile.get(k) for k in (
        "full_name", "father_name", "gotra", "date_of_birth", "native_place",
        "permanent_address", "present_address", "mobile_number", "whatsapp_number",
        "qualifications", "qualification_year", "sampradaya", "website_publication_consent",
        "profile_photo_path", "signature_path",
    )})
    existing = db.execute(text("SELECT status FROM pujari_angikara WHERE pujari_id = :id"), {"id": user["id"]}).first()
    if existing:
        db.execute(
            text("UPDATE pujari_angikara SET status = 'submitted', snapshot = CAST(:s AS jsonb), submitted_at = NOW(), updated_at = NOW() WHERE pujari_id = :id"),
            {"s": snap, "id": user["id"]},
        )
    else:
        db.execute(
            text("INSERT INTO pujari_angikara (pujari_id, status, snapshot, submitted_at) VALUES (:id, 'submitted', CAST(:s AS jsonb), NOW())"),
            {"id": user["id"], "s": snap},
        )
    ver = db.execute(text("SELECT COALESCE(MAX(version_number), 0) FROM pujari_document_versions WHERE pujari_id = :id"), {"id": user["id"]}).scalar() or 0
    db.execute(
        text("INSERT INTO pujari_document_versions (pujari_id, document_type, version_number, snapshot) VALUES (:id, 'ANGIKARA_PATRAM', :v, CAST(:s AS jsonb))"),
        {"id": user["id"], "v": int(ver) + 1, "s": snap},
    )
    db.commit()
    return _load_profile(db, user)


@router.get("/availability/blocks")
def list_blocked_dates(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, blocked_date, reason, created_at
            FROM pujari_blocked_dates
            WHERE pujari_id = CAST(:id AS uuid)
            ORDER BY blocked_date ASC
            """
        ),
        {"id": user["id"]},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/availability/blocks")
def block_date(body: PujariBlockDateIn, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    if body.blocked_date < date.today():
        raise HTTPException(400, "Cannot block past dates")
    db.execute(
        text(
            """
            INSERT INTO pujari_blocked_dates (pujari_id, blocked_date, reason)
            VALUES (CAST(:pid AS uuid), :d, :reason)
            ON CONFLICT (pujari_id, blocked_date)
            DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW()
            """
        ),
        {"pid": user["id"], "d": body.blocked_date, "reason": body.reason},
    )
    db.commit()
    row = db.execute(
        text(
            """
            SELECT id, blocked_date, reason, created_at
            FROM pujari_blocked_dates
            WHERE pujari_id = CAST(:id AS uuid) AND blocked_date = :d
            """
        ),
        {"id": user["id"], "d": body.blocked_date},
    ).mappings().first()
    return row_dict(row)


@router.delete("/availability/blocks/{block_id}")
def unblock_date(block_id: str, user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    res = db.execute(
        text(
            """
            DELETE FROM pujari_blocked_dates
            WHERE id = CAST(:bid AS uuid) AND pujari_id = CAST(:pid AS uuid)
            RETURNING id
            """
        ),
        {"bid": block_id, "pid": user["id"]},
    ).first()
    if not res:
        raise HTTPException(404, "Blocked date not found")
    db.commit()
    return {"ok": True}


@router.get("/official-documents")
def official_documents(user=Depends(require_roles("pujari")), db: Session = Depends(get_db)):
    profile = _load_profile(db, user)
    ang = profile.get("angikara") or {"status": "not_started"}
    return [
        {
            "document_type": "ANGIKARA_PATRAM",
            "document_name": "Angikara Patram",
            "status": ang.get("status") or "not_started",
            "submitted_at": ang.get("submitted_at"),
            "created_at": ang.get("created_at"),
            "updated_at": ang.get("updated_at"),
        }
    ]
