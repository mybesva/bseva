"""In-app notifications list/mark-read + helpers for booking/ops events.

FCM push is fanned out from create_notification so existing event call sites
(web, PWA, Android, iOS) share one pipeline.
"""
from __future__ import annotations

import logging
from typing import Any, Mapping
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.domain import row_dict
from app.schemas import FcmTokenIn, FcmTokenRemoveIn

logger = logging.getLogger(__name__)

router = APIRouter(tags=["notifications"])


def create_notification(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str,
    category: str = "system",
    link: str | None = None,
    extra_data: Mapping[str, Any] | None = None,
    message_key: str | None = None,
    message_vars: Mapping[str, Any] | None = None,
) -> str:
    title_out, body_out = title, body
    if message_key:
        try:
            from app.i18n import ADMIN_ROLES, notify_copy, user_preferred_lang, user_role

            role = user_role(db, str(user_id))
            if role not in ADMIN_ROLES:
                loc = user_preferred_lang(db, str(user_id))
                localized_vars = dict(message_vars or {})
                service_id = localized_vars.pop("service_id", None)
                if service_id:
                    from app.catalog import localized_service_name

                    localized_vars["service"] = localized_service_name(
                        db, str(service_id), loc, str(localized_vars.get("service") or "Puja")
                    )
                title_out, body_out = notify_copy(message_key, loc, localized_vars)
        except Exception:
            title_out, body_out = title, body
    nid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO notifications (id, user_id, channel, title, body, category, is_read, link)
            VALUES (
              CAST(:id AS uuid), CAST(:uid AS uuid), 'in_app',
              :title, :body, :cat, FALSE, :link
            )
            """
        ),
        {
            "id": nid,
            "uid": user_id,
            "title": title_out,
            "body": body_out,
            "cat": category,
            "link": link,
        },
    )
    try:
        from app.services.firebase_notifications import push_to_user

        data: dict[str, Any] = {
            "notification_id": nid,
            "category": category or "system",
            "link": link or "",
            "title": title_out,
            "body": body_out,
        }
        if extra_data:
            for key, value in extra_data.items():
                if value is not None:
                    data[str(key)] = value
        push_to_user(db, str(user_id), title=title_out, body=body_out, data=data)
    except Exception:
        logger.exception("FCM fan-out failed for notification %s", nid)
    return nid


def notify_ops_staff(
    db: Session,
    *,
    title: str,
    body: str,
    category: str = "ops",
    link: str | None = None,
) -> int:
    """Notify admin + super_admin users (in-app)."""
    rows = db.execute(
        text(
            """
            SELECT id FROM users
            WHERE role IN ('super_admin', 'admin')
              AND COALESCE(blocked, FALSE) = FALSE
            LIMIT 50
            """
        )
    ).mappings().all()
    n = 0
    for r in rows:
        create_notification(
            db,
            user_id=str(r["id"]),
            title=title,
            body=body,
            category=category,
            link=link,
        )
        n += 1
    return n


def notify_super_admins(
    db: Session,
    *,
    title: str,
    body: str,
    category: str = "ops",
    link: str | None = None,
) -> int:
    rows = db.execute(
        text(
            """
            SELECT id FROM users
            WHERE role = 'super_admin' AND COALESCE(blocked, FALSE) = FALSE
            LIMIT 20
            """
        )
    ).mappings().all()
    n = 0
    for r in rows:
        create_notification(
            db,
            user_id=str(r["id"]),
            title=title,
            body=body,
            category=category,
            link=link,
        )
        n += 1
    return n


def mask_customer_display_name(raw: str | None) -> str:
    name = str(raw or "").strip()
    if not name:
        return "Customer"
    parts = name.split()
    if len(parts) == 1:
        return parts[0][0].upper() + "." if parts[0] else "Customer"
    return f"{parts[0]} {parts[-1][0].upper()}."


@router.get("/notifications")
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    unread_only: bool = False,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    params: dict = {"uid": user["id"], "lim": page_size, "off": (page - 1) * page_size}
    where = "user_id = CAST(:uid AS uuid)"
    if category:
        where += " AND category = :cat"
        params["cat"] = category
    if unread_only:
        where += " AND COALESCE(is_read, FALSE) = FALSE"
    total = int(
        db.execute(text(f"SELECT COUNT(*) FROM notifications WHERE {where}"), params).scalar() or 0
    )
    rows = db.execute(
        text(
            f"""
            SELECT id, title, body, category, is_read, link, created_at, channel, status
            FROM notifications
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).mappings().all()
    return {
        "items": [row_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size) if total else 1,
    }


@router.get("/notifications/unread-count")
def unread_count(user=Depends(current_user), db: Session = Depends(get_db)):
    n = db.execute(
        text(
            """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = CAST(:uid AS uuid) AND COALESCE(is_read, FALSE) = FALSE
            """
        ),
        {"uid": user["id"]},
    ).scalar()
    return {"unread": int(n or 0)}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            UPDATE notifications SET is_read = TRUE
            WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)
            RETURNING id
            """
        ),
        {"id": notification_id, "uid": user["id"]},
    ).first()
    if not row:
        raise HTTPException(404, "Notification not found")
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(user=Depends(current_user), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            UPDATE notifications SET is_read = TRUE
            WHERE user_id = CAST(:uid AS uuid) AND COALESCE(is_read, FALSE) = FALSE
            """
        ),
        {"uid": user["id"]},
    )
    db.commit()
    return {"ok": True}


