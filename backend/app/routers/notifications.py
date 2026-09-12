"""In-app notifications list/mark-read + helpers for booking/ops events."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user
from app.domain import row_dict

router = APIRouter(tags=["notifications"])


def create_notification(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str,
    category: str = "system",
    link: str | None = None,
) -> str:
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
            "title": title,
            "body": body,
            "cat": category,
            "link": link,
        },
    )
    return nid


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
