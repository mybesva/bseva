"""Cloudflare Turnstile verification for public web forms.

Each form has a mode in settings: off, monitor (failures are logged and the request goes ahead) or enforce
(failures are refused). Without TURNSTILE_SECRET_KEY nothing can be verified, so every mode behaves as off and
the first request logs that once. The mobile apps cannot show Turnstile, so callers exempt signed-in users and
keep OTP requests at monitor until app attestation exists.
"""
from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from urllib.parse import urlsplit

from app.config import settings
from app.i18n import coded_http

logger = logging.getLogger("bseva.bot_check")

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
MODES = ("off", "monitor", "enforce")
_warned_unconfigured = False


def mode(raw: str | None) -> str:
    value = (raw or "").strip().lower()
    return value if value in MODES else "monitor"


def _allowed_hostnames() -> set[str]:
    hosts = set()
    for url in [settings.public_app_url, *settings.cors_origin_list]:
        host = urlsplit(url).hostname
        if host:
            hosts.add(host.lower())
    return hosts


def verify_turnstile(token: str | None, *, ip: str | None, action: str) -> tuple[bool, str]:
    """(passed, reason). Network or Cloudflare errors count as a failure."""
    secret = (settings.turnstile_secret_key or "").strip()
    if not token or not str(token).strip():
        return False, "missing_token"
    data = {"secret": secret, "response": str(token).strip()[:2048]}
    if ip and ip != "unknown":
        data["remoteip"] = ip
    try:
        with urllib.request.urlopen(SITEVERIFY_URL, data=urllib.parse.urlencode(data).encode(), timeout=8) as resp:
            payload = json.loads(resp.read().decode())
    except Exception as exc:  # noqa: BLE001 - any failure to reach Cloudflare is a failed check
        logger.warning("BOT_CHECK_UNREACHABLE action=%s error=%s", action, type(exc).__name__)
        return False, "verify_unreachable"
    if not payload.get("success"):
        codes = ",".join(str(c) for c in payload.get("error-codes") or []) or "rejected"
        return False, f"rejected:{codes}"[:80]
    if payload.get("action") and payload.get("action") != action:
        return False, "wrong_action"
    hostname = str(payload.get("hostname") or "").lower()
    allowed = _allowed_hostnames()
    if hostname and allowed and hostname not in allowed:
        return False, "wrong_hostname"
    return True, "ok"


def check(token: str | None, *, ip: str | None, action: str, form_mode: str) -> str | None:
    """Run the check for one form. Returns None when it passed or was skipped, else the failure reason.

    Raises 400 BOT_CHECK_FAILED only in enforce mode."""
    global _warned_unconfigured
    current = mode(form_mode)
    if current == "off":
        return None
    if not (settings.turnstile_secret_key or "").strip():
        if not _warned_unconfigured:
            logger.warning("BOT_CHECK_NOT_CONFIGURED TURNSTILE_SECRET_KEY is empty; web bot checks are skipped")
            _warned_unconfigured = True
        return None
    passed, reason = verify_turnstile(token, ip=ip, action=action)
    if passed:
        return None
    logger.warning("SECURITY_EVENT kind=bot_check_failed action=%s reason=%s mode=%s", action, reason, current)
    if current == "enforce":
        raise coded_http(400, "BOT_CHECK_FAILED", "Please complete the verification and try again.")
    return reason


def public_config() -> dict:
    """What the web client needs to render the widget. The secret never leaves the server."""
    site_key = (settings.turnstile_site_key or "").strip()
    configured = bool(site_key and (settings.turnstile_secret_key or "").strip())
    return {
        "turnstile_site_key": site_key if configured else "",
        "contact_bot_check": mode(settings.contact_bot_check) if configured else "off",
        "otp_bot_check": mode(settings.otp_bot_check) if configured else "off",
    }
