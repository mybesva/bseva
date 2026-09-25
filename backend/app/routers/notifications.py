"""In-app notifications list/mark-read + helpers for booking/ops events.

FCM push is fanned out from create_notification so existing event call sites
(web, PWA, Android, iOS) share one pipeline.
"""
from __future__ import annotations

import logging
import re
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

_BOOKING_NUMBER = re.compile(r"\b(BSV-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b", re.I)
_GENERIC_CUSTOMER_BOOKING_LINKS = {"/customer/bookings", "/customer/bookings/"}
_GENERIC_PUJARI_BOOKING_LINKS = {"/pujari/bookings", "/pujari/bookings/", "/pujari"}


def customer_booking_link(booking_id: str) -> str:
    """Deep link to one booking. Web uses /booking/:id; mobile maps that route."""
    return f"/booking/{str(booking_id).strip()}"


def pujari_booking_link(booking_id: str) -> str:
    """Deep link to one pujari booking. Web uses /pujari/bookings/:id."""
    return f"/pujari/bookings/{str(booking_id).strip()}"


def rewrite_customer_booking_link(
    link: str | None,
    body: str | None,
    booking_ids_by_number: Mapping[str, str],
) -> str | None:
    """Point generic My Bookings links at the booking named in the notification."""
    raw = (link or "").strip()
    path, _, query = raw.partition("?")
    if path.startswith("/booking/") and len(path) > len("/booking/"):
        return raw
    booking_q = re.search(r"(?:^|&)booking=([^&]+)", query)
    if booking_q and booking_q.group(1):
        return customer_booking_link(booking_q.group(1))
    if path not in _GENERIC_CUSTOMER_BOOKING_LINKS:
        return raw or None
    found = _BOOKING_NUMBER.search(body or "")
    if not found:
        return raw or None
    booking_id = booking_ids_by_number.get(found.group(1).upper())
    if not booking_id:
        return raw or None
    return customer_booking_link(booking_id)


def rewrite_pujari_booking_link(
    link: str | None,
    body: str | None,
    booking_ids_by_number: Mapping[str, str],
) -> str | None:
    """Point generic My Bookings links at the booking identified in the notification."""
    raw = (link or "").strip()
    path, _, query = raw.partition("?")
    if path.startswith("/pujari/bookings/") and len(path) > len("/pujari/bookings/"):
        return raw
    booking_q = re.search(r"(?:^|&)booking=([^&]+)", query)
    if booking_q and booking_q.group(1):
        return pujari_booking_link(booking_q.group(1))
    if path not in _GENERIC_PUJARI_BOOKING_LINKS:
        return raw or None
    found = _BOOKING_NUMBER.search(body or "")
    if not found:
        return raw or None
    booking_id = booking_ids_by_number.get(found.group(1).upper())
    if not booking_id:
        return raw or None
    return pujari_booking_link(booking_id)


def _booking_ids_for_user(db: Session, user_id: str, numbers: list[str]) -> dict[str, str]:
    """Map booking numbers to ids the user may open as customer, assignee, or invitee."""
    if not numbers:
        return {}
    unique = list(dict.fromkeys(numbers))
    params: dict[str, Any] = {"uid": user_id}
    holders = []
    for i, number in enumerate(unique):
        key = f"n{i}"
        holders.append(f":{key}")
        params[key] = number
    in_list = ", ".join(holders)
    rows = db.execute(
        text(
            f"""
            SELECT id::text AS id, upper(booking_number) AS booking_number
            FROM bookings
            WHERE upper(booking_number) IN ({in_list})
              AND (
                customer_id = CAST(:uid AS uuid)
                OR pujari_id = CAST(:uid AS uuid)
              )
            """
        ),
        params,
    ).mappings().all()
    lookup = {str(r["booking_number"]): str(r["id"]) for r in rows if r.get("id")}
    missing = [n for n in unique if n not in lookup]
    if not missing:
        return lookup
    try:
        from app.booking_offers import ensure_offers_table

        ensure_offers_table(db)
        offer_params: dict[str, Any] = {"uid": user_id}
        offer_holders = []
        for i, number in enumerate(missing):
            key = f"m{i}"
            offer_holders.append(f":{key}")
            offer_params[key] = number
        offer_rows = db.execute(
            text(
                f"""
                SELECT b.id::text AS id, upper(b.booking_number) AS booking_number
                FROM bookings b
                JOIN booking_pujari_offers o
                  ON o.booking_id = b.id
                 AND o.pujari_id = CAST(:uid AS uuid)
                 AND o.status = 'invited'
                WHERE upper(b.booking_number) IN ({", ".join(offer_holders)})
                  AND b.pujari_id IS NULL
                """
            ),
            offer_params,
        ).mappings().all()
        for row in offer_rows:
            if row.get("id") and row.get("booking_number"):
                lookup[str(row["booking_number"])] = str(row["id"])
    except Exception:
        logger.exception("Could not resolve invited booking links")
    return lookup


def _apply_booking_links(db: Session, user_id: str, items: list[dict]) -> list[dict]:
    numbers: list[str] = []
    for item in items:
        link = str(item.get("link") or "")
        path = link.split("?", 1)[0]
        generic = (
            path in _GENERIC_CUSTOMER_BOOKING_LINKS
            or path in _GENERIC_PUJARI_BOOKING_LINKS
            or "booking=" in link
        )
        if not generic:
            continue
        found = _BOOKING_NUMBER.search(str(item.get("body") or ""))
        if found:
            numbers.append(found.group(1).upper())
    lookup = _booking_ids_for_user(db, user_id, numbers)
    for item in items:
        link = str(item.get("link") or "")
        path = link.split("?", 1)[0]
        if path in _GENERIC_PUJARI_BOOKING_LINKS or path.startswith("/pujari/bookings"):
            item["link"] = rewrite_pujari_booking_link(item.get("link"), item.get("body"), lookup)
        else:
            item["link"] = rewrite_customer_booking_link(item.get("link"), item.get("body"), lookup)
    return items


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
    items = _apply_booking_links(db, str(user["id"]), [row_dict(r) for r in rows])
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size) if total else 1,
    }


@router.get("/notifications/unread-count")
def unread_count(user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE COALESCE(is_read, FALSE) = FALSE) AS unread,
              COUNT(*) FILTER (WHERE COALESCE(is_read, FALSE) = TRUE) AS read
            FROM notifications
            WHERE user_id = CAST(:uid AS uuid)
            """
        ),
        {"uid": user["id"]},
    ).mappings().first()
    total = int((row or {}).get("total") or 0)
    unread = int((row or {}).get("unread") or 0)
    read = int((row or {}).get("read") or 0)
    return {"unread": unread, "read": read, "total": total}


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
