"""RBAC for the back office: super_admin (unrestricted) and admin (permission-scoped).

Single source of truth for:
  * the Admin-assignable permission catalogue (grouped, human-readable),
  * Super-Admin-only capabilities (finance, reports, platform config, admin management),
  * effective-permission resolution from the database (never from the client),
  * FastAPI guards used by every protected endpoint.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user

# --------------------------------------------------------------------------------------------
# Catalogue: permissions a Super Admin may assign to a normal Admin, grouped for the UI.
# Every key maps to real routes/actions (see docs in the Admin Permissions page and the
# guards below); nothing here is decorative.
# --------------------------------------------------------------------------------------------
PERMISSION_GROUPS: list[dict] = [
    {"key": "customers", "label": "Customers", "permissions": [
        ("view_customers", "View Customers"),
        ("create_customers", "Create Customers"),
        ("edit_customers", "Edit, Block & Delete Customers"),
    ]},
    {"key": "pujaris", "label": "Pujaris", "permissions": [
        ("view_pujaris", "View Pujaris & Pujari Ratings"),
        ("create_pujaris", "Create Pujaris"),
        ("edit_pujaris", "Edit Pujaris, Services & Ratings"),
        ("approve_pujaris", "Approve Pujaris (Level & Head Pujari)"),
        ("verify_pujaris", "Verify Pujaris (KYC)"),
        ("block_pujaris", "Block / Suspend Pujaris"),
    ]},
    {"key": "temples", "label": "Temples", "permissions": [
        ("view_temples", "View Temples"),
        ("manage_temples", "Create, Edit & Import Temples"),
    ]},
    {"key": "services", "label": "Services", "permissions": [
        ("view_services", "View Services"),
        ("manage_services", "Create & Edit Services"),
    ]},
    {"key": "recommendations", "label": "Recommendations", "permissions": [
        ("view_recommendations", "View Recommendations"),
        ("manage_recommendations", "Manage Recommendations"),
    ]},
    {"key": "samagri", "label": "Samagri", "permissions": [
        ("view_samagri", "View Samagri"),
        ("manage_samagri", "Create & Edit Samagri"),
    ]},
    {"key": "bookings", "label": "Bookings", "permissions": [
        ("view_bookings", "View Bookings"),
        ("manage_bookings", "Manage Bookings (status, cancel, assign / reassign Pujari)"),
    ]},
    {"key": "virtual_puja", "label": "Virtual & Online Puja", "permissions": [
        ("view_virtual_puja", "View Virtual & Online Pujas"),
        ("manage_virtual_puja", "Manage Virtual & Online Pujas"),
    ]},
    {"key": "seva_events", "label": "Seva Events", "permissions": [
        ("view_seva_events", "View Seva Events"),
        ("manage_seva_events", "Manage Seva Events & Registrations"),
    ]},
    {"key": "muhurtham", "label": "Muhurtham", "permissions": [
        ("view_muhurtham", "View Muhurtham Requests"),
        ("manage_muhurtham", "Manage Muhurtham Requests"),
    ]},
    {"key": "invoices", "label": "Invoices", "permissions": [
        ("view_invoices", "View Invoices"),
        ("manage_invoices", "Resend Invoices"),
    ]},
    {"key": "payments", "label": "Payments", "permissions": [
        ("view_payments", "View Payment Status (operational)"),
    ]},
    {"key": "pricing", "label": "Pricing", "permissions": [
        ("view_pricing", "View Pricing Rules"),
        ("manage_pricing", "Manage Pricing Rules"),
    ]},
    {"key": "reviews", "label": "Reviews", "permissions": [
        ("view_reviews", "View Reviews"),
        ("manage_reviews", "Moderate Reviews"),
    ]},
    {"key": "promotions", "label": "Promotions", "permissions": [
        ("view_promotions", "View Promotions"),
        ("manage_promotions", "Create & Edit Promotions"),
    ]},
    {"key": "support", "label": "Support", "permissions": [
        ("manage_support", "Handle Support Tickets & Chats"),
    ]},
    {"key": "legal", "label": "Terms & Conditions", "permissions": [
        ("manage_legal", "Edit Terms & Policies"),
    ]},
]

ADMIN_ASSIGNABLE: list[str] = [k for g in PERMISSION_GROUPS for k, _ in g["permissions"]]
PERMISSION_LABELS: dict[str, str] = {k: label for g in PERMISSION_GROUPS for k, label in g["permissions"]}

# Capabilities that only a Super Admin ever has. Never assignable, never effective for role=admin,
# even if a legacy admin_permissions row grants one of them.
SUPER_ADMIN_ONLY: list[str] = [
    "manage_admins",        # Admin Permissions, promote/demote admins
    "manage_settlements",   # Settlements, payout overrides
    "view_reports",         # Reports & exports
    "view_financials",      # revenue / platform-fee / payout KPIs (dashboard, payment aggregates)
    "manage_config",        # Settings: GST, platform config, pujari roles, email/SMS setup
]

ALL_PERMISSIONS: list[str] = ADMIN_ASSIGNABLE + SUPER_ADMIN_ONLY

# Pre-v2 keys -> v2 keys, so admins keep the access they had when the catalogue was split
# (used by the one-time migration and as a runtime fallback until it has run).
LEGACY_EXPANSION: dict[str, list[str]] = {
    "manage_services": ["view_services", "manage_services", "view_temples", "manage_temples",
                        "view_recommendations", "manage_recommendations",
                        "view_seva_events", "manage_seva_events"],
    "manage_samagri": ["view_samagri", "manage_samagri"],
    "view_bookings": ["view_bookings", "view_reviews", "manage_reviews",
                      "view_virtual_puja", "view_muhurtham"],
    "manage_bookings": ["manage_bookings", "manage_virtual_puja", "manage_muhurtham",
                        "view_invoices", "manage_invoices", "view_seva_events"],
    "view_payments": ["view_payments", "view_invoices"],
    "manage_promotions": ["view_promotions", "manage_promotions"],
    "manage_config": ["view_pricing", "manage_pricing"],
}

# What an admin with no rows effectively had before v2 (old DEFAULT_ADMIN_PERMISSIONS, minus
# the Super-Admin-only view_reports). Promotions were open to every admin before v2.
LEGACY_DEFAULT_ADMIN: list[str] = [
    "view_customers", "create_customers", "edit_customers",
    "view_pujaris", "create_pujaris", "edit_pujaris", "approve_pujaris", "verify_pujaris", "block_pujaris",
    "view_bookings", "manage_bookings", "view_payments", "manage_support", "manage_promotions",
]

RBAC_V2_MARKER = "admin_rbac_v2"


def expand_legacy(keys) -> list[str]:
    out: list[str] = []
    for k in keys:
        for x in LEGACY_EXPANSION.get(k, [k]):
            if x in ADMIN_ASSIGNABLE and x not in out:
                out.append(x)
    return out


def catalog_payload() -> dict:
    return {
        "groups": [
            {"key": g["key"], "label": g["label"],
             "permissions": [{"key": k, "label": label} for k, label in g["permissions"]]}
            for g in PERMISSION_GROUPS
        ],
        "super_admin_only": SUPER_ADMIN_ONLY,
    }


# --------------------------------------------------------------------------------------------
# Effective permissions (authoritative: role + admin_permissions rows in the database)
# --------------------------------------------------------------------------------------------
_v2_applied_cache = False


def _rbac_v2_applied(db: Session) -> bool:
    global _v2_applied_cache
    if _v2_applied_cache:
        return True
    try:
        row = db.execute(
            text("SELECT 1 FROM rbac_migrations WHERE key = :k"), {"k": RBAC_V2_MARKER}
        ).first()
    except Exception:
        db.rollback()
        return False
    _v2_applied_cache = row is not None
    return _v2_applied_cache


def is_super_admin(user: dict) -> bool:
    return user.get("role") == "super_admin"


def is_admin_like(user: dict) -> bool:
    return user.get("role") in ("admin", "super_admin")


def user_permissions(db: Session, user: dict) -> list[str]:
    """Effective permissions. Super Admin: everything. Admin: assigned rows, minus anything
    Super-Admin-only. Everyone else: none."""
    if is_super_admin(user):
        return list(ALL_PERMISSIONS)
    if user.get("role") != "admin":
        return []
    rows = [r[0] for r in db.execute(
        text("SELECT permission FROM admin_permissions WHERE user_id = CAST(:id AS uuid)"),
        {"id": user["id"]},
    ).fetchall()]
    if not _rbac_v2_applied(db):
        # Before the v2 migration: keep pre-v2 behaviour (no rows = legacy default), translated.
        return expand_legacy(rows or LEGACY_DEFAULT_ADMIN)
    return [p for p in rows if p in ADMIN_ASSIGNABLE]


def has_permission(db: Session, user: dict, *permissions: str) -> bool:
    """True if the user holds ANY of the permissions (Super Admin always; admin per DB)."""
    if is_super_admin(user):
        return True
    if user.get("role") != "admin":
        return False
    if all(p in SUPER_ADMIN_ONLY for p in permissions):
        return False
    return bool(set(user_permissions(db, user)).intersection(permissions))


def ensure_admin_permission(db: Session, user: dict, *permissions: str) -> None:
    """For endpoints shared with non-admin roles: if the caller is an admin, enforce the
    permission; other roles are left to the endpoint's own checks."""
    if user.get("role") in ("admin", "super_admin") and not has_permission(db, user, *permissions):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action")


