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
    """Legacy helper — prefer send_booking_preparation_email."""
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


def send_booking_preparation_email(
    *,
    to: str,
    customer_name: str,
    booking_number: str,
    booking_id: str,
    service_name: str,
    booking_date: str,
    start_time: str,
    preparation: dict[str, Any],
    language: str = "en",
    from_addr: str | None = None,
    app_base_url: str | None = None,
) -> dict[str, Any]:
    """Short confirmation + link. Full checklist lives on the auth-gated booking page."""
    import os

    base = (app_base_url or os.getenv("PUBLIC_APP_URL") or os.getenv("VITE_APP_URL") or "https://bseva.vercel.app").rstrip(
        "/"
    )
    link = f"{base}/booking/{booking_id}"
    lang = (language or "en").lower()
    verified = bool(preparation.get("verified"))
    skip_samagri = bool(preparation.get("skip_samagri_cta"))
    if lang == "te":
        subject = f"BSeva — పూజ బుకింగ్ నిర్ధారణ ({booking_number})"
        greeting = f"నమస్తే {customer_name or ''},"
        body_core = (
            f"మీ BSeva పూజ బుకింగ్ నిర్ధారించబడింది.\n\n"
            f"పూజ: {service_name}\nతేదీ: {booking_date}\nసమయం: {start_time}\nబుకింగ్ ID: {booking_number}\n\n"
        )
        if skip_samagri:
            body_core += "మీరు సామగ్రి/అలంకారం స్వయంగా ఏర్పాటు చేసుకుంటారు అని ఎంచుకున్నారు.\n"
        elif verified:
            body_core += "దయచేసి మీ పూజకు అవసరమైన సామగ్రి జాబితాను చూడండి:\n"
        else:
            body_core += "మీ వివరమైన సామగ్రి జాబితా త్వరలో నిర్ధారించబడుతుంది.\n"
        body_core += f"\n[బుకింగ్ చూడండి]\n{link}\n\nఓం శాంతి,\nBSeva\n"
    elif lang == "hi":
        subject = f"BSeva — पूजा बुकिंग पुष्टि ({booking_number})"
        greeting = f"नमस्ते {customer_name or ''},"
        body_core = (
            f"आपकी BSeva पूजा बुकिंग पुष्टि हो गई है।\n\n"
            f"पूजा: {service_name}\nतिथि: {booking_date}\nसमय: {start_time}\nबुकिंग ID: {booking_number}\n\n"
        )
        if skip_samagri:
            body_core += "आपने सामग्री/अलंकार स्वयं व्यवस्था करने का विकल्प चुना है।\n"
        elif verified:
            body_core += "कृपया अपनी पूजा की सामग्री सूची देखें:\n"
        else:
            body_core += "आपकी विस्तृत सामग्री सूची शीघ्र पुष्टि की जाएगी।\n"
        body_core += f"\n[बुकिंग देखें]\n{link}\n\nॐ शांति,\nBSeva\n"
    else:
        subject = f"BSeva — Puja booking confirmed ({booking_number})"
        greeting = f"Namaste {customer_name or ''},"
        body_core = (
            f"Your BSeva Puja booking is confirmed.\n\n"
            f"Puja: {service_name}\nDate: {booking_date}\nTime: {start_time}\nBooking ID: {booking_number}\n\n"
        )
        if skip_samagri:
            body_core += "You chose to arrange Samagri / Alankaram yourself.\n"
        elif verified:
            body_core += "Please review the items required for your Puja (pujari will arrange as requested):\n"
        else:
            body_core += "Your detailed Samagri checklist will be confirmed shortly.\n"
        body_core += f"\n[View Booking]\n{link}\n\nOm Shanti,\nBSeva\n"

    text_body = f"{greeting}\n\n{body_core}"
    return send_email(to=to, subject=subject, text_body=text_body, from_addr=from_addr)


def send_booking_event_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    from_addr: str | None = None,
) -> dict[str, Any]:
    return send_email(to=to, subject=subject, text_body=text_body, from_addr=from_addr)
