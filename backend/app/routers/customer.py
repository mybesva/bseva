from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.domain import row_dict
from app.schemas import CustomerAddressIn, CustomerAddressPatchIn, CustomerProfileIn
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
    from app.validation_rules import validate_address_fields

    touching_core_address = any(
        v is not None
        for v in (body.address_line1, body.city, body.state, body.pincode, body.district, body.address_line2)
    )
    addr = {}
    if touching_core_address:
        addr = validate_address_fields(
            address_line1=body.address_line1,
            address_line2=body.address_line2,
            city=body.city,
            district=body.district,
            state=body.state,
            pincode=body.pincode,
            require_all=True,
        )
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
              gstin = CASE WHEN CAST(:gstin_set AS boolean) THEN NULLIF(:gstin, '') ELSE gstin END,
              updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
            "a1": addr.get("address_line1", body.address_line1),
            "a2": addr.get("address_line2", body.address_line2),
            "city": addr.get("city", body.city),
            "district": addr.get("district", body.district),
            "state": addr.get("state", body.state),
            "pincode": addr.get("pincode", body.pincode),
            "country": body.country,
            "loc": body.location_label,
            "lat": body.latitude,
            "lng": body.longitude,
            "addr": _format_address(body) if any([body.address_line1, body.city]) else None,
            "lang": body.preferred_language,
            "cal": body.calendar_preference,
            "gstin_set": body.gstin is not None,
            "gstin": (body.gstin or "").strip().upper(),
            "id": user["id"],
        },
    )
    db.commit()
    return _load_profile(db, user)


def _format_address(body: CustomerProfileIn) -> str:
    parts = [body.address_line1, body.address_line2, body.city, body.district, body.state, body.pincode, body.country or "India"]
    return ", ".join(p for p in parts if p)


def _infer_image_ext(raw_name: str, content_type: str, data: bytes) -> str:
    ext = Path(raw_name).suffix.lower()
    ctype = (content_type or "").lower().split(";")[0].strip()
    ctype_ext = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/pjpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    if ext not in ALLOWED_IMG:
        ext = ctype_ext.get(ctype, "")
    if ext not in ALLOWED_IMG:
        if data[:3] == b"\xff\xd8\xff":
            ext = ".jpg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n":
            ext = ".png"
        elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            ext = ".webp"
    if ext == ".jpeg":
        ext = ".jpg"
    if ext not in ALLOWED_IMG:
        raise HTTPException(400, "Upload a JPG, PNG or WebP image")
    return ext


