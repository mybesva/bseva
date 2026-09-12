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


class ContactFormIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    country_code: str = Field(default="+91", min_length=1, max_length=8)
    phone: str = Field(min_length=6, max_length=20)
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=4000)


def _normalize_country_code(raw: str) -> str:
    code = (raw or "+91").strip().replace(" ", "")
    if not code.startswith("+"):
        code = f"+{code}"
    digits = "".join(ch for ch in code[1:] if ch.isdigit())
    if not digits or len(digits) > 4:
        raise HTTPException(400, "Enter a valid country code (e.g. +91)")
    return f"+{digits}"


def _normalize_contact_phone(country_code: str, phone: str) -> tuple[str, str]:
    """Return (display phone, e164-ish). For +91 require any 10 digits only."""
    import re

    code = _normalize_country_code(country_code)
    digits = re.sub(r"\D", "", phone or "")
    if code == "+91":
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) != 10 or not digits.isdigit():
            raise HTTPException(400, "Enter a 10-digit mobile number")
        return f"+91 {digits}", f"+91{digits}"
    if len(digits) < 6 or len(digits) > 15:
        raise HTTPException(400, "Enter a valid phone number for the selected country code")
    return f"{code} {digits}", f"{code}{digits}"


@router.post("/contact")
def submit_contact_form(body: ContactFormIn, db: Session = Depends(get_db)):
    """Public contact form — emails BSeva inbox via Zoho SMTP (authenticated From address)."""
    import re

    from app.mail.smtp_client import send_email, smtp_configured
    from app.mail.smtp_config import load_smtp_config
    from app.mail.templates import admin_notification_email
    from app.platform_config import get_setting

    name = body.name.strip()
    email = body.email.strip().lower()
    subject = body.subject.strip()
    message = body.message.strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Enter a valid email address")
    phone_display, phone_e164 = _normalize_contact_phone(body.country_code, body.phone)

    cfg = load_smtp_config()
    contact_inbox = str(get_setting(db, "email_from_contact", "") or "").strip()
    support_inbox = str(get_setting(db, "email_from_support", "") or "").strip()
    # Prefer contact@, then support@, then authenticated Zoho mailbox
    inbox = contact_inbox or support_inbox or (cfg.from_email if cfg else "") or "admin@b-seva.com"

    content = admin_notification_email(
        title=f"Website contact: {subject}",
        message=message,
        details=[
            ("Name", name),
            ("Email", email),
            ("Phone", phone_display),
            ("Subject", subject),
        ],
    )
    # Do not override From with support@ — Zoho only accepts the authenticated mailbox.
    result = send_email(
        to=inbox,
        subject=content.subject,
        text_body=content.text,
        html_body=content.html,
        reply_to=email,
    )
    if not result.get("ok"):
        if not smtp_configured():
            return {
                "ok": True,
                "message": "Thank you. Your message was received. Our team will contact you soon.",
                "queued": True,
            }
        raise HTTPException(
            502,
            "Unable to send your message right now. Please try again or email us directly.",
        )

    return {
        "ok": True,
        "message": "Thank you. Your message has been sent. We will get back to you soon.",
        "phone": phone_e164,
    }
