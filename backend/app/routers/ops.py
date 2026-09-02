"""Support tickets, samagri, admin config, rewards listing."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import row_dict
from app.platform_config import get_all_settings, get_setting, set_setting
from app.rbac import ALL_PERMISSIONS, require_admin, require_permission, user_permissions

router = APIRouter(tags=["ops"])


class TicketIn(BaseModel):
    category: str
    subject: str = Field(min_length=3)
    description: str = Field(min_length=3)
    related_booking_id: str | None = None
    related_settlement_id: str | None = None
    related_payment_id: str | None = None


class TicketUpdateIn(BaseModel):
    status: str | None = None
    resolution: str | None = None
    assigned_admin_id: str | None = None


class SamagriItemIn(BaseModel):
    name: str
    description: str | None = None
    unit: str = "pcs"
    active: bool = True


class ServiceSamagriIn(BaseModel):
    samagri_item_id: str
    required: bool = True
    optional: bool = False
    customer_provided: bool = False
    instructions: str | None = None
    sort_order: int = 0


class SettingIn(BaseModel):
    key: str
    value: object


class PermissionGrantIn(BaseModel):
    permissions: list[str]
    user_id: str | None = None  # optional; path param is authoritative


@router.post("/support/tickets")
def create_ticket(body: TicketIn, user=Depends(current_user), db: Session = Depends(get_db)):
    cats_c = {
        "Payments", "Wallet", "Bookings", "Others",
        "payments", "wallet", "bookings", "booking", "others",
    }
    cats_p = {
        "Settlement", "Route Map / Location", "Others",
        "settlement", "route", "others", "bookings", "booking",
    }
    role = user["role"]
    if role == "customer" and body.category not in cats_c:
        raise HTTPException(400, "Invalid category for customer")
    if role == "pujari" and body.category not in cats_p and body.category not in cats_c:
        raise HTTPException(400, "Invalid category for pujari")
    num = f"TKT-{datetime.utcnow().strftime('%y%m%d')}-{uuid4().hex[:6].upper()}"
    tid = str(uuid4())
    params = {
        "id": tid,
        "n": num,
        "u": str(user["id"]),
        "r": role,
        "c": body.category,
        "subj": body.subject,
        "d": body.description,
        "b": body.related_booking_id,
        "setl": body.related_settlement_id,
        "pay": body.related_payment_id,
    }
    db.execute(
        text(
            """
            INSERT INTO support_tickets (
              id, ticket_number, user_id, user_role, category,
              related_booking_id, related_settlement_id, related_payment_id,
              subject, description
            ) VALUES (
              CAST(:id AS uuid), :n, CAST(:u AS uuid), :r, :c,
              :b::uuid, :setl::uuid, :pay::uuid, :subj, :d
            )
            """
        ),
        params,
    )
    db.commit()
    return {"id": tid, "ticket_number": num}


@router.get("/support/tickets")
def list_tickets(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] in ("admin", "super_admin"):
        rows = db.execute(text("SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 200")).mappings().all()
    else:
        rows = db.execute(
            text("SELECT * FROM support_tickets WHERE user_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
            {"id": user["id"]},
        ).mappings().all()
    return [row_dict(r) for r in rows]


@router.patch("/support/tickets/{ticket_id}")
def update_ticket(ticket_id: str, body: TicketUpdateIn, user=Depends(require_permission("manage_support")), db: Session = Depends(get_db)):
    t = db.execute(text("SELECT * FROM support_tickets WHERE id = CAST(:id AS uuid)"), {"id": ticket_id}).mappings().first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    db.execute(
        text(
            """
            UPDATE support_tickets SET
              status = COALESCE(:st, status),
              resolution = COALESCE(:res, resolution),
              assigned_admin_id = COALESCE(CAST(:aid AS uuid), assigned_admin_id),
              updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"st": body.status, "res": body.resolution, "aid": body.assigned_admin_id, "id": ticket_id},
    )
    db.commit()
    return {"ok": True}


