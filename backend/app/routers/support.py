"""Customer support chat foundation (req #107–#108).

Provider escalation (live agent telephony/chat vendor) is not wired —
this API persists conversations for in-app / future provider hooks.
"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import row_dict

router = APIRouter(prefix="/support", tags=["support"])


class ConversationCreateIn(BaseModel):
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=4000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@router.post("/conversations")
def create_conversation(body: ConversationCreateIn, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    cid = str(uuid4())
    mid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO support_conversations (id, customer_id, status, subject, last_response_at)
            VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), 'open', :subj, NOW())
            """
        ),
        {"id": cid, "cid": user["id"], "subj": body.subject or "Booking assistance"},
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
    if user["role"] == "customer":
        rows = db.execute(
            text(
                """
                SELECT * FROM support_conversations
                WHERE customer_id = CAST(:id AS uuid)
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 50
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    elif user["role"] in ("admin", "super_admin"):
        rows = db.execute(
            text(
                """
                SELECT c.*, u.name AS customer_name
                FROM support_conversations c
                JOIN users u ON u.id = c.customer_id
                ORDER BY c.created_at DESC
                LIMIT 100
                """
            )
        ).mappings().all()
    else:
        raise HTTPException(403, "Not allowed")
    return [row_dict(r) for r in rows]


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    conv = db.execute(
        text("SELECT * FROM support_conversations WHERE id = CAST(:id AS uuid)"),
        {"id": conversation_id},
    ).mappings().first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if user["role"] == "customer" and str(conv["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if user["role"] not in ("customer", "admin", "super_admin"):
        raise HTTPException(403, "Not allowed")
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
    conv = db.execute(
        text("SELECT * FROM support_conversations WHERE id = CAST(:id AS uuid)"),
        {"id": conversation_id},
    ).mappings().first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if user["role"] == "customer" and str(conv["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if user["role"] not in ("customer", "admin", "super_admin"):
        raise HTTPException(403, "Not allowed")
    if conv["status"] in ("closed", "resolved"):
        raise HTTPException(400, "Conversation is closed")
    role = "agent" if user["role"] in ("admin", "super_admin") else "customer"
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
    db.commit()
    return {"id": mid, "ok": True}


@router.post("/conversations/{conversation_id}/close")
def close_conversation(conversation_id: str, user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
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