@router.post("/profile/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file — choose a photo and try again")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "File must be under 5 MB")
    ext = _infer_image_ext(file.filename or "", file.content_type or "", data)
    rel = f"{user['id']}/customer_photo{ext}"
    upload_bytes(rel, data, content_type_for(file.filename or rel))
    result = db.execute(
        text("UPDATE customer_profiles SET profile_photo_path = :p, updated_at = NOW() WHERE user_id = CAST(:id AS uuid)"),
        {"p": rel, "id": user["id"]},
    )
    if result.rowcount == 0:
        db.execute(
            text(
                """
                INSERT INTO customer_profiles (user_id, profile_photo_path, preferred_language, calendar_preference, country, updated_at)
                VALUES (CAST(:id AS uuid), :p, :lang, :cal, 'India', NOW())
                """
            ),
            {
                "id": user["id"],
                "p": rel,
                "lang": user.get("preferred_language") or "en",
                "cal": user.get("calendar_preference") or "north",
            },
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


def _normalize_addr_field(raw) -> str:
    import re

    return re.sub(r"\s+", " ", str(raw or "").strip().lower())


def _addresses_match(a: dict, b: dict) -> bool:
    fields = ("address_line1", "address_line2", "city", "district", "state", "pincode")
    for field in fields:
        if _normalize_addr_field(a.get(field)) != _normalize_addr_field(b.get(field)):
            return False
    if _normalize_addr_field(a.get("country") or "india") != _normalize_addr_field(b.get("country") or "india"):
        return False
    lat_a, lng_a = a.get("latitude"), a.get("longitude")
    lat_b, lng_b = b.get("latitude"), b.get("longitude")
    if lat_a is not None and lng_a is not None and lat_b is not None and lng_b is not None:
        try:
            if abs(float(lat_a) - float(lat_b)) > 0.0001 or abs(float(lng_a) - float(lng_b)) > 0.0001:
                return False
        except (TypeError, ValueError):
            pass
    return True


def _format_address_parts(**parts) -> str:
    ordered = [
        parts.get("address_line1"),
        parts.get("address_line2"),
        parts.get("city"),
        parts.get("district"),
        parts.get("state"),
        parts.get("pincode"),
        parts.get("country") or "India",
    ]
    return ", ".join(p for p in ordered if p)


def _address_row(row: dict) -> dict:
    d = row_dict(dict(row))
    d["id"] = str(d["id"])
    return d


def _list_addresses(db: Session, user_id: str) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT * FROM customer_addresses
            WHERE user_id = CAST(:id AS uuid)
            ORDER BY created_at ASC, id ASC
            """
        ),
        {"id": user_id},
    ).mappings().all()
    return [_address_row(r) for r in rows]


def _migrate_profile_address_if_needed(db: Session, user_id: str) -> None:
    existing = db.execute(
        text("SELECT 1 FROM customer_addresses WHERE user_id = CAST(:id AS uuid) LIMIT 1"),
        {"id": user_id},
    ).first()
    if existing:
        return
    profile = db.execute(
        text("SELECT * FROM customer_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not profile:
        return
    p = dict(profile)
    has_address = any(
        str(p.get(k) or "").strip()
        for k in ("address_line1", "city", "address", "location_label")
    ) or (p.get("latitude") is not None and p.get("longitude") is not None)
    if not has_address:
        return
    db.execute(
        text(
            """
            INSERT INTO customer_addresses (
              user_id, label, address_line1, address_line2, city, district, state, pincode, country,
              location_label, latitude, longitude, address, created_at, updated_at
            ) VALUES (
              CAST(:uid AS uuid), NULL, :a1, :a2, :city, :district, :state, :pincode, :country,
              :loc, :lat, :lng, :addr, NOW(), NOW()
            )
            """
        ),
        {
            "uid": user_id,
            "a1": p.get("address_line1"),
            "a2": p.get("address_line2"),
            "city": p.get("city"),
            "district": p.get("district"),
            "state": p.get("state"),
            "pincode": p.get("pincode"),
            "country": p.get("country") or "India",
            "loc": p.get("location_label"),
            "lat": p.get("latitude"),
            "lng": p.get("longitude"),
            "addr": p.get("address"),
        },
    )


def _sync_profile_primary_address(db: Session, user_id: str) -> None:
    row = db.execute(
        text(
            """
            SELECT * FROM customer_addresses
            WHERE user_id = CAST(:id AS uuid)
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """
        ),
        {"id": user_id},
    ).mappings().first()
    if not row:
        db.execute(
            text(
                """
                UPDATE customer_profiles SET
                  address_line1 = NULL, address_line2 = NULL, city = NULL, district = NULL,
                  state = NULL, pincode = NULL, location_label = NULL, latitude = NULL,
                  longitude = NULL, address = NULL, updated_at = NOW()
                WHERE user_id = CAST(:id AS uuid)
                """
            ),
            {"id": user_id},
        )
        return
    d = dict(row)
    db.execute(
        text(
            """
            UPDATE customer_profiles SET
              address_line1 = :a1, address_line2 = :a2, city = :city, district = :district,
              state = :state, pincode = :pincode, country = :country, location_label = :loc,
              latitude = :lat, longitude = :lng, address = :addr, updated_at = NOW()
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
            "a1": d.get("address_line1"),
            "a2": d.get("address_line2"),
            "city": d.get("city"),
            "district": d.get("district"),
            "state": d.get("state"),
            "pincode": d.get("pincode"),
            "country": d.get("country") or "India",
            "loc": d.get("location_label"),
            "lat": d.get("latitude"),
            "lng": d.get("longitude"),
            "addr": d.get("address"),
            "id": user_id,
        },
    )


