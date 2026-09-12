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
    subject: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
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
    item_key: str | None = None
    active: bool = True
    translations: dict[str, str] | None = None  # lang -> name


class SamagriTranslationIn(BaseModel):
    language_code: str
    item_name: str
    notes: str | None = None


class ServiceSamagriIn(BaseModel):
    samagri_item_id: str
    required: bool = True
    optional: bool = False
    customer_provided: bool = False
    instructions: str | None = None
    sort_order: int = 0
    quantity: float | None = None
    unit: str | None = None
    category: str = "PUJA_SAMAGRI"
    provided_by: str = "CUSTOMER"
    notes: str | None = None
    active: bool = True


class ServicePrepContentIn(BaseModel):
    language_code: str
    display_name: str | None = None
    short_description: str | None = None
    preparation_notes: str | None = None
    special_instructions: str | None = None
    prasadam_notes: str | None = None
    venue_notes: str | None = None
    disclaimer: str | None = None


class SamagriReviewIn(BaseModel):
    samagri_review_status: str  # UNVERIFIED | VERIFIED | NEEDS_REVIEW


class SettingIn(BaseModel):
    key: str
    value: object


class PermissionGrantIn(BaseModel):
    permissions: list[str]
    user_id: str | None = None  # optional; path param is authoritative


@router.post("/support/tickets")
def create_ticket(body: TicketIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.validation_rules import validate_support_text

    cats_c = {
        "Payments", "Wallet", "Bookings", "Others",
        "payments", "wallet", "bookings", "booking", "others",
    }
    cats_p = {
        "Settlement", "Route Map / Location", "Others", "Bookings",
        "settlement", "route", "others", "bookings", "booking",
    }
    role = user["role"]
    if role == "customer" and body.category not in cats_c:
        raise HTTPException(400, "Invalid category for customer")
    if role in ("pujari", "head_pujari") and body.category not in cats_p and body.category not in cats_c:
        raise HTTPException(400, "Invalid category for pujari")
    subject, description = validate_support_text(body.subject, body.description)
    num = f"TKT-{datetime.utcnow().strftime('%y%m%d')}-{uuid4().hex[:6].upper()}"
    tid = str(uuid4())
    params = {
        "id": tid,
        "n": num,
        "u": str(user["id"]),
        "r": role,
        "c": body.category,
        "subj": subject,
        "d": description,
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
              CAST(:b AS uuid), CAST(:setl AS uuid), CAST(:pay AS uuid), :subj, :d
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
    out = []
    for r in rows:
        d = row_dict(r)
        try:
            tr = db.execute(
                text(
                    """
                    SELECT language_code, item_name, notes
                    FROM samagri_item_translations
                    WHERE samagri_item_id = CAST(:id AS uuid)
                    """
                ),
                {"id": str(r["id"])},
            ).mappings().all()
            d["translations"] = {t["language_code"]: t["item_name"] for t in tr}
        except Exception:
            d["translations"] = {}
        out.append(d)
    return out


@router.post("/admin/samagri/items")
def create_samagri(body: SamagriItemIn, user=Depends(require_permission("manage_samagri")), db: Session = Depends(get_db)):
    iid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO samagri_items (id, name, description, unit, default_unit, item_key, active)
            VALUES (CAST(:id AS uuid), :n, :d, :u, :u, :k, :a)
            """
        ),
        {
            "id": iid,
            "n": body.name,
            "d": body.description,
            "u": body.unit,
            "k": body.item_key,
            "a": body.active,
        },
    )
    # Always seed English translation; optional hi/te from body.translations
    langs = {"en": body.name}
    if body.translations:
        langs.update({k: v for k, v in body.translations.items() if v})
    for lang, name in langs.items():
        try:
            db.execute(
                text(
                    """
                    INSERT INTO samagri_item_translations (samagri_item_id, language_code, item_name)
                    VALUES (CAST(:id AS uuid), :lang, :name)
                    ON CONFLICT (samagri_item_id, language_code) DO UPDATE SET item_name = EXCLUDED.item_name
                    """
                ),
                {"id": iid, "lang": lang, "name": name},
            )
        except Exception:
            break
    db.commit()
    return {"id": iid}


@router.put("/admin/samagri/items/{item_id}/translations")
def upsert_samagri_translation(
    item_id: str,
    body: SamagriTranslationIn,
    user=Depends(require_permission("manage_samagri")),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            INSERT INTO samagri_item_translations (samagri_item_id, language_code, item_name, notes)
            VALUES (CAST(:id AS uuid), :lang, :name, :notes)
            ON CONFLICT (samagri_item_id, language_code) DO UPDATE SET
              item_name = EXCLUDED.item_name, notes = EXCLUDED.notes
            """
        ),
        {"id": item_id, "lang": body.language_code, "name": body.item_name, "notes": body.notes},
    )
    db.commit()
    return {"ok": True}


