from datetime import datetime, timezone
from pathlib import Path
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.domain import row_dict
from app.rbac import require_any_permission, require_permission
from app.schemas import (
    AdminCustomerUpdateIn,
    AdminUserIn,
    BlockIn,
    LegalPolicyUpdateIn,
    PricingIn,
    PujariLevelIn,
    PujariRoleIn,
    PujariRoleUpdateIn,
    ServiceCategoryIn,
    ServiceIn,
    VerifyPujariIn,
)
from app.security import hash_password
from app.storage import content_type_for, delete_object, file_response, upload_bytes

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    customers = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'customer'")).scalar() or 0
    pujaris = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'pujari' AND blocked = FALSE")).scalar() or 0
    bookings = db.execute(text("SELECT COUNT(*) FROM bookings")).scalar() or 0
    revenue = db.execute(text("SELECT COALESCE(SUM(total_paise),0) FROM bookings WHERE status <> 'cancelled'")).scalar() or 0
    pending_v = db.execute(text("SELECT COUNT(*) FROM pujari_profiles WHERE verification_status IN ('pending','under_review')")).scalar() or 0
    correction = db.execute(text("SELECT COUNT(*) FROM pujari_profiles WHERE verification_status = 'correction_required'")).scalar() or 0
    rejected = db.execute(text("SELECT COUNT(*) FROM pujari_profiles WHERE verification_status = 'rejected'")).scalar() or 0
    blocked_p = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'pujari' AND blocked = TRUE")).scalar() or 0
    approved = db.execute(text("SELECT COUNT(*) FROM pujari_profiles WHERE verification_status = 'approved'")).scalar() or 0
    return {
        "totalCustomers": int(customers),
        "activePriests": int(pujaris),
        "totalBookings": int(bookings),
        "monthlyRevenue": int(revenue),
        "pujariStatus": {
            "active": int(approved),
            "pendingVerification": int(pending_v),
            "correctionRequired": int(correction),
            "rejected": int(rejected),
            "blocked": int(blocked_p),
        },
    }


@router.get("/users")
def list_users(
    role: str | None = None,
    blocked: bool | None = None,
    q: str | None = None,
    user=Depends(require_any_permission("view_customers", "view_pujaris", "manage_admins")),
    db: Session = Depends(get_db),
):
    sql = "SELECT id, name, email, phone, role, blocked, blocked_at, block_reason, created_at, preferred_language FROM users WHERE 1=1"
    params: dict = {}
    if role:
        sql += " AND role = :role"
        params["role"] = role
    if blocked is not None:
        sql += " AND blocked = :blocked"
        params["blocked"] = blocked
    if q:
        sql += " AND (name ILIKE :q OR email ILIKE :q OR phone ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY created_at DESC"
    return [row_dict(r) for r in db.execute(text(sql), params).mappings().all()]


