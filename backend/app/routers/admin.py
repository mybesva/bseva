from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.domain import row_dict
from app.schemas import (
    AdminUserIn,
    BlockIn,
    LegalPolicyUpdateIn,
    PricingIn,
    PujariLevelIn,
    PujariRoleIn,
    PujariRoleUpdateIn,
    ServiceIn,
    VerifyPujariIn,
)
from app.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    customers = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'customer'")).scalar() or 0
    pujaris = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'pujari' AND blocked = FALSE")).scalar() or 0
    bookings = db.execute(text("SELECT COUNT(*) FROM bookings")).scalar() or 0
    revenue = db.execute(text("SELECT COALESCE(SUM(total_paise),0) FROM bookings WHERE status <> 'cancelled'")).scalar() or 0
    return {
        "totalCustomers": int(customers),
        "activePriests": int(pujaris),
        "totalBookings": int(bookings),
        "monthlyRevenue": int(revenue),
    }


@router.get("/users")
def list_users(role: str | None = None, blocked: bool | None = None, q: str | None = None, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    sql = "SELECT id, name, email, phone, role, blocked, blocked_at, block_reason, created_at FROM users WHERE 1=1"
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
def block_user(user_id: str, body: BlockIn, admin=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if str(admin["id"]) == user_id:
        raise HTTPException(400, "You cannot block your own account")
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
def create_user(body: AdminUserIn, admin=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    from uuid import uuid4

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
        db.execute(
            text(
                """
                INSERT INTO pujari_profiles (user_id, requested_level, approved_level, verification_status, location_label)
                VALUES (CAST(:id AS uuid), :lvl, :lvl, 'approved', :loc)
                """
            ),
            {"id": user_id, "lvl": body.requested_level or 2, "loc": body.location},
        )
    db.commit()
    return {"ok": True, "id": user_id}


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
def list_pujaris(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.phone, u.blocked, u.blocked_at, u.block_reason,
                   p.requested_level, p.approved_level, p.verification_status, p.available, p.location_label
            FROM users u JOIN pujari_profiles p ON p.user_id = u.id
            ORDER BY u.created_at DESC
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/pujaris/{pujari_id}/verify")
def verify_pujari(pujari_id: str, body: VerifyPujariIn, admin=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET verification_status = :st,
                approved_level = COALESCE(:lvl, approved_level)
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"st": body.verification_status, "lvl": body.approved_level, "id": pujari_id},
    )
    db.execute(
        text("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (:a, 'verify_pujari', 'pujari', :e)"),
        {"a": admin["id"], "e": pujari_id},
    )
    db.commit()
    return {"ok": True}


@router.post("/pujaris/{pujari_id}/level")
def set_pujari_level(pujari_id: str, body: PujariLevelIn, admin=Depends(require_roles("admin")), db: Session = Depends(get_db)):
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
def admin_services(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return [row_dict(r) for r in db.execute(text("SELECT * FROM services ORDER BY name")).mappings().all()]


@router.post("/services")
def create_service(body: ServiceIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            INSERT INTO services (name, slug, description, required_level, standard_price_paise, premium_price_paise, duration_minutes, virtual_available, active)
            VALUES (:name, :slug, :desc, :lvl, :std, :prm, :dur, :virt, :act)
            """
        ),
        {
            "name": body.name,
            "slug": body.slug,
            "desc": body.description,
            "lvl": body.required_level,
            "std": body.standard_price_paise,
            "prm": body.premium_price_paise,
            "dur": body.duration_minutes,
            "virt": body.virtual_available,
            "act": body.active,
        },
    )
    db.commit()
    return {"ok": True}


@router.put("/services/{service_id}")
def update_service(service_id: str, body: ServiceIn, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            UPDATE services SET name=:name, slug=:slug, description=:desc, required_level=:lvl,
              standard_price_paise=:std, premium_price_paise=:prm, duration_minutes=:dur,
              virtual_available=:virt, active=:act
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "name": body.name,
            "slug": body.slug,
            "desc": body.description,
            "lvl": body.required_level,
            "std": body.standard_price_paise,
            "prm": body.premium_price_paise,
            "dur": body.duration_minutes,
            "virt": body.virtual_available,
            "act": body.active,
            "id": service_id,
        },
    )
    db.commit()
    return {"ok": True}


@router.delete("/services/{service_id}")
def delete_service(service_id: str, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
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
def list_docs(pujari_id: str, user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM pujari_documents WHERE pujari_id = CAST(:id AS uuid) ORDER BY uploaded_at DESC"),
        {"id": pujari_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]
