"""Customer support chat foundation (req #107–#108).

Provider escalation (live agent telephony/chat vendor) is not wired —
this API persists conversations for in-app / future provider hooks.
"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, optional_user, require_roles
from app.rbac import ensure_admin_permission, require_permission
from app.domain import row_dict

router = APIRouter(prefix="/support", tags=["support"])


class ConversationCreateIn(BaseModel):
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=4000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@router.post("/conversations")
def create_conversation(body: ConversationCreateIn, user=Depends(require_roles("customer", "pujari", "head_pujari")), db: Session = Depends(get_db)):
    cid = str(uuid4())
    mid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO support_conversations (id, customer_id, status, subject, last_response_at, user_role)
            VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), 'open', :subj, NOW(), :role)
            """
        ),
        {"id": cid, "cid": user["id"], "subj": body.subject or "Booking assistance", "role": user["role"]},
    )
    db.execute(
        text(
            """
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_role, body)
            VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), CAST(:sid AS uuid), 'customer', :body)
            """
        ),
        {"id": mid, "cid": cid, "sid": user["id"], "body": body.message},
    )
    db.commit()
    return {"id": cid, "status": "open", "provider": "in_app_foundation"}


@router.get("/conversations")
def list_conversations(user=Depends(current_user), db: Session = Depends(get_db)):
    ensure_admin_permission(db, user, "manage_support")
    if user["role"] in ("customer", "pujari", "head_pujari"):
        rows = db.execute(
            text(
                """
                SELECT c.*, t.ticket_number
                FROM support_conversations c
                LEFT JOIN support_tickets t ON t.id = c.ticket_id
                WHERE c.customer_id = CAST(:id AS uuid)
                ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
                LIMIT 50
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    elif user["role"] in ("admin", "super_admin"):
        rows = db.execute(
            text(
                """
                SELECT c.*, u.name AS customer_name, u.role AS user_role, t.ticket_number, t.id AS linked_ticket_id
                FROM support_conversations c
                JOIN users u ON u.id = c.customer_id
                LEFT JOIN support_tickets t ON t.id = c.ticket_id
                ORDER BY c.created_at DESC
                LIMIT 100
                """
            )
        ).mappings().all()
    else:
        raise HTTPException(403, "Not allowed")
    return [row_dict(r) for r in rows]


def _can_access_conversation(conv, user) -> None:
    if user["role"] in ("admin", "super_admin"):
        return
    if user["role"] in ("customer", "pujari", "head_pujari") and str(conv["customer_id"]) == str(user["id"]):
        return
    raise HTTPException(403, "Not allowed")


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    ensure_admin_permission(db, user, "manage_support")
    conv = db.execute(
        text("SELECT * FROM support_conversations WHERE id = CAST(:id AS uuid)"),
        {"id": conversation_id},
    ).mappings().first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    _can_access_conversation(conv, user)
    rows = db.execute(
        text(
            """
            SELECT * FROM support_messages
            WHERE conversation_id = CAST(:id AS uuid)
            ORDER BY created_at ASC
            """
        ),
        {"id": conversation_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/conversations/{conversation_id}/messages")
def post_message(conversation_id: str, body: MessageIn, user=Depends(current_user), db: Session = Depends(get_db)):
    ensure_admin_permission(db, user, "manage_support")
    conv = db.execute(
        text("SELECT * FROM support_conversations WHERE id = CAST(:id AS uuid)"),
        {"id": conversation_id},
    ).mappings().first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    _can_access_conversation(conv, user)
    if conv["status"] in ("closed", "resolved"):
        raise HTTPException(400, "Conversation is closed")
    role = "agent" if user["role"] in ("admin", "super_admin") else user["role"]
    mid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_role, body)
            VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), CAST(:sid AS uuid), :role, :body)
            """
        ),
        {"id": mid, "cid": conversation_id, "sid": user["id"], "role": role, "body": body.body},
    )
    if role == "agent":
        db.execute(
            text(
                """
                UPDATE support_conversations
                SET assigned_agent_id = CAST(:aid AS uuid), last_response_at = NOW(), updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"aid": user["id"], "id": conversation_id},
        )
    else:
        db.execute(
            text(
                """
                UPDATE support_conversations
                SET last_response_at = NOW(), updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": conversation_id},
        )
    ticket_id = conv.get("ticket_id")
    if ticket_id:
        from app.routers.tickets import _add_event

        _add_event(
            db,
            ticket_id=str(ticket_id),
            actor=user,
            event_type="admin_reply" if role == "agent" else "user_message",
            body=body.body,
            visibility="public",
            meta={"from_conversation": conversation_id},
        )
    db.commit()
    return {"id": mid, "ok": True}


@router.post("/conversations/{conversation_id}/close")
def close_conversation(conversation_id: str, user=Depends(require_permission("manage_support")), db: Session = Depends(get_db)):
    db.execute(
        text(
            """
            UPDATE support_conversations
            SET status = 'resolved', closed_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": conversation_id},
    )
    db.commit()
    return {"ok": True}


class ContactFormIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    country_code: str = Field(default="+91", min_length=1, max_length=8)
    phone: str = Field(min_length=6, max_length=20)
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=4000)
    # Abuse signals. All optional, so older web bundles and app builds keep working.
    website: str | None = Field(default=None, max_length=500)  # honeypot: hidden from people, filled by bots
    elapsed_ms: int | None = Field(default=None, ge=0, le=86_400_000)  # time from first render to submit
    captcha_id: str | None = Field(default=None, max_length=128)  # self-hosted CAPTCHA (app.captcha)
    captcha_answer: str | None = Field(default=None, max_length=16)
    source: str | None = Field(default=None, max_length=32)


@router.post("/contact")
def submit_contact_form(
    body: ContactFormIn,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(optional_user),
):
    """Public contact form: stored, checked for abuse, then emailed to the BSeva inboxes (app.contact_form)."""
    from app.contact_form import submit

    return submit(db, body, request, user)


@router.get("/contact/submissions")
def list_contact_submissions(
    status: str | None = None,
    limit: int = 100,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    """Admin review of website contact messages, including ones held back by the volume limit or marked spam."""
    where = "WHERE status = :status" if status in ("accepted", "held", "duplicate", "spam") else ""
    rows = db.execute(
        text(
            f"""
            SELECT id, created_at, user_id, source, name, email, phone, subject, message, status, spam_reason,
                   team_emailed_at, reviewed_at
            FROM contact_submissions
            {where}
            ORDER BY created_at DESC
            LIMIT :lim
            """
        ),
        {"status": status, "lim": max(1, min(int(limit or 100), 500))},
    ).mappings().all()
    return [row_dict(r) for r in rows]