@router.post("/admin/services/{service_id}/samagri")
def link_samagri(service_id: str, body: ServiceSamagriIn, user=Depends(require_permission("manage_samagri")), db: Session = Depends(get_db)):
    provided_by = (body.provided_by or "CUSTOMER").upper()
    customer_provided = body.customer_provided if body.customer_provided else provided_by == "CUSTOMER"
    db.execute(
        text(
            """
            INSERT INTO service_samagri (
              service_id, samagri_item_id, required, optional, customer_provided, instructions, sort_order,
              quantity, unit, category, provided_by, notes, active
            ) VALUES (
              CAST(:s AS uuid), CAST(:i AS uuid), :req, :opt, :cp, :ins, :ord,
              :qty, :unit, :cat, :prov, :notes, :act
            )
            ON CONFLICT (service_id, samagri_item_id) DO UPDATE SET
              required = EXCLUDED.required, optional = EXCLUDED.optional,
              customer_provided = EXCLUDED.customer_provided, instructions = EXCLUDED.instructions,
              sort_order = EXCLUDED.sort_order, quantity = EXCLUDED.quantity, unit = EXCLUDED.unit,
              category = EXCLUDED.category, provided_by = EXCLUDED.provided_by,
              notes = EXCLUDED.notes, active = EXCLUDED.active
            """
        ),
        {
            "s": service_id,
            "i": body.samagri_item_id,
            "req": body.required,
            "opt": body.optional,
            "cp": customer_provided,
            "ins": body.instructions,
            "ord": body.sort_order,
            "qty": body.quantity,
            "unit": body.unit,
            "cat": (body.category or "PUJA_SAMAGRI").upper(),
            "prov": provided_by,
            "notes": body.notes,
            "act": body.active,
        },
    )
    db.commit()
    return {"ok": True}


@router.get("/services/{service_id}/samagri")
def service_samagri(service_id: str, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT ss.*, si.name, si.unit AS item_unit, si.item_key, si.description AS item_description
            FROM service_samagri ss
            JOIN samagri_items si ON si.id = ss.samagri_item_id
            WHERE ss.service_id = CAST(:s AS uuid) AND si.active = TRUE
              AND COALESCE(ss.active, TRUE) = TRUE
            ORDER BY ss.sort_order, si.name
            """
        ),
        {"s": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/services/{service_id}/preparation")
def service_preparation_public(service_id: str, lang: str = "en", db: Session = Depends(get_db)):
    """Typical preparation preview — VERIFIED content only for customers."""
    from app.preparation import build_preparation_view, load_service_preparation_master, normalize_lang

    master = load_service_preparation_master(db, service_id, normalize_lang(lang))
    if not master.get("ok"):
        raise HTTPException(404, "Service not found")
    # Public: assume no package purchased → customer-arrange heavy view
    view = build_preparation_view(master, samagri_purchased=False, lang=normalize_lang(lang))
    view["review_status"] = (master.get("service") or {}).get("samagri_review_status")
    return view


@router.get("/admin/services/{service_id}/preparation-content")
def get_prep_content(service_id: str, user=Depends(require_permission("manage_samagri")), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM service_preparation_content WHERE service_id = CAST(:id AS uuid) ORDER BY language_code"),
        {"id": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.put("/admin/services/{service_id}/preparation-content")
def upsert_prep_content(
    service_id: str,
    body: ServicePrepContentIn,
    user=Depends(require_permission("manage_samagri")),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            INSERT INTO service_preparation_content (
              service_id, language_code, display_name, short_description,
              preparation_notes, special_instructions, prasadam_notes, venue_notes, disclaimer
            ) VALUES (
              CAST(:sid AS uuid), :lang, :dn, :sd, :pn, :si, :pr, :vn, :disc
            )
            ON CONFLICT (service_id, language_code) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              short_description = EXCLUDED.short_description,
              preparation_notes = EXCLUDED.preparation_notes,
              special_instructions = EXCLUDED.special_instructions,
              prasadam_notes = EXCLUDED.prasadam_notes,
              venue_notes = EXCLUDED.venue_notes,
              disclaimer = EXCLUDED.disclaimer,
              updated_at = NOW()
            """
        ),
        {
            "sid": service_id,
            "lang": body.language_code,
            "dn": body.display_name,
            "sd": body.short_description,
            "pn": body.preparation_notes,
            "si": body.special_instructions,
            "pr": body.prasadam_notes,
            "vn": body.venue_notes,
            "disc": body.disclaimer,
        },
    )
    db.commit()
    return {"ok": True}