# --------------------------------------------------------------------------------------------
# FastAPI guards
# --------------------------------------------------------------------------------------------
def require_admin(user=Depends(current_user)):
    if not is_admin_like(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    return user


def require_super_admin(user=Depends(current_user)):
    if not is_super_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super Admin only")
    return user


def require_permission(permission: str):
    def inner(user=Depends(current_user), db: Session = Depends(get_db)):
        if not is_admin_like(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
        if not has_permission(db, user, permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {permission}")
        return user

    return inner


def require_any_permission(*permissions: str):
    def inner(user=Depends(current_user), db: Session = Depends(get_db)):
        if not is_admin_like(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
        if not has_permission(db, user, *permissions):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Missing permission: one of {', '.join(permissions)}",
            )
        return user

    return inner


# --------------------------------------------------------------------------------------------
# Bookings: virtual bookings are also reachable through the Virtual & Online Puja permissions.
# --------------------------------------------------------------------------------------------
BOOKING_VIEW_ANY = ("view_bookings", "manage_bookings", "view_virtual_puja", "manage_virtual_puja")
BOOKING_MANAGE_ANY = ("manage_bookings", "manage_virtual_puja")


def booking_permissions(mode: str | None, action: str) -> tuple[str, ...]:
    virtual = (mode or "").strip().lower() == "virtual"
    if action == "manage":
        return ("manage_bookings", "manage_virtual_puja") if virtual else ("manage_bookings",)
    return BOOKING_VIEW_ANY if virtual else ("view_bookings", "manage_bookings")


def ensure_booking_access(db: Session, user: dict, booking_id: str, action: str = "view") -> None:
    """Admin callers must hold the booking permission matching the booking's mode.
    Non-admin roles are untouched (their ownership checks live in the endpoints)."""
    if user.get("role") not in ("admin", "super_admin") or is_super_admin(user):
        return
    row = db.execute(
        text("SELECT mode FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}
    ).first()
    mode = row[0] if row else None
    if not has_permission(db, user, *booking_permissions(mode, action)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this booking")
