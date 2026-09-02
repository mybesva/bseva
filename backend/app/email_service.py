"""Outbound email — real SMTP when configured; otherwise logs and returns queued stub.

WAITING FOR OWNER INPUT if SMTP_* env vars are empty.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Any

logger = logging.getLogger("bseva.email")


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def smtp_status() -> dict[str, Any]:
    return {
        "configured": smtp_configured(),
        "host": os.getenv("SMTP_HOST") or None,
        "port": int(os.getenv("SMTP_PORT") or "587"),
        "from_default": os.getenv("SMTP_FROM") or None,
        "missing": [
            k
            for k in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM")
            if not os.getenv(k)
        ],
    }


def send_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    from_addr: str | None = None,
) -> dict[str, Any]:
    """Send email or return queued stub when SMTP not configured."""
    from_addr = from_addr or os.getenv("SMTP_FROM") or "noreply@b-seva.com"
    if not smtp_configured():
        logger.info("EMAIL_QUEUED (SMTP not configured) to=%s subject=%s", to, subject)
        return {"ok": True, "status": "queued", "reason": "SMTP not configured", "to": to, "subject": subject}

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT") or "587")
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        logger.info("EMAIL_SENT to=%s subject=%s", to, subject)
        return {"ok": True, "status": "sent", "to": to, "subject": subject}
    except Exception as e:
        logger.exception("EMAIL_FAILED to=%s", to)
        return {"ok": False, "status": "failed", "error": str(e), "to": to, "subject": subject}


def send_recommended_list_email(
    *,
    to: str,
    booking_number: str,
    service_name: str,
    items: list[dict],
    from_addr: str | None = None,
) -> dict[str, Any]:
    lines = [f"- {it.get('name')}" + (" (required)" if it.get("required") else "") for it in items]
    body = (
        f"Namaste,\n\nYour booking {booking_number} for {service_name} is confirmed.\n\n"
        f"Recommended List:\n" + ("\n".join(lines) if lines else "(none)") + "\n\nOm Shanti,\nBSeva\n"
    )
    return send_email(
        to=to,
        subject=f"BSeva Recommended List — {booking_number}",
        text_body=body,
        from_addr=from_addr,
    )


def send_booking_event_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    from_addr: str | None = None,
) -> dict[str, Any]:
    return send_email(to=to, subject=subject, text_body=text_body, from_addr=from_addr)