def _get_owned_address(db: Session, user_id: str, address_id: str) -> dict:
    row = db.execute(
        text(
            """
            SELECT * FROM customer_addresses
            WHERE id = CAST(:aid AS uuid) AND user_id = CAST(:uid AS uuid)
            """
        ),
        {"aid": address_id, "uid": user_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Address not found")
    return _address_row(dict(row))


@router.get("/addresses")
def list_addresses(user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    _migrate_profile_address_if_needed(db, user["id"])
    db.commit()
    return _list_addresses(db, user["id"])


@router.post("/addresses")
def create_address(body: CustomerAddressIn, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    from app.validation_rules import validate_address_fields

    has_coords = body.latitude is not None and body.longitude is not None
    has_pincode = bool(str(body.pincode or "").strip())
    addr = validate_address_fields(
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        district=body.district or body.city,
        state=body.state,
        pincode=body.pincode,
        require_all=True,
        require_pincode=has_pincode or not has_coords,
    )
    if not has_coords:
        raise HTTPException(400, "Map location (latitude and longitude) is required")
    label = (body.label or "").strip() or None
    flat = _format_address_parts(
        address_line1=addr.get("address_line1", body.address_line1),
        address_line2=addr.get("address_line2", body.address_line2),
        city=addr.get("city", body.city),
        district=addr.get("district", body.district),
        state=addr.get("state", body.state),
        pincode=addr.get("pincode", body.pincode),
        country=body.country or "India",
    )
    candidate = {
        "address_line1": addr.get("address_line1", body.address_line1),
        "address_line2": addr.get("address_line2", body.address_line2),
        "city": addr.get("city", body.city),
        "district": addr.get("district", body.district),
        "state": addr.get("state", body.state),
        "pincode": addr.get("pincode", body.pincode),
        "country": body.country or "India",
        "latitude": body.latitude,
        "longitude": body.longitude,
    }
    for existing in _list_addresses(db, user["id"]):
        if _addresses_match(existing, candidate):
            return existing
    loc_label = (body.location_label or "").strip() or flat
    row = db.execute(
        text(
            """
            INSERT INTO customer_addresses (
              user_id, label, address_line1, address_line2, city, district, state, pincode, country,
              location_label, latitude, longitude, address
            ) VALUES (
              CAST(:uid AS uuid), :label, :a1, :a2, :city, :district, :state, :pincode, :country,
              :loc, :lat, :lng, :addr
            )
            RETURNING *
            """
        ),
        {
            "uid": user["id"],
            "label": label,
            "a1": candidate["address_line1"],
            "a2": candidate["address_line2"],
            "city": candidate["city"],
            "district": candidate["district"],
            "state": candidate["state"],
            "pincode": candidate["pincode"],
            "country": candidate["country"],
            "loc": loc_label,
            "lat": body.latitude,
            "lng": body.longitude,
            "addr": flat,
        },
    ).mappings().first()
    _sync_profile_primary_address(db, user["id"])
    db.commit()
    return _address_row(dict(row))


@router.patch("/addresses/{address_id}")
def patch_address(
    address_id: str,
    body: CustomerAddressPatchIn,
    user=Depends(require_roles("customer")),
    db: Session = Depends(get_db),
):
    from app.validation_rules import validate_address_fields

    current = _get_owned_address(db, user["id"], address_id)
    touching_core = any(
        v is not None
        for v in (body.address_line1, body.city, body.state, body.pincode, body.district, body.address_line2)
    )
    addr = {}
    if touching_core:
        addr = validate_address_fields(
            address_line1=body.address_line1 if body.address_line1 is not None else current.get("address_line1"),
            address_line2=body.address_line2 if body.address_line2 is not None else current.get("address_line2"),
            city=body.city if body.city is not None else current.get("city"),
            district=body.district if body.district is not None else current.get("district"),
            state=body.state if body.state is not None else current.get("state"),
            pincode=body.pincode if body.pincode is not None else current.get("pincode"),
            require_all=True,
        )
    merged = {
        "address_line1": addr.get("address_line1", body.address_line1 if body.address_line1 is not None else current.get("address_line1")),
        "address_line2": addr.get("address_line2", body.address_line2 if body.address_line2 is not None else current.get("address_line2")),
        "city": addr.get("city", body.city if body.city is not None else current.get("city")),
        "district": addr.get("district", body.district if body.district is not None else current.get("district")),
        "state": addr.get("state", body.state if body.state is not None else current.get("state")),
        "pincode": addr.get("pincode", body.pincode if body.pincode is not None else current.get("pincode")),
        "country": body.country if body.country is not None else current.get("country") or "India",
        "latitude": body.latitude if body.latitude is not None else current.get("latitude"),
        "longitude": body.longitude if body.longitude is not None else current.get("longitude"),
    }
    label = current.get("label")
    if body.label is not None:
        label = (body.label or "").strip() or None
    flat = _format_address_parts(**merged)
    loc_label = (
        (body.location_label or "").strip()
        or (current.get("location_label") or "").strip()
        or flat
    )
    row = db.execute(
        text(
            """
            UPDATE customer_addresses SET
              label = :label,
              address_line1 = :a1,
              address_line2 = :a2,
              city = :city,
              district = :district,
              state = :state,
              pincode = :pincode,
              country = :country,
              location_label = :loc,
              latitude = :lat,
              longitude = :lng,
              address = :addr,
              updated_at = NOW()
            WHERE id = CAST(:aid AS uuid) AND user_id = CAST(:uid AS uuid)
            RETURNING *
            """
        ),
        {
            "aid": address_id,
            "uid": user["id"],
            "label": label,
            "a1": merged["address_line1"],
            "a2": merged["address_line2"],
            "city": merged["city"],
            "district": merged["district"],
            "state": merged["state"],
            "pincode": merged["pincode"],
            "country": merged["country"],
            "loc": loc_label,
            "lat": merged["latitude"],
            "lng": merged["longitude"],
            "addr": flat,
        },
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Address not found")
    _sync_profile_primary_address(db, user["id"])
    db.commit()
    return _address_row(dict(row))


@router.delete("/addresses/{address_id}")
def delete_address(address_id: str, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            DELETE FROM customer_addresses
            WHERE id = CAST(:aid AS uuid) AND user_id = CAST(:uid AS uuid)
            """
        ),
        {"aid": address_id, "uid": user["id"]},
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Address not found")
    _sync_profile_primary_address(db, user["id"])
    db.commit()
    return {"ok": True}
