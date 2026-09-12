"""Zoho SMTP configuration — credentials from environment only."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SmtpConfig:
    host: str
    port: int
    username: str
    password: str
    from_email: str
    from_name: str
    use_starttls: bool = True

    @property
    def from_header(self) -> str:
        name = (self.from_name or "").strip()
        if name:
            return f"{name} <{self.from_email}>"
        return self.from_email


def _first(*keys: str, default: str = "") -> str:
    for k in keys:
        v = (os.getenv(k) or "").strip()
        if v:
            return v
    return default


def load_smtp_config() -> SmtpConfig | None:
    """Prefer ZOHO_* vars; fall back to legacy SMTP_* for compatibility."""
    host = _first("ZOHO_SMTP_HOST", "SMTP_HOST", default="smtp.zoho.com")
    port_s = _first("ZOHO_SMTP_PORT", "SMTP_PORT", default="587")
    username = _first("ZOHO_SMTP_USERNAME", "SMTP_USER")
    password = _first("ZOHO_SMTP_PASSWORD", "SMTP_PASSWORD")
    from_email = _first("ZOHO_FROM_EMAIL", "SMTP_FROM", default=username or "admin@b-seva.com")
    from_name = _first("ZOHO_FROM_NAME", default="BSeva")
    if not (host and username and password and from_email):
        return None
    try:
        port = int(port_s or "587")
    except ValueError:
        port = 587
    return SmtpConfig(
        host=host,
        port=port,
        username=username,
        password=password,
        from_email=from_email,
        from_name=from_name,
        use_starttls=True,
    )


def smtp_status() -> dict[str, Any]:
    cfg = load_smtp_config()
    missing = []
    for label, keys in (
        ("host", ("ZOHO_SMTP_HOST", "SMTP_HOST")),
        ("username", ("ZOHO_SMTP_USERNAME", "SMTP_USER")),
        ("password", ("ZOHO_SMTP_PASSWORD", "SMTP_PASSWORD")),
        ("from_email", ("ZOHO_FROM_EMAIL", "SMTP_FROM")),
    ):
        if not _first(*keys):
            missing.append(label)
    return {
        "configured": cfg is not None,
        "provider": "zoho" if (os.getenv("ZOHO_SMTP_HOST") or os.getenv("ZOHO_SMTP_USERNAME")) else "smtp",
        "host": cfg.host if cfg else (_first("ZOHO_SMTP_HOST", "SMTP_HOST") or None),
        "port": cfg.port if cfg else int(_first("ZOHO_SMTP_PORT", "SMTP_PORT", default="587") or 587),
        "from_email": cfg.from_email if cfg else None,
        "from_name": cfg.from_name if cfg else None,
        "missing": missing,
    }


def app_base_url() -> str:
    return (
        _first("PUBLIC_APP_URL", "VITE_APP_URL", default="https://bseva.vercel.app").rstrip("/")
        or "https://bseva.vercel.app"
    )


def support_email() -> str:
    return _first("ZOHO_FROM_EMAIL", "SMTP_FROM", default="admin@b-seva.com") or "admin@b-seva.com"


def support_phone_display() -> str:
    return _first("BSEVA_SUPPORT_PHONE", default="+91 98765 43210")