@router.patch("/admin/services/{service_id}/samagri-review")
def set_samagri_review(
    service_id: str,
    body: SamagriReviewIn,
    user=Depends(require_permission("manage_samagri")),
    db: Session = Depends(get_db),
):
    st = (body.samagri_review_status or "").upper()
    if st not in ("UNVERIFIED", "VERIFIED", "NEEDS_REVIEW"):
        raise HTTPException(400, "Invalid review status")
    db.execute(
        text(
            """
            UPDATE services SET
              samagri_review_status = :st,
              samagri_last_reviewed_at = CASE WHEN :st = 'VERIFIED' THEN NOW() ELSE samagri_last_reviewed_at END,
              updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"st": st, "id": service_id},
    )
    db.commit()
    return {"ok": True, "samagri_review_status": st}


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
    code: str = Field(default="", max_length=40)
    referral_code: str | None = Field(default=None, max_length=40)

    def resolved_code(self) -> str:
        return (self.code or self.referral_code or "").strip()


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

    code = body.resolved_code()
    if not code:
        raise HTTPException(400, "Referral code is required")
    if len(code) < 3:
        raise HTTPException(400, "Referral code must be at least 3 characters")
    out = apply_referral_code(db, str(user["id"]), code)
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


def _resolve_pujari_user_id(db: Session, raw: str) -> str:
    """Accept UUID or email/phone/name lookup for head assessments."""
    from app.validation_rules import is_uuid

    key = (raw or "").strip()
    if not key:
        raise HTTPException(400, "Pujari user ID is required")
    if is_uuid(key):
        row = db.execute(
            text(
                """
                SELECT id FROM users
                WHERE id = CAST(:id AS uuid) AND role IN ('pujari', 'head_pujari')
                """
            ),
            {"id": key},
        ).mappings().first()
        if not row:
            raise HTTPException(404, "Pujari not found for that user ID")
        return str(row["id"])
    # Numeric legacy display ids are not used — look up by email/phone/name instead
    row = db.execute(
        text(
            """
            SELECT id FROM users
            WHERE role IN ('pujari', 'head_pujari')
              AND (
                lower(email) = lower(:q)
                OR phone = :q
                OR lower(name) = lower(:q)
              )
            ORDER BY created_at
            LIMIT 1
            """
        ),
        {"q": key},
    ).mappings().first()
    if not row:
        raise HTTPException(
            400,
            "Enter the pujari's UUID, email, or phone — numeric IDs like '2' are not supported",
        )
    return str(row["id"])


@router.get("/head/pujaris")
def list_pujaris_for_head(user=Depends(require_roles("head_pujari", "admin", "super_admin")), db: Session = Depends(get_db)):
    if user["role"] == "head_pujari":
        flag = db.execute(
            text("SELECT is_head_pujari FROM pujari_profiles WHERE user_id = CAST(:id AS uuid)"),
            {"id": user["id"]},
        ).scalar()
        if not flag:
            raise HTTPException(403, "Not a Head Pujari")
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.phone, pp.verification_status, pp.city
            FROM users u
            LEFT JOIN pujari_profiles pp ON pp.user_id = u.id
            WHERE u.role IN ('pujari', 'head_pujari') AND u.blocked = FALSE
            ORDER BY u.name
            LIMIT 500
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]


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
    pujari_id = _resolve_pujari_user_id(db, body.pujari_id)
    rid = str(uuid4())
    if body.booking_id:
        from app.validation_rules import is_uuid

        if not is_uuid(body.booking_id):
            raise HTTPException(400, "booking_id must be a valid UUID")
        db.execute(
            text(
                """
                INSERT INTO head_pujari_ratings (id, head_pujari_id, pujari_id, booking_id, stars, comments)
                VALUES (CAST(:id AS uuid), CAST(:h AS uuid), CAST(:p AS uuid), CAST(:b AS uuid), :s, :c)
                """
            ),
            {"id": rid, "h": user["id"], "p": pujari_id, "b": body.booking_id, "s": body.stars, "c": body.comments.strip()},
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO head_pujari_ratings (id, head_pujari_id, pujari_id, stars, comments)
                VALUES (CAST(:id AS uuid), CAST(:h AS uuid), CAST(:p AS uuid), :s, :c)
                """
            ),
            {"id": rid, "h": user["id"], "p": pujari_id, "s": body.stars, "c": body.comments.strip()},
        )
    db.commit()
    return {"id": rid, "ok": True, "pujari_id": pujari_id}


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
