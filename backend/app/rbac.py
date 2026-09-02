"""RBAC helpers for admin / super_admin."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user

# All known permissions (Super Admin can grant any of these to Normal Admins)
ALL_PERMISSIONS = [
    "view_customers",
    "create_customers",
    "edit_customers",
    "view_pujaris",
    "create_pujaris",
    "edit_pujaris",
    "approve_pujaris",
    "verify_pujaris",
    "block_pujaris",
    "view_bookings",
    "manage_bookings",
    "view_payments",
    "manage_settlements",
    "manage_services",
    "manage_samagri",
    "manage_promotions",
    "manage_config",
    "manage_admins",
    "manage_support",
    "manage_legal",
    "view_reports",
]

# Default Normal Admin when admin_permissions has no rows.
# Super Admin can grant additional permissions later via /admin/permissions.
DEFAULT_ADMIN_PERMISSIONS = [
    "view_customers",
    "create_customers",
    "edit_customers",
    "view_pujaris",
    "create_pujaris",
    "edit_pujaris",
    "approve_pujaris",
    "verify_pujaris",
    "block_pujaris",
    "view_bookings",
    "manage_bookings",
    "manage_support",
]


def is_super_admin(user: dict) -> bool:
    return user.get("role") == "super_admin"


def is_admin_like(user: dict) -> bool:
    return user.get("role") in ("admin", "super_admin")


def user_permissions(db: Session, user: dict) -> list[str]:
    if is_super_admin(user):
        return list(ALL_PERMISSIONS)
    if user.get("role") != "admin":
        return []
    rows = db.execute(
        text("SELECT permission FROM admin_permissions WHERE user_id = CAST(:id AS uuid)"),
        {"id": user["id"]},
    ).fetchall()
    if not rows:
        return list(DEFAULT_ADMIN_PERMISSIONS)
    return [r[0] for r in rows]


def require_admin(user=Depends(current_user)):
    if not is_admin_like(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    return user


def require_permission(permission: str):
    def inner(user=Depends(current_user), db: Session = Depends(get_db)):
        if not is_admin_like(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
        if is_super_admin(user):
            return user
        perms = user_permissions(db, user)
        if permission not in perms:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {permission}")
        return user

    return inner


def require_any_permission(*permissions: str):
    def inner(user=Depends(current_user), db: Session = Depends(get_db)):
        if not is_admin_like(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
        if is_super_admin(user):
            return user
        perms = set(user_permissions(db, user))
        if not perms.intersection(permissions):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Missing permission: one of {', '.join(permissions)}",
            )
        return user

    return inner