@router.get("/samagri/items")
def list_samagri(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.execute(text("SELECT * FROM samagri_items WHERE active = TRUE ORDER BY name")).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/samagri/items")
def create_samagri(body: SamagriItemIn, user=Depends(require_permission("manage_samagri")), db: Session = Depends(get_db)):
    iid = str(uuid4())
    db.execute(
        text("INSERT INTO samagri_items (id, name, description, unit, active) VALUES (CAST(:id AS uuid), :n, :d, :u, :a)"),
        {"id": iid, "n": body.name, "d": body.description, "u": body.unit, "a": body.active},
    )
    db.commit()
    return {"id": iid}


@router.post("/admin/services/{service_id}/samagri")
def link_samagri(service_id: str, body: ServiceSamagriIn, user=Depends(require_permission("manage_samagri")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            INSERT INTO service_samagri (
              service_id, samagri_item_id, required, optional, customer_provided, instructions, sort_order
            ) VALUES (
              CAST(:s AS uuid), CAST(:i AS uuid), :req, :opt, :cp, :ins, :ord
            )
            ON CONFLICT (service_id, samagri_item_id) DO UPDATE SET
              required = EXCLUDED.required, optional = EXCLUDED.optional,
              customer_provided = EXCLUDED.customer_provided, instructions = EXCLUDED.instructions,
              sort_order = EXCLUDED.sort_order
            """
        ),
        {
            "s": service_id,
            "i": body.samagri_item_id,
            "req": body.required,
            "opt": body.optional,
            "cp": body.customer_provided,
            "ins": body.instructions,
            "ord": body.sort_order,
        },
    )
    db.commit()
    return {"ok": True}


@router.get("/services/{service_id}/samagri")
def service_samagri(service_id: str, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT ss.*, si.name, si.unit, si.description AS item_description
            FROM service_samagri ss
            JOIN samagri_items si ON si.id = ss.samagri_item_id
            WHERE ss.service_id = CAST(:s AS uuid) AND si.active = TRUE
            ORDER BY ss.sort_order, si.name
            """
        ),
        {"s": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/admin/config")
def admin_config(user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    return get_all_settings(db)


@router.put("/admin/config")
def update_config(body: SettingIn, user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    # Virtual Puja is a Super Admin feature flag only
    if body.key == "virtual_puja_enabled" and user.get("role") != "super_admin":
        raise HTTPException(403, "Only Super Admin can enable or disable Virtual Puja")
    set_setting(db, body.key, body.value, str(user["id"]))
    write_audit(db, str(user["id"]), "config_update", "platform_settings", body.key)
    db.commit()
    return {"ok": True, "key": body.key, "value": body.value}


@router.get("/admin/permissions/catalog")
def permission_catalog(user=Depends(require_admin)):
    return {"permissions": ALL_PERMISSIONS}


@router.get("/admin/me/permissions")
def my_permissions(user=Depends(require_admin), db: Session = Depends(get_db)):
    return {"role": user["role"], "permissions": user_permissions(db, user)}


@router.put("/admin/users/{user_id}/permissions")
def grant_permissions(user_id: str, body: PermissionGrantIn, user=Depends(require_permission("manage_admins")), db: Session = Depends(get_db)):
    target = db.execute(text("SELECT role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}).first()
    if not target or target[0] not in ("admin", "super_admin"):
        raise HTTPException(400, "Target must be admin")
    db.execute(text("DELETE FROM admin_permissions WHERE user_id = CAST(:id AS uuid)"), {"id": user_id})
    for p in body.permissions:
        if p not in ALL_PERMISSIONS:
            continue
        db.execute(
            text(
                """
                INSERT INTO admin_permissions (user_id, permission, granted_by)
                VALUES (CAST(:u AS uuid), :p, CAST(:g AS uuid))
                ON CONFLICT DO NOTHING
                """
            ),
            {"u": user_id, "p": p, "g": user["id"]},
        )
    write_audit(db, str(user["id"]), "permissions_grant", "user", user_id)
    db.commit()
    return {"ok": True}


@router.post("/admin/users/{user_id}/promote-super")
def promote_super(user_id: str, user=Depends(require_permission("manage_admins")), db: Session = Depends(get_db)):
    if user["role"] != "super_admin":
        # Allow first bootstrap: if no super_admin exists, admin can promote
        count = db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'super_admin'")).scalar() or 0
        if count > 0:
            raise HTTPException(403, "Only super_admin can promote")
    db.execute(text("UPDATE users SET role = 'super_admin' WHERE id = CAST(:id AS uuid) AND role IN ('admin','super_admin')"), {"id": user_id})
    write_audit(db, str(user["id"]), "promote_super_admin", "user", user_id)
    db.commit()
    return {"ok": True}


@router.get("/wallet/rewards")
def my_rewards(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM reward_ledger WHERE user_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
        {"id": user["id"]},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/invoices")
def my_invoices(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] in ("admin", "super_admin"):
        rows = db.execute(text("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 200")).mappings().all()
    else:
        rows = db.execute(
            text("SELECT * FROM invoices WHERE user_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
            {"id": user["id"]},
        ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM invoices WHERE id = CAST(:id AS uuid) OR invoice_number = :id"),
        {"id": invoice_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Invoice not found")
    if user["role"] not in ("admin", "super_admin") and str(row["user_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    return row_dict(row)


@router.get("/invoices/{invoice_id}/html")
def invoice_html(invoice_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    from fastapi.responses import HTMLResponse
    from app.invoice_docs import render_invoice_html

    row = db.execute(
        text("SELECT * FROM invoices WHERE id = CAST(:id AS uuid) OR invoice_number = :id"),
        {"id": invoice_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Invoice not found")
    if user["role"] not in ("admin", "super_admin") and str(row["user_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    return HTMLResponse(render_invoice_html(db, dict(row)))


class ReferralApplyIn(BaseModel):
    code: str = Field(min_length=3, max_length=40)


@router.get("/customer/referral-code")
def customer_referral_code(user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    from app.referrals import ensure_customer_referral_code

    code = ensure_customer_referral_code(db, str(user["id"]))
    db.commit()
    linked = db.execute(
        text("SELECT code, status, role_scope FROM referrals WHERE referee_id = CAST(:id AS uuid)"),
        {"id": user["id"]},
    ).mappings().first()
    return {
        "referral_code": code,
        "applied": row_dict(linked) if linked else None,
    }


@router.post("/referrals/apply")
def apply_referral(body: ReferralApplyIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.referrals import apply_referral_code

    out = apply_referral_code(db, str(user["id"]), body.code)
    db.commit()
    return out


@router.get("/admin/admins")
def list_admins(user=Depends(require_permission("manage_admins")), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, name, email, phone, role, created_at
            FROM users WHERE role IN ('admin', 'super_admin')
            ORDER BY role DESC, name
            """
        )
    ).mappings().all()
    out = []
    for r in rows:
        perms = user_permissions(db, dict(r))
        d = row_dict(r)
        d["permissions"] = perms
        out.append(d)
    return out


# --- Head Pujari ---

class HeadAssignIn(BaseModel):
    is_head_pujari: bool = True
    scope_cities: list[str] = []


class HeadRatingIn(BaseModel):
    pujari_id: str
    stars: int = Field(ge=1, le=5)
    comments: str = Field(min_length=5)
    booking_id: str | None = None


@router.post("/admin/pujaris/{pujari_id}/head")
def assign_head_pujari(pujari_id: str, body: HeadAssignIn, user=Depends(require_permission("approve_pujaris")), db: Session = Depends(get_db)):
    import json

    exists = db.execute(text("SELECT 1 FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"), {"id": pujari_id}).first()
    if not exists:
        raise HTTPException(404, "Pujari not found")
    db.execute(
        text(
            """
            UPDATE pujari_profiles
            SET is_head_pujari = :h, head_scope_cities = CAST(:c AS jsonb)
            WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"h": body.is_head_pujari, "c": json.dumps(body.scope_cities or []), "id": pujari_id},
    )
    if body.is_head_pujari:
        db.execute(text("UPDATE users SET role = 'head_pujari' WHERE id = CAST(:id AS uuid) AND role IN ('pujari','head_pujari')"), {"id": pujari_id})
        from app.referrals import ensure_pujari_referral_code

        ensure_pujari_referral_code(db, pujari_id)
    else:
        db.execute(text("UPDATE users SET role = 'pujari' WHERE id = CAST(:id AS uuid) AND role = 'head_pujari'"), {"id": pujari_id})
    write_audit(db, str(user["id"]), "assign_head_pujari", "pujari", pujari_id)
    db.commit()
    return {"ok": True, "is_head_pujari": body.is_head_pujari}


@router.post("/head/ratings")
def head_rate_pujari(body: HeadRatingIn, user=Depends(require_roles("head_pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    if user["role"] == "head_pujari":
        flag = db.execute(
            text("SELECT is_head_pujari FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
            {"id": user["id"]},
        ).scalar()
        if not flag:
            raise HTTPException(403, "Not a Head Pujari")
    if not body.comments or len(body.comments.strip()) < 5:
        raise HTTPException(400, "Comments are mandatory")
    rid = str(uuid4())
    if body.booking_id:
        db.execute(
            text(
                """
                INSERT INTO head_pujari_ratings (id, head_pujari_id, pujari_id, booking_id, stars, comments)
                VALUES (CAST(:id AS uuid), CAST(:h AS uuid), CAST(:p AS uuid), CAST(:b AS uuid), :s, :c)
                """
            ),
            {"id": rid, "h": user["id"], "p": body.pujari_id, "b": body.booking_id, "s": body.stars, "c": body.comments.strip()},
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO head_pujari_ratings (id, head_pujari_id, pujari_id, stars, comments)
                VALUES (CAST(:id AS uuid), CAST(:h AS uuid), CAST(:p AS uuid), :s, :c)
                """
            ),
            {"id": rid, "h": user["id"], "p": body.pujari_id, "s": body.stars, "c": body.comments.strip()},
        )
    db.commit()
    return {"id": rid, "ok": True}


@router.get("/head/ratings")
def list_head_ratings(user=Depends(require_roles("head_pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    if user["role"] in ("admin", "super_admin"):
        rows = db.execute(text("SELECT * FROM head_pujari_ratings ORDER BY created_at DESC LIMIT 300")).mappings().all()
    else:
        rows = db.execute(
            text("SELECT * FROM head_pujari_ratings WHERE head_pujari_id = CAST(:id AS uuid) ORDER BY created_at DESC"),
            {"id": user["id"]},
        ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/pujari/referral-code")
def my_referral_code(user=Depends(require_roles("pujari", "head_pujari")), db: Session = Depends(get_db)):
    from app.referrals import ensure_pujari_referral_code

    code = ensure_pujari_referral_code(db, str(user["id"]))
    db.commit()
    return {"referral_code": code}


class LocationPriceIn(BaseModel):
    service_id: str | None = None
    city: str
    area: str | None = None
    adjustment_paise: int = 0
    active: bool = True


class SurgeRuleIn(BaseModel):
    label: str = "Surge"
    service_id: str | None = None
    city: str | None = None
    percent_increase: float = 0
    fixed_paise: int = 0
    applies_weekend: bool | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    priority: int = 0
    active: bool = True


@router.get("/admin/location-prices")
def list_location_prices(user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM location_prices ORDER BY city")).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/location-prices")
def create_location_price(body: LocationPriceIn, user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    iid = str(uuid4())
    if body.service_id:
        db.execute(
            text(
                """
                INSERT INTO location_prices (id, service_id, city, area, adjustment_paise, active)
                VALUES (CAST(:id AS uuid), CAST(:s AS uuid), :c, :a, :adj, :act)
                """
            ),
            {"id": iid, "s": body.service_id, "c": body.city, "a": body.area, "adj": body.adjustment_paise, "act": body.active},
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO location_prices (id, city, area, adjustment_paise, active)
                VALUES (CAST(:id AS uuid), :c, :a, :adj, :act)
                """
            ),
            {"id": iid, "c": body.city, "a": body.area, "adj": body.adjustment_paise, "act": body.active},
        )
    db.commit()
    return {"id": iid}


@router.get("/admin/surge-rules")
def list_surge_rules(user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM surge_rules ORDER BY priority DESC")).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/surge-rules")
def create_surge_rule(body: SurgeRuleIn, user=Depends(require_permission("manage_config")), db: Session = Depends(get_db)):
    iid = str(uuid4())
    if body.service_id:
        db.execute(
            text(
                """
                INSERT INTO surge_rules (
                  id, label, service_id, city, percent_increase, fixed_paise, applies_weekend,
                  valid_from, valid_to, priority, active
                ) VALUES (
                  CAST(:id AS uuid), :l, CAST(:s AS uuid), :c, :pct, :fix, :w, :vf, :vt, :pr, :act
                )
                """
            ),
            {
                "id": iid, "l": body.label, "s": body.service_id, "c": body.city,
                "pct": body.percent_increase, "fix": body.fixed_paise, "w": body.applies_weekend,
                "vf": body.valid_from, "vt": body.valid_to, "pr": body.priority, "act": body.active,
            },
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO surge_rules (
                  id, label, city, percent_increase, fixed_paise, applies_weekend,
                  valid_from, valid_to, priority, active
                ) VALUES (
                  CAST(:id AS uuid), :l, :c, :pct, :fix, :w, :vf, :vt, :pr, :act
                )
                """
            ),
            {
                "id": iid, "l": body.label, "c": body.city,
                "pct": body.percent_increase, "fix": body.fixed_paise, "w": body.applies_weekend,
                "vf": body.valid_from, "vt": body.valid_to, "pr": body.priority, "act": body.active,
            },
        )
    db.commit()
    return {"id": iid}
