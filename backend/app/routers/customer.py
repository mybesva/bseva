from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.domain import row_dict
from app.schemas import CustomerProfileIn
from app.storage import content_type_for, file_response, upload_bytes

router = APIRouter(prefix="/customer", tags=["customer"])

ALLOWED_IMG = {".png", ".jpg", ".jpeg", ".webp"}


def _load_profile(db: Session, user: dict):
    row = db.execute(text("SELECT * FROM customer_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
    if not row:
        raise HTTPException(404, "Customer profile not found")
    d = row_dict(dict(row))
    d["name"] = user.get("name")
    d["email"] = user.get("email")
    d["phone"] = user.get("phone")
    return d


@router.get("/profile")
def get_profile(user=Depends(require_roles("customer", "admin")), db: Session = Depends(get_db)):
    if user["role"] == "admin":
        raise HTTPException(403, "Use admin endpoints")
    return _load_profile(db, user)


@router.patch("/profile")
def patch_profile(body: CustomerProfileIn, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    # When updating address fields, district is mandatory
    touching_address = any(
        v is not None
        for v in (body.address_line1, body.city, body.state, body.pincode, body.district, body.location_label)
    )
    if touching_address:
        if body.district is not None:
            if not str(body.district).strip():
                raise HTTPException(400, "District is required")
        else:
            existing = db.execute(
                text("SELECT district FROM customer_profiles WHERE user_id = CAST(:id AS uuid)"),
                {"id": user["id"]},
            ).scalar()
            if not (existing and str(existing).strip()):
                raise HTTPException(400, "District is required")
    db.execute(
        text(
            """
            UPDATE customer_profiles SET
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
              address = COALESCE(:addr, address),
              preferred_language = COALESCE(:lang, preferred_language),
              calendar_preference = COALESCE(:cal, calendar_preference),
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
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
            "addr": _format_address(body) if any([body.address_line1, body.city]) else None,
            "lang": body.preferred_language,
            "cal": body.calendar_preference,
            "id": user["id"],
        },
    )
    db.commit()
    return _load_profile(db, user)


def _format_address(body: CustomerProfileIn) -> str:
    parts = [body.address_line1, body.address_line2, body.city, body.district, body.state, body.pincode, body.country or "India"]
    return ", ".join(p for p in parts if p)


@router.post("/profile/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMG:
        raise HTTPException(400, "Upload a JPG, PNG or WebP image")
    rel = f"{user['id']}/customer_photo{ext}"
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "File must be under 5 MB")
    upload_bytes(rel, data, content_type_for(file.filename or rel))
    db.execute(
        text("UPDATE customer_profiles SET profile_photo_path = :p, updated_at = NOW() WHERE user_id = CAST(:id AS uuid)"),
        {"p": rel, "id": user["id"]},
    )
    db.commit()
    return _load_profile(db, user)


@router.get("/profile/photo")
def get_photo(user=Depends(require_roles("customer", "admin")), db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT profile_photo_path FROM customer_profiles WHERE user_id = :id"),
        {"id": user["id"]},
    ).mappings().first()
    if not row or not row["profile_photo_path"]:
        raise HTTPException(404, "No photo")
    return file_response(str(row["profile_photo_path"]))


@router.delete("/profile/photo")
def delete_photo(user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    db.execute(
        text("UPDATE customer_profiles SET profile_photo_path = NULL, updated_at = NOW() WHERE user_id = CAST(:id AS uuid)"),
        {"id": user["id"]},
    )
    db.commit()
    return _load_profile(db, user)