@router.post("/users/{user_id}/block")
def block_user(user_id: str, body: BlockIn, admin=Depends(require_any_permission("block_pujaris", "edit_customers")), db: Session = Depends(get_db)):
    if str(admin["id"]) == user_id:
        raise HTTPException(400, "You cannot block your own account")
    target = db.execute(text("SELECT role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}).first()
    if not target:
        raise HTTPException(404, "User not found")
    if target[0] in ("pujari", "head_pujari"):
        # block_pujaris required — already satisfied by require_any if only edit_customers
        from app.rbac import is_super_admin, user_permissions

        if not is_super_admin(admin) and "block_pujaris" not in user_permissions(db, admin):
            raise HTTPException(403, "Missing permission: block_pujaris")
    db.execute(
        text(
            """
            UPDATE users SET blocked = :b, blocked_at = :at, blocked_by = :by, block_reason = :reason
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "b": body.blocked,
            "at": datetime.now(timezone.utc) if body.blocked else None,
            "by": admin["id"] if body.blocked else None,
            "reason": body.reason if body.blocked else None,
            "id": user_id,
        },
    )
    db.execute(
        text("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (:a, :act, 'user', :e)"),
        {"a": admin["id"], "act": "block" if body.blocked else "unblock", "e": user_id},
    )
    db.commit()
    return {"ok": True}


@router.post("/users")
def create_user(body: AdminUserIn, admin=Depends(require_any_permission("create_customers", "create_pujaris")), db: Session = Depends(get_db)):
    from uuid import uuid4

    from app.rbac import is_super_admin, user_permissions

    perms = user_permissions(db, admin) if not is_super_admin(admin) else None
    if body.role == "customer" and perms is not None and "create_customers" not in perms:
        raise HTTPException(403, "Missing permission: create_customers")
    if body.role == "pujari" and perms is not None and "create_pujaris" not in perms:
        raise HTTPException(403, "Missing permission: create_pujaris")

    existing = db.execute(
        text("SELECT id FROM users WHERE email = :e OR phone = :p"),
        {"e": str(body.email), "p": body.phone},
    ).first()
    if existing:
        raise HTTPException(400, "Email or phone already registered")
    user_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, calendar_preference, phone_verified)
            VALUES (CAST(:id AS uuid), :name, :email, :phone, :pw, :role, 'en', 'north', TRUE)
            """
        ),
        {
            "id": user_id,
            "name": body.name,
            "email": str(body.email),
            "phone": body.phone,
            "pw": hash_password(body.password),
            "role": body.role,
        },
    )
    db.execute(text("INSERT INTO wallets (user_id) VALUES (CAST(:id AS uuid))"), {"id": user_id})
    if body.role == "customer":
        db.execute(
            text("INSERT INTO customer_profiles (user_id, location_label) VALUES (CAST(:id AS uuid), :loc)"),
            {"id": user_id, "loc": body.location},
        )
    else:
        # Complete later → pending + incomplete. Complete now → under_review for admin to finish & verify.
        vstatus = "under_review" if body.complete_profile_now else "pending"
        db.execute(
            text(
                """
                INSERT INTO pujari_profiles (
                  user_id, requested_level, approved_level, verification_status,
                  location_label, full_name, mobile_number, profile_complete, available
                )
                VALUES (
                  CAST(:id AS uuid), :lvl, NULL, :st,
                  :loc, :name, :phone, FALSE, FALSE
                )
                """
            ),
            {
                "id": user_id,
                "lvl": body.requested_level or 2,
                "st": vstatus,
                "loc": body.location,
                "name": body.name,
                "phone": body.phone,
            },
        )
    db.commit()
    return {
        "ok": True,
        "id": user_id,
        "complete_profile_now": bool(body.complete_profile_now) if body.role == "pujari" else None,
        "profile_incomplete": body.role == "pujari",
    }


@router.put("/users/{user_id}/customer")
def update_customer(
    user_id: str,
    body: AdminCustomerUpdateIn,
    admin=Depends(require_permission("edit_customers")),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT role FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).first()
    if not row or row[0] != "customer":
        raise HTTPException(404, "Customer not found")
    if body.email:
        clash = db.execute(
            text("SELECT id FROM users WHERE email = :e AND id <> CAST(:id AS uuid)"),
            {"e": str(body.email), "id": user_id},
        ).first()
        if clash:
            raise HTTPException(400, "Email already in use")
    if body.phone:
        clash = db.execute(
            text("SELECT id FROM users WHERE phone = :p AND id <> CAST(:id AS uuid)"),
            {"p": body.phone, "id": user_id},
        ).first()
        if clash:
            raise HTTPException(400, "Phone already in use")
    db.execute(
        text(
            """
            UPDATE users SET
              name = COALESCE(:name, name),
              email = COALESCE(:email, email),
              phone = COALESCE(:phone, phone),
              preferred_language = COALESCE(:lang, preferred_language)
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "name": body.name,
            "email": str(body.email) if body.email else None,
            "phone": body.phone,
            "lang": body.preferred_language,
            "id": user_id,
        },
    )
    if body.preferred_language:
        db.execute(
            text(
                """
                UPDATE customer_profiles SET preferred_language = :lang
                WHERE user_id = CAST(:id AS uuid)
                """
            ),
            {"lang": body.preferred_language, "id": user_id},
        )
    if body.location is not None:
        db.execute(
            text(
                """
                UPDATE customer_profiles SET location_label = :loc
                WHERE user_id = CAST(:id AS uuid)
                """
            ),
            {"loc": body.location, "id": user_id},
        )
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if str(admin["id"]) == user_id:
        raise HTTPException(400, "You cannot delete your own account")
    row = db.execute(text("SELECT role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}).first()
    if not row:
        raise HTTPException(404, "User not found")
    if row[0] == "admin":
        raise HTTPException(400, "Cannot delete an admin")
    n = db.execute(text("SELECT COUNT(*) FROM bookings WHERE customer_id = CAST(:id AS uuid)"), {"id": user_id}).scalar() or 0
    if n:
        raise HTTPException(400, "This customer has bookings. Block the account instead of deleting.")
    db.execute(text("UPDATE users SET blocked_by = NULL WHERE blocked_by = CAST(:id AS uuid)"), {"id": user_id})
    db.execute(text("UPDATE bookings SET pujari_id = NULL WHERE pujari_id = CAST(:id AS uuid)"), {"id": user_id})
    db.execute(text("DELETE FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id})
    db.commit()
    return {"ok": True}


@router.get("/pujaris")
def list_pujaris(
    status: str | None = None,
    blocked: bool | None = None,
    q: str | None = None,
    user=Depends(require_any_permission("view_pujaris", "verify_pujaris")),
    db: Session = Depends(get_db),
):
    sql = """
            SELECT u.id, u.name, u.email, u.phone, u.role, u.blocked, u.blocked_at, u.block_reason,
                   p.requested_level, p.approved_level, p.verification_status, p.available, p.location_label,
                   p.experience_years, p.specializations, p.pravara, p.joining_fee_status,
                   COALESCE(p.is_head_pujari, FALSE) AS is_head_pujari,
                   COALESCE(p.profile_complete, FALSE) AS profile_complete,
                   COALESCE(p.profile_completion_percentage, 0) AS profile_completion_percentage
            FROM users u JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.role IN ('pujari', 'head_pujari')
            """
    params: dict = {}
    st = (status or "").strip().lower()
    if st in ("blocked",):
        sql += " AND u.blocked = TRUE"
    elif st in ("approved", "active"):
        sql += " AND u.blocked = FALSE AND p.verification_status = 'approved'"
    elif st in ("pending", "pending_verification"):
        sql += " AND u.blocked = FALSE AND p.verification_status IN ('pending', 'under_review')"
    elif st in ("correction_required", "correction"):
        sql += " AND u.blocked = FALSE AND p.verification_status = 'correction_required'"
    elif st == "rejected":
        sql += " AND u.blocked = FALSE AND p.verification_status = 'rejected'"
    elif blocked is not None:
        sql += " AND u.blocked = :blocked"
        params["blocked"] = blocked
    if q:
        sql += " AND (u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY u.created_at DESC"
    rows = db.execute(text(sql), params).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/pujaris/{pujari_id}/verify")
def verify_pujari(pujari_id: str, body: VerifyPujariIn, admin=Depends(require_permission("verify_pujaris")), db: Session = Depends(get_db)):
    exists = db.execute(
        text("SELECT profile_complete, verification_status FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": pujari_id},
    ).mappings().first()
    if not exists:
        raise HTTPException(404, "Pujari not found")
    if body.verification_status == "approved" and not exists.get("profile_complete"):
        raise HTTPException(400, "Cannot approve — pujari profile is incomplete")
    db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET verification_status = :st,
                approved_level = COALESCE(:lvl, approved_level),
                rejection_reason = COALESCE(:rr, rejection_reason),
                available = CASE WHEN :st = 'approved' THEN TRUE ELSE available END
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {
            "st": body.verification_status,
            "lvl": body.approved_level,
            "rr": body.rejection_reason,
            "id": pujari_id,
        },
    )
    db.execute(
        text("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (:a, :act, 'pujari', :e)"),
        {"a": admin["id"], "act": f"verify_pujari:{body.verification_status}", "e": pujari_id},
    )
    db.commit()
    return {"ok": True}


@router.post("/pujaris/{pujari_id}/level")
def set_pujari_level(pujari_id: str, body: PujariLevelIn, admin=Depends(require_any_permission("approve_pujaris", "verify_pujaris", "edit_pujaris")), db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET approved_level = :lvl
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"lvl": body.approved_level, "id": pujari_id},
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Pujari not found")
    db.execute(
        text("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (:a, 'set_pujari_level', 'pujari', :e)"),
        {"a": admin["id"], "e": pujari_id},
    )
    db.commit()
    return {"ok": True, "approved_level": body.approved_level}


@router.get("/services")
def admin_services(user=Depends(require_permission("manage_services")), db: Session = Depends(get_db)):
    from app.catalog import enrich_service

    rows = db.execute(
        text("SELECT * FROM services ORDER BY display_order NULLS LAST, name")
    ).mappings().all()
    try:
        return [enrich_service(db, r, include_inactive_meta=True) for r in rows]
    except Exception:
        return [row_dict(r) for r in rows]


def _sync_service_categories(db: Session, service_id: str, category_slugs: list[str] | None) -> None:
    if category_slugs is None:
        return
    db.execute(
        text("DELETE FROM service_category_map WHERE service_id = CAST(:id AS uuid)"),
        {"id": service_id},
    )
    for slug in category_slugs:
        row = db.execute(
            text("SELECT id FROM service_categories WHERE slug = :s"),
            {"s": slug},
        ).first()
        if not row:
            continue
        db.execute(
            text(
                """
                INSERT INTO service_category_map (service_id, category_id)
                VALUES (CAST(:sid AS uuid), CAST(:cid AS uuid))
                ON CONFLICT DO NOTHING
                """
            ),
            {"sid": service_id, "cid": str(row[0])},
        )


def _pricing_status(body: ServiceIn) -> str:
    if body.pricing_status:
        return body.pricing_status
    if body.standard_price_paise is None:
        return "awaiting_pricing"
    return "priced"


@router.post("/services")
def create_service(body: ServiceIn, user=Depends(require_permission("manage_services")), db: Session = Depends(get_db)):
    import json
    from uuid import uuid4

    main = body.main_puja_price_paise
    if main is None:
        main = body.standard_price_paise
    pst = _pricing_status(body)
    active = bool(body.active) and pst == "priced" and body.standard_price_paise is not None
    sid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO services (
              id, name, slug, description, short_description, full_description, benefits, local_name,
              category, required_level,
              standard_price_paise, premium_price_paise, main_puja_price_paise,
              samagri_price_paise, alankaram_price_paise, food_price_paise,
              samagri_provider, alankaram_provider, food_provider,
              muhurta_consultation_enabled, muhurta_fee_paise, requires_muhurta,
              duration_minutes, pujaris_required, virtual_available, active,
              samagri_available, alankaram_available, food_available,
              image_path, image_url, search_aliases,
              is_popular, is_featured_home, is_seasonal, display_order, homepage_rank, pricing_status
            ) VALUES (
              CAST(:id AS uuid), :name, :slug, :desc, :short, :full, :ben, :local,
              :cat, :lvl,
              :std, :prm, :main,
              :sam, :alan, :food,
              :samp, :alanp, :foodp,
              :muh_en, :muh_fee, :req_muh,
              :dur, :pujn, :virt, :act,
              :sam_av, :alan_av, :food_av,
              :img_p, :img_u, CAST(:aliases AS jsonb),
              :pop, :feat, :season, :ord, :rank, :pst
            )
            """
        ),
        {
            "id": sid,
            "name": body.name,
            "slug": body.slug,
            "desc": body.description,
            "short": body.short_description,
            "full": body.full_description,
            "ben": body.benefits,
            "local": body.local_name,
            "cat": body.category or "puja",
            "lvl": body.required_level,
            "std": body.standard_price_paise,
            "prm": body.premium_price_paise,
            "main": main,
            "sam": body.samagri_price_paise or 0,
            "alan": body.alankaram_price_paise or 0,
            "food": body.food_price_paise or 0,
            "samp": body.samagri_provider or "included",
            "alanp": body.alankaram_provider or "included",
            "foodp": body.food_provider or "included",
            "muh_en": bool(body.muhurta_consultation_enabled),
            "muh_fee": body.muhurta_fee_paise,
            "req_muh": bool(body.requires_muhurta),
            "dur": body.duration_minutes,
            "pujn": body.pujaris_required or 1,
            "virt": body.virtual_available,
            "act": active,
            "sam_av": bool(body.samagri_available) if body.samagri_available is not None else True,
            "alan_av": bool(body.alankaram_available),
            "food_av": bool(body.food_available),
            "img_p": body.image_path,
            "img_u": body.image_url,
            "aliases": json.dumps(body.search_aliases or []),
            "pop": bool(body.is_popular),
            "feat": bool(body.is_featured_home),
            "season": bool(body.is_seasonal),
            "ord": body.display_order if body.display_order is not None else 1000,
            "rank": body.homepage_rank,
            "pst": pst,
        },
    )
    _sync_service_categories(db, sid, body.category_slugs)
    db.commit()
    return {"ok": True, "id": sid}


@router.put("/services/{service_id}")
def update_service(service_id: str, body: ServiceIn, user=Depends(require_permission("manage_services")), db: Session = Depends(get_db)):
    import json

    main = body.main_puja_price_paise
    if main is None:
        main = body.standard_price_paise
    pst = _pricing_status(body)
    # Admin can activate only when priced
    active = bool(body.active)
    if active and (body.standard_price_paise is None or pst == "awaiting_pricing"):
        raise HTTPException(400, "Set pricing before activating this service")
    result = db.execute(
        text(
            """
            UPDATE services SET name=:name, slug=:slug, description=:desc,
              short_description=:short, full_description=:full, benefits=:ben, local_name=:local,
              category=:cat, required_level=:lvl,
              standard_price_paise=:std, premium_price_paise=:prm, main_puja_price_paise=:main,
              samagri_price_paise=:sam, alankaram_price_paise=:alan, food_price_paise=:food,
              samagri_provider=:samp, alankaram_provider=:alanp, food_provider=:foodp,
              muhurta_consultation_enabled=:muh_en, muhurta_fee_paise=:muh_fee, requires_muhurta=:req_muh,
              duration_minutes=:dur, pujaris_required=:pujn, virtual_available=:virt, active=:act,
              samagri_available=:sam_av, alankaram_available=:alan_av, food_available=:food_av,
              image_path=:img_p, image_url=:img_u, search_aliases=CAST(:aliases AS jsonb),
              is_popular=:pop, is_featured_home=:feat, is_seasonal=:season,
              display_order=:ord, homepage_rank=:rank, pricing_status=:pst,
              samagri_review_status=COALESCE(:srev, samagri_review_status),
              updated_at=NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "name": body.name,
            "slug": body.slug,
            "desc": body.description,
            "short": body.short_description,
            "full": body.full_description,
            "ben": body.benefits,
            "local": body.local_name,
            "cat": body.category or "puja",
            "lvl": body.required_level,
            "std": body.standard_price_paise,
            "prm": body.premium_price_paise,
            "main": main,
            "sam": body.samagri_price_paise or 0,
            "alan": body.alankaram_price_paise or 0,
            "food": body.food_price_paise or 0,
            "samp": body.samagri_provider or "included",
            "alanp": body.alankaram_provider or "included",
            "foodp": body.food_provider or "included",
            "muh_en": bool(body.muhurta_consultation_enabled),
            "muh_fee": body.muhurta_fee_paise,
            "req_muh": bool(body.requires_muhurta),
            "dur": body.duration_minutes,
            "pujn": body.pujaris_required or 1,
            "virt": body.virtual_available,
            "act": active,
            "sam_av": bool(body.samagri_available) if body.samagri_available is not None else True,
            "alan_av": bool(body.alankaram_available),
            "food_av": bool(body.food_available),
            "img_p": body.image_path,
            "img_u": body.image_url,
            "aliases": json.dumps(body.search_aliases or []),
            "pop": bool(body.is_popular),
            "feat": bool(body.is_featured_home),
            "season": bool(body.is_seasonal),
            "ord": body.display_order if body.display_order is not None else 1000,
            "rank": body.homepage_rank,
            "pst": pst,
            "srev": body.samagri_review_status,
            "id": service_id,
        },
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Service not found")
    _sync_service_categories(db, service_id, body.category_slugs)
    db.commit()
    return {"ok": True}


@router.post("/services/{service_id}/image")
async def upload_service_image(
    service_id: str,
    file: UploadFile = File(...),
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT id, slug, image_path FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": service_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Service not found")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8MB")
    name = file.filename or "cover.jpg"
    ext = Path(name).suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(400, "Use jpg, png, webp, or gif")
    rel = f"services/{service_id}/cover{ext}"
    # Drop previous storage objects for this service (any extension)
    prev = (row.get("image_path") or "").strip()
    if prev.startswith("services/"):
        try:
            delete_object(prev)
        except Exception:
            pass
    # Also try common cover extensions left from prior uploads
    for old_ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        old = f"services/{service_id}/cover{old_ext}"
        if old != rel and old != prev:
            try:
                delete_object(old)
            except Exception:
                pass
    upload_bytes(rel, data, content_type_for(name))
    # Bust browser cache after replace
    public_url = f"/api/v1/services/{row['slug']}/image?v={int(time.time())}"
    db.execute(
        text(
            """
            UPDATE services
            SET image_path = :p, image_url = :u, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"p": rel, "u": f"/api/v1/services/{row['slug']}/image", "id": service_id},
    )
    db.commit()
    return {
        "ok": True,
        "image_path": rel,
        "image_url": f"/api/v1/services/{row['slug']}/image",
        "preview_url": public_url,
    }


@router.delete("/services/{service_id}/image")
def remove_service_image(
    service_id: str,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT image_path FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": service_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Service not found")
    prev = (row.get("image_path") or "").strip()
    if prev.startswith("services/"):
        try:
            delete_object(prev)
        except Exception:
            pass
    db.execute(
        text(
            """
            UPDATE services
            SET image_path = NULL, image_url = NULL, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": service_id},
    )
    db.commit()
    return {"ok": True}


@router.get("/service-categories")
def admin_list_categories(user=Depends(require_permission("manage_services")), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM service_categories ORDER BY sort_order, name")
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/service-categories")
def admin_create_category(
    body: ServiceCategoryIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            INSERT INTO service_categories (slug, name, description, sort_order, active)
            VALUES (:slug, :name, :desc, :ord, :act)
            """
        ),
        {
            "slug": body.slug,
            "name": body.name,
            "desc": body.description,
            "ord": body.sort_order,
            "act": body.active,
        },
    )
    db.commit()
    return {"ok": True}


@router.put("/service-categories/{category_id}")
def admin_update_category(
    category_id: str,
    body: ServiceCategoryIn,
    user=Depends(require_permission("manage_services")),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            UPDATE service_categories SET
              slug=:slug, name=:name, description=:desc, sort_order=:ord, active=:act, updated_at=NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "slug": body.slug,
            "name": body.name,
            "desc": body.description,
            "ord": body.sort_order,
            "act": body.active,
            "id": category_id,
        },
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Category not found")
    db.commit()
    return {"ok": True}


@router.delete("/services/{service_id}")
def delete_service(service_id: str, user=Depends(require_permission("manage_services")), db: Session = Depends(get_db)):
    n = db.execute(text("SELECT COUNT(*) FROM bookings WHERE service_id = CAST(:id AS uuid)"), {"id": service_id}).scalar() or 0
    if n:
        db.execute(text("UPDATE services SET active = FALSE WHERE id = CAST(:id AS uuid)"), {"id": service_id})
        db.commit()
        return {"ok": True, "deactivated": True}
    db.execute(text("DELETE FROM services WHERE id = CAST(:id AS uuid)"), {"id": service_id})
    db.commit()
    return {"ok": True}


@router.get("/pricing")
def get_pricing(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return row_dict(db.execute(text("SELECT * FROM pricing_config WHERE id = 1")).mappings().one())


@router.put("/pricing")
def update_pricing(body: PricingIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    db.execute(
        text("UPDATE pricing_config SET gst_percent = :g, peak_day_fee_paise = :p, updated_at = NOW() WHERE id = 1"),
        {"g": body.gst_percent, "p": body.peak_day_fee_paise},
    )
    db.commit()
    return {"ok": True}


def _serialize_pujari_role(row) -> dict:
    data = row_dict(row)
    examples = data.get("examples") or []
    if isinstance(examples, str):
        import json

        examples = json.loads(examples)
    data["examples"] = examples
    return data


@router.get("/pujari-roles")
def list_pujari_roles_admin(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM pujari_roles ORDER BY level ASC")).mappings().all()
    return [_serialize_pujari_role(r) for r in rows]


@router.post("/pujari-roles")
def create_pujari_role(body: PujariRoleIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    import json
    from uuid import uuid4

    next_level = db.execute(text("SELECT COALESCE(MAX(level), 0) + 1 FROM pujari_roles")).scalar() or 1
    role_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO pujari_roles (id, level, title, summary, examples)
            VALUES (CAST(:id AS uuid), :level, :title, :summary, CAST(:examples AS jsonb))
            """
        ),
        {
            "id": role_id,
            "level": next_level,
            "title": body.title,
            "summary": body.summary,
            "examples": json.dumps(body.examples or []),
        },
    )
    db.commit()
    row = db.execute(text("SELECT * FROM pujari_roles WHERE id = CAST(:id AS uuid)"), {"id": role_id}).mappings().one()
    return _serialize_pujari_role(row)


@router.put("/pujari-roles/{role_id}")
def update_pujari_role(role_id: str, body: PujariRoleUpdateIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    import json

    existing = db.execute(text("SELECT * FROM pujari_roles WHERE id = CAST(:id AS uuid)"), {"id": role_id}).mappings().first()
    if not existing:
        raise HTTPException(404, "Role not found")
    title = body.title if body.title is not None else existing["title"]
    summary = body.summary if body.summary is not None else existing["summary"]
    examples = body.examples if body.examples is not None else (existing["examples"] or [])
    db.execute(
        text(
            """
            UPDATE pujari_roles
            SET title = :title, summary = :summary, examples = CAST(:examples AS jsonb), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": role_id, "title": title, "summary": summary, "examples": json.dumps(examples)},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM pujari_roles WHERE id = CAST(:id AS uuid)"), {"id": role_id}).mappings().one()
    return _serialize_pujari_role(row)


@router.delete("/pujari-roles/{role_id}")
def delete_pujari_role(role_id: str, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    row = db.execute(text("SELECT level FROM pujari_roles WHERE id = CAST(:id AS uuid)"), {"id": role_id}).mappings().first()
    if not row:
        raise HTTPException(404, "Role not found")
    level = row["level"]
    in_use = db.execute(
        text(
            """
            SELECT COUNT(*) FROM pujari_profiles
            WHERE approved_level = :lvl OR requested_level = :lvl
            """
        ),
        {"lvl": level},
    ).scalar() or 0
    if in_use:
        raise HTTPException(400, "Cannot delete — pujaris are assigned to this role level")
    svc_use = db.execute(text("SELECT COUNT(*) FROM services WHERE required_level = :lvl"), {"lvl": level}).scalar() or 0
    if svc_use:
        raise HTTPException(400, "Cannot delete — services require this role level")
    db.execute(text("DELETE FROM pujari_roles WHERE id = CAST(:id AS uuid)"), {"id": role_id})
    db.commit()
    return {"ok": True}


def _serialize_legal_policy(row) -> dict:
    data = row_dict(row)
    points = data.get("points") or []
    if isinstance(points, str):
        import json

        points = json.loads(points)
    data["points"] = points
    return data


@router.get("/legal")
def list_legal_policies(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM legal_policies ORDER BY sort_order ASC, title ASC")).mappings().all()
    return [_serialize_legal_policy(r) for r in rows]


@router.put("/legal/{slug}")
def update_legal_policy(slug: str, body: LegalPolicyUpdateIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    import json

    existing = db.execute(text("SELECT * FROM legal_policies WHERE slug = :slug"), {"slug": slug}).mappings().first()
    if not existing:
        raise HTTPException(404, "Policy not found")
    title = body.title if body.title is not None else existing["title"]
    version = body.version if body.version is not None else existing["version"]
    points = [{"title": p.title.strip(), "body": p.body.strip()} for p in body.points if p.body.strip()]
    db.execute(
        text(
            """
            UPDATE legal_policies
            SET title = :title, version = :version, points = CAST(:points AS jsonb), updated_at = NOW()
            WHERE slug = :slug
            """
        ),
        {"slug": slug, "title": title, "version": version, "points": json.dumps(points)},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM legal_policies WHERE slug = :slug"), {"slug": slug}).mappings().one()
    return _serialize_legal_policy(row)


@router.get("/documents/{pujari_id}")
def list_docs(pujari_id: str, user=Depends(require_any_permission("view_pujaris", "verify_pujaris", "edit_pujaris")), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM pujari_documents WHERE pujari_id = CAST(:id AS uuid) ORDER BY uploaded_at DESC"),
        {"id": pujari_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]
