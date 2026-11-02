"""Public contact / custom puja form: validation, abuse checks, a durable record, then team mail.

Order matters. Rate limits run first and fail closed, because this endpoint sends mail. Every submission that
gets past them is stored, including the ones refused as spam, before any mail is sent. Visitors get the same
reply whatever happened to their submission, so a bot learns nothing from it. The acknowledgement sent to
the visitor's address contains no visitor-supplied text, so the form cannot relay content to third parties.
"""
from __future__ import annotations

import hashlib
import logging
import re
import unicodedata

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import captcha, rate_limit
from app.config import settings

logger = logging.getLogger("bseva.contact")

MIN_FILL_MS = 3000  # a person needs longer than this to fill in five fields
MAX_LINKS = 5
DUPLICATE_HOURS = 24
ACCEPTED_REPLY = "Thank you. Your message has been received. We will get back to you soon."
BUSY = "Too many messages sent. Please try again later or email us directly."

_EMAIL_RE = re.compile(r"^[^@\s<>\"']+@[^@\s<>\"']+\.[^@\s<>\"']+$")
_LINK_RE = re.compile(r"(https?://|www\.)", re.I)
_LINKISH_RE = re.compile(r"(https?://|www\.|<|>|@|\.(com|net|org|ru|xyz|top|info|io)\b)", re.I)


def _clean_line(value: str) -> str:
    """One line of plain text: control and format characters removed, whitespace collapsed."""
    kept = "".join(" " if unicodedata.category(ch)[0] == "C" else ch for ch in value or "")
    return re.sub(r"\s+", " ", kept).strip()


def _clean_message(value: str) -> str:
    kept = "".join(ch for ch in value or "" if ch in "\n\t" or unicodedata.category(ch)[0] != "C")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in kept.replace("\r", "").split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


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


def normalize(body) -> dict:
    """Server-side validation. Raises 400 with a message a real visitor can act on."""
    name = _clean_line(body.name)
    email = _clean_line(body.email).lower()
    subject = _clean_line(body.subject)[:200]
    message = _clean_message(body.message)
    if len(name) < 2 or not any(ch.isalpha() for ch in name):
        raise HTTPException(400, "Enter your name")
    if _LINKISH_RE.search(name):
        raise HTTPException(400, "Enter your name without links or email addresses")
    if not _EMAIL_RE.match(email) or len(email) > 200:
        raise HTTPException(400, "Enter a valid email address")
    if len(subject) < 3 or _LINK_RE.search(subject) or "<" in subject or ">" in subject:
        raise HTTPException(400, "Enter a short subject without links")
    if len(message) < 10:
        raise HTTPException(400, "Please write a message of at least 10 characters")
    phone_display, phone_e164 = _normalize_contact_phone(body.country_code, body.phone)
    return {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "phone_display": phone_display,
        "phone_e164": phone_e164,
    }


def content_hash(email: str, message: str) -> str:
    folded = re.sub(r"\s+", " ", message).strip().lower()
    return hashlib.sha256(f"{email}\n{folded}".encode()).hexdigest()


def _enforce_limits(db: Session, *, client_key: str, email: str, phone: str) -> None:
    for rule, key in (
        (rate_limit.CONTACT_IP, client_key),
        (rate_limit.CONTACT_IP_DAY, client_key),
        (rate_limit.CONTACT_EMAIL, email),
        (rate_limit.CONTACT_EMAIL_DAY, email),
        (rate_limit.CONTACT_PHONE_DAY, phone),
    ):
        rate_limit.enforce(db, rule, key, BUSY, fail_closed=True)


def _team_budget_left(db: Session) -> bool:
    """Whole-deployment cap on contact mail to the team, per clock hour."""
    bucket, _limit, window = rate_limit.CONTACT_TEAM_EMAILS_HOUR
    limit = int(settings.contact_team_emails_per_hour)
    try:
        count = rate_limit.record(db, (bucket, limit, window), rate_limit.GLOBAL_KEY, fail_closed=True)
    except rate_limit.StoreUnavailable:
        raise rate_limit.unavailable() from None
    return count <= limit


def _team_recipients(db: Session) -> list[str]:
    from app.mail.smtp_config import load_smtp_config
    from app.platform_config import get_setting

    cfg = load_smtp_config()
    recipients: list[str] = []
    # Always include the authenticated mailbox so mail is visible even if aliases lag.
    for addr in (
        str(get_setting(db, "email_from_contact", "") or ""),
        str(get_setting(db, "email_from_support", "") or ""),
        (cfg.from_email if cfg else "") or "",
        "admin@b-seva.com",
    ):
        a = addr.strip().lower()
        if a and "@" in a and a not in recipients:
            recipients.append(a)
    return recipients or ["admin@b-seva.com"]


def _volume_alert(db: Session) -> None:
    """At most once per hour: tell the team that contact mail is being held back."""
    try:
        first = rate_limit.record(db, rate_limit.CONTACT_VOLUME_ALERT_HOUR, rate_limit.GLOBAL_KEY, fail_closed=True) == 1
    except rate_limit.StoreUnavailable:
        return
    db.commit()
    if not first:
        return
    limit = int(settings.contact_team_emails_per_hour)
    logger.critical("CONTACT_VOLUME_ALERT limit_per_hour=%s", limit)
    try:
        from app.routers.notifications import notify_ops_staff

        notify_ops_staff(
            db,
            title="Contact form volume alert",
            body=f"More than {limit} contact messages arrived this hour. New ones are saved without email; review them in Support.",
            category="ops",
        )
        db.commit()
    except Exception:  # noqa: BLE001 - the alert must never fail the visitor's request
        db.rollback()
        logger.exception("CONTACT_VOLUME_ALERT_NOTIFY_FAILED")
    try:
        from app.mail.smtp_client import send_email
        from app.mail.templates import admin_notification_email

        content = admin_notification_email(
            title="Contact form volume alert",
            message=(
                f"More than {limit} website contact messages arrived within one hour. Further messages this hour "
                "are saved but not emailed. This often means automated spam. Review them in the admin Support area."
            ),
        )
        for inbox in _team_recipients(db):
            send_email(to=inbox, subject=content.subject, text_body=content.text, html_body=content.html)
    except Exception:  # noqa: BLE001
        logger.exception("CONTACT_VOLUME_ALERT_EMAIL_FAILED")