@router.get("/notifications/fcm/public-config")
def fcm_public_config():
    """Browser/mobile client config only — never includes Admin SDK credentials."""
    vapid = (settings.firebase_web_vapid_key or "").strip()
    return {
        "apiKey": settings.firebase_web_api_key or "",
        "authDomain": settings.firebase_web_auth_domain or "",
        "projectId": settings.firebase_web_project_id or "",
        "storageBucket": settings.firebase_web_storage_bucket or "",
        "messagingSenderId": settings.firebase_web_messaging_sender_id or "",
        "appId": settings.firebase_web_app_id or "",
        "vapidConfigured": bool(vapid),
    }


@router.post("/notifications/fcm/token")
def register_fcm_token(body: FcmTokenIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.services.firebase_notifications import upsert_device_token

    token_id = upsert_device_token(
        db,
        user_id=str(user["id"]),
        token=body.token.strip(),
        platform=body.platform,
    )
    db.commit()
    return {"ok": True, "id": token_id, "platform": body.platform}


@router.post("/notifications/fcm/token/remove")
def remove_fcm_token(body: FcmTokenRemoveIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.services.firebase_notifications import deactivate_user_token

    ok = deactivate_user_token(db, user_id=str(user["id"]), token=body.token.strip())
    db.commit()
    return {"ok": True, "removed": ok}


@router.post("/notifications/fcm/test")
def send_test_fcm(user=Depends(current_user), db: Session = Depends(get_db)):
    """Send a test push to every active device token for the signed-in user."""
    from app.services.firebase_notifications import firebase_ready, push_to_user

    role = str(user.get("role") or "")
    if role in ("admin", "super_admin"):
        link = "/admin/notifications"
    elif role in ("pujari", "head_pujari"):
        link = "/pujari/bookings"
    else:
        link = "/customer/bookings"
    if not firebase_ready():
        raise HTTPException(503, "Firebase Admin SDK is not configured on the server")
    result = push_to_user(
        db,
        str(user["id"]),
        title="BSeva test notification",
        body="Push is working. Open this notification to go to your bookings.",
        data={
            "category": "system",
            "link": link,
            "title": "BSeva test notification",
            "body": "Push is working. Open this notification to go to your bookings.",
        },
    )
    db.commit()
    if result.skipped_reason == "no_tokens":
        raise HTTPException(
            400,
            "No FCM device token is registered for this account. Allow notifications in the browser or mobile app first.",
        )
    return {
        "ok": True,
        "success": result.success,
        "failure": result.failure,
        "invalid_tokens": len(result.invalid_tokens),
        "link": link,
    }


@router.get("/notifications/nav-badges")
def nav_badges(user=Depends(current_user), db: Session = Depends(get_db)):
    unread = int(
        db.execute(
            text(
                """
                SELECT COUNT(*) FROM notifications
                WHERE user_id = CAST(:uid AS uuid) AND COALESCE(is_read, FALSE) = FALSE
                """
            ),
            {"uid": user["id"]},
        ).scalar()
        or 0
    )
    booking_unread = int(
        db.execute(
            text(
                """
                SELECT COUNT(*) FROM notifications
                WHERE user_id = CAST(:uid AS uuid)
                  AND COALESCE(is_read, FALSE) = FALSE
                  AND category IN ('booking', 'booking_reminder', 'payment', 'pujari_arriving', 'samagri_reminder')
                """
            ),
            {"uid": user["id"]},
        ).scalar()
        or 0
    )
    out: dict = {
        "unread": unread,
        "bookings": booking_unread,
        "notifications": unread,
        "tooltips": {
            "notifications": f"{unread} unread" if unread else "",
            "bookings": f"{booking_unread} unread" if booking_unread else "",
        },
    }
    if str(user.get("role") or "") in ("admin", "super_admin"):
        from app.admin_nav_badges import admin_action_badges

        action = admin_action_badges(db)
        tooltips = dict(action.pop("tooltips") or {})
        out.update(action)
        # Bell still uses unread; sidebar operational keys overwrite bookings/support/etc.
        out["unread"] = unread
        out["notifications"] = unread
        out["tooltips"] = tooltips
        out["tooltips"]["notifications"] = (
            f"{unread} unread notification{'s' if unread != 1 else ''}" if unread else ""
        )
    else:
        support_unread = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM notifications
                    WHERE user_id = CAST(:uid AS uuid)
                      AND COALESCE(is_read, FALSE) = FALSE
                      AND category = 'support'
                    """
                ),
                {"uid": user["id"]},
            ).scalar()
            or 0
        )
        out["support"] = support_unread
        out["tooltips"]["support"] = (
            f"{support_unread} unread support message{'s' if support_unread != 1 else ''}"
            if support_unread
            else ""
        )
    return out
