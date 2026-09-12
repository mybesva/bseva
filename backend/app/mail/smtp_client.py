"""SMTP send with STARTTLS, retries, and safe logging (never log password/OTP)."""
from __future__ import annotations

import logging
import smtplib
import time
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any

from app.mail.smtp_config import load_smtp_config, smtp_status as _smtp_status

logger = logging.getLogger("bseva.email")

MAX_ATTEMPTS = 3
RETRY_BACKOFF_SEC = (0.5, 1.5, 3.0)


def smtp_configured() -> bool:
    return load_smtp_config() is not None


def smtp_status() -> dict[str, Any]:
    return _smtp_status()


def send_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    from_addr: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
) -> dict[str, Any]:
    """Send email via Zoho SMTP or return queued stub when not configured."""
    cfg = load_smtp_config()
    to_addr = (to or "").strip()
    if not to_addr or "@" not in to_addr:
        return {"ok": False, "status": "failed", "error": "invalid_recipient", "to": to, "subject": subject}

    if not cfg:
        logger.info("EMAIL_QUEUED (SMTP not configured) to=%s subject=%s", to_addr, subject)
        return {
            "ok": True,
            "status": "queued",
            "reason": "SMTP not configured",
            "to": to_addr,
            "subject": subject,
        }

    display_from = from_addr or cfg.from_email
    display_name = from_name if from_name is not None else cfg.from_name
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((display_name, display_from)) if display_name else display_from
    msg["To"] = to_addr
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text_body or "")
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    last_error: str | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with smtplib.SMTP(cfg.host, cfg.port, timeout=30) as smtp:
                if cfg.use_starttls:
                    smtp.starttls()
                smtp.login(cfg.username, cfg.password)
                smtp.send_message(msg)
            logger.info(
                "EMAIL_SENT to=%s subject=%s attempt=%s",
                to_addr,
                subject,
                attempt,
            )
            return {
                "ok": True,
                "status": "sent",
                "to": to_addr,
                "subject": subject,
                "from": display_from,
                "attempt": attempt,
            }
        except Exception as e:
            last_error = type(e).__name__
            logger.warning(
                "EMAIL_ATTEMPT_FAILED to=%s subject=%s attempt=%s error_type=%s",
                to_addr,
                subject,
                attempt,
                last_error,
            )
            # Auth / permanent failures won't recover on retry
            if last_error in ("SMTPAuthenticationError", "SMTPRecipientsRefused", "SMTPSenderRefused"):
                break
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_SEC[min(attempt - 1, len(RETRY_BACKOFF_SEC) - 1)])

    logger.error("EMAIL_FAILED to=%s subject=%s error_type=%s", to_addr, subject, last_error)
    return {
        "ok": False,
        "status": "failed",
        "error": last_error or "send_failed",
        "to": to_addr,
        "subject": subject,
        "from": display_from,
    }