def submit(db: Session, body, request: Request, user: dict | None) -> dict:
    fields = normalize(body)
    ip = rate_limit.client_ip(request)
    user_agent = str(request.headers.get("user-agent") or "")[:300]
    signed_in = bool(user)
    # Signed-in users (the mobile apps) are counted per account, anonymous visitors per address.
    client_key = f"user:{user['id']}" if signed_in else ip
    _enforce_limits(db, client_key=client_key, email=fields["email"], phone=fields["phone_e164"])
    if not signed_in:
        # Contact Us and Custom Puja: signed-out visitors must always answer the image CAPTCHA (no setting
        # turns this off). A refused answer is not stored (the visitor retries).
        captcha.require(
            db, getattr(body, "captcha_id", None), getattr(body, "captcha_answer", None), purpose="contact", ip=ip
        )

    spam_reason: str | None = None
    if (getattr(body, "website", None) or "").strip():
        spam_reason = "honeypot"
    elif not signed_in:
        elapsed = getattr(body, "elapsed_ms", None)
        if elapsed is not None and elapsed < MIN_FILL_MS:
            spam_reason = "too_fast"
    if not spam_reason and len(_LINK_RE.findall(fields["message"])) > MAX_LINKS:
        spam_reason = "too_many_links"

    digest = content_hash(fields["email"], fields["message"])
    status = "spam" if spam_reason else "accepted"
    if status == "accepted":
        seen = db.execute(
            text(
                """
                SELECT 1 FROM contact_submissions
                WHERE content_hash = :h AND status IN ('accepted', 'held')
                  AND created_at > NOW() - make_interval(hours => :hrs)
                LIMIT 1
                """
            ),
            {"h": digest, "hrs": DUPLICATE_HOURS},
        ).first()
        if seen:
            status = "duplicate"
    if status == "accepted" and not _team_budget_left(db):
        status = "held"

    source = _clean_line(getattr(body, "source", None) or ("app" if signed_in else "web"))[:32] or "web"
    submission_id = db.execute(
        text(
            """
            INSERT INTO contact_submissions
              (user_id, source, name, email, phone, subject, message, content_hash, status, spam_reason, client_ip, user_agent)
            VALUES (CAST(:uid AS uuid), :src, :name, :email, :phone, :subject, :message, :h, :status, :reason, :ip, :ua)
            RETURNING id
            """
        ),
        {
            "uid": user["id"] if signed_in else None,
            "src": source,
            "name": fields["name"],
            "email": fields["email"],
            "phone": fields["phone_display"],
            "subject": fields["subject"],
            "message": fields["message"],
            "h": digest,
            "status": status,
            "reason": spam_reason,
            "ip": ip,
            "ua": user_agent,
        },
    ).scalar()
    db.commit()
    logger.info(
        "CONTACT_SUBMISSION id=%s status=%s reason=%s signed_in=%s",
        submission_id, status, spam_reason or "-", signed_in,
    )
    if status == "spam":
        logger.warning("SECURITY_EVENT kind=contact_spam reason=%s", spam_reason)
    if status == "held":
        _volume_alert(db)
    if status == "accepted":
        _send_team_mail(db, submission_id, fields)
        _send_acknowledgement(fields["email"])
    return {"ok": True, "message": ACCEPTED_REPLY}


def _send_team_mail(db: Session, submission_id, fields: dict) -> None:
    from app.mail.smtp_client import send_email
    from app.mail.templates import admin_notification_email

    # Every value is HTML-escaped by the template.
    content = admin_notification_email(
        title=f"Website contact: {fields['subject']}",
        message=fields["message"],
        details=[
            ("Name", fields["name"]),
            ("Email", fields["email"]),
            ("Phone", fields["phone_display"]),
            ("Subject", fields["subject"]),
        ],
    )
    delivered = 0
    # Send per recipient so one bad alias does not block the others. From stays the authenticated mailbox.
    for inbox in _team_recipients(db):
        result = send_email(
            to=inbox,
            subject=content.subject,
            text_body=content.text,
            html_body=content.html,
            reply_to=fields["email"],
        )
        # "queued" (no SMTP) and "suppressed" (QA allowlist) report ok but reach nobody.
        delivered += 1 if result.get("ok") and result.get("status") == "sent" else 0
    if delivered:
        db.execute(
            text("UPDATE contact_submissions SET team_emailed_at = NOW() WHERE id = :id"),
            {"id": submission_id},
        )
        db.commit()
    else:
        # The message is saved either way; it stays visible in admin with no team_emailed_at.
        logger.error("CONTACT_TEAM_EMAIL_FAILED id=%s", submission_id)


def _send_acknowledgement(email: str) -> None:
    from app.mail.smtp_client import send_email
    from app.mail.templates import contact_received_email

    content = contact_received_email()
    try:
        send_email(to=email, subject=content.subject, text_body=content.text, html_body=content.html)
    except Exception:  # noqa: BLE001 - best effort
        logger.exception("CONTACT_ACK_FAILED")
