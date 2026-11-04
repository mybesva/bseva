"""Which forms ask for the image CAPTCHA (app.captcha).

Contact Us and Custom Puja always ask signed-out visitors: they are not settings, nothing reads a switch for
them, and the captcha_settings table cannot hold a row for them (CHECK in migration 040).

Registration and password sign-in, for customers and pujaris, each have one switch that only a Super Admin
can change. All four are ON by default. The switches are enforced only once CAPTCHA_SETTINGS_ENFORCEMENT is on
for the deployment, because the mobile app builds released before this one cannot show a CAPTCHA; until then
the saved values are kept and shown, and the clients are told no CAPTCHA is needed. A database that cannot be
read counts every switch as ON (fail closed).
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger("bseva.captcha")

# Always on for signed-out visitors; shown locked in Super Admin settings and never switchable.
MANDATORY = {
    "contact": "Contact Us",
    "custom_puja": "Custom Puja Request",
}
CONFIGURABLE = {
    "customer_register": "Customer Registration",
    "pujari_register": "Pujari Registration",
    "customer_login": "Customer Login",
    "pujari_login": "Pujari Login",
}
ACCOUNT_TYPES = ("customer", "pujari")


def enforcement_active() -> bool:
    return bool(settings.captcha_settings_enforcement)


def saved(db: Session) -> dict[str, dict]:
    """Every switchable form with its saved value and who last changed it. Missing rows count as ON."""
    out = {key: {"enabled": True, "updated_by_name": None, "updated_at": None} for key in CONFIGURABLE}
    try:
        rows = db.execute(
            text("SELECT feature, enabled, updated_by_name, updated_at FROM captcha_settings")
        ).mappings().all()
    except SQLAlchemyError:
        db.rollback()
        logger.error("CAPTCHA_SETTINGS_UNAVAILABLE (apply supabase/migrations/040); treating every switch as ON")
        return out
    for row in rows:
        if row["feature"] in out:
            out[row["feature"]] = {
                "enabled": bool(row["enabled"]),
                "updated_by_name": row["updated_by_name"],
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
    return out


def effective(db: Session) -> dict[str, bool]:
    """What the server enforces right now for each switchable form."""
    if not enforcement_active():
        return {key: False for key in CONFIGURABLE}
    return {key: value["enabled"] for key, value in saved(db).items()}


def register_required(db: Session, account_type: str | None) -> bool:
    """A registration code request without an account type is held to the stricter of the two switches."""
    on = effective(db)
    if account_type in ACCOUNT_TYPES:
        return on[f"{account_type}_register"]
    return on["customer_register"] or on["pujari_register"]


def login_required(db: Session, portal: str | None) -> bool:
    """Password sign-in. Admin sign-in is never asked; a request that names no portal gets the stricter one."""
    if portal == "admin":
        return False
    on = effective(db)
    if portal in ACCOUNT_TYPES:
        return on[f"{portal}_login"]
    return on["customer_login"] or on["pujari_login"]


def save(db: Session, feature: str, enabled: bool, actor: dict, ip: str | None) -> dict:
    """Set one switch and add the change to the security audit log, in one transaction. Super Admin only."""
    from app.sensitive_auth import log_event

    if feature not in CONFIGURABLE:
        raise KeyError(feature)
    before = saved(db)[feature]["enabled"]
    db.execute(
        text(
            """
            INSERT INTO captcha_settings (feature, enabled, updated_by, updated_by_name, updated_at)
            VALUES (:f, :e, CAST(:uid AS uuid), :name, NOW())
            ON CONFLICT (feature) DO UPDATE
              SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by,
                  updated_by_name = EXCLUDED.updated_by_name, updated_at = NOW()
            """
        ),
        {"f": feature, "e": bool(enabled), "uid": str(actor["id"]), "name": str(actor.get("name") or "Super Admin")},
    )
    state = lambda on: "ON" if on else "OFF"  # noqa: E731
    log_event(
        db,
        actor,
        "captcha_setting_change",
        "success",
        reason=f"{CONFIGURABLE[feature]}: {state(before)} -> {state(enabled)}",
        ip=ip,
    )
    db.commit()
    logger.warning(
        "SECURITY_EVENT kind=captcha_setting_change feature=%s enabled=%s actor=%s", feature, bool(enabled), actor["id"]
    )
    return saved(db)[feature]


def public_flags(db: Session) -> dict:
    """For /config/public: which forms show the CAPTCHA. Contact Us and Custom Puja are always true."""
    return {"captcha": {**{key: True for key in MANDATORY}, **effective(db)}}
