"""Central platform settings (DB-backed feature flags / business config)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

_DEFAULTS: dict[str, Any] = {
    "virtual_puja_enabled": False,
    "pujari_settlement_days": 14,
    "pujari_share_percent": 85,
    "loyalty_pujari_puja_count": 10,
    "loyalty_pujari_reward_paise": 50000,
    "loyalty_pujari_active": True,
    "referral_customer_reward_paise": 10000,
    "referral_pujari_reward_paise": 10000,
    "referral_customer_active": True,
    "referral_pujari_active": True,
    "puja_start_otp_before_minutes": 10,
    "pujari_location_tracking_before_minutes": 15,
    "pujari_full_booking_details_before_hours": 24,
    "bseva_whatsapp_number": "919876543210",
    "email_from_accounts": "accounts@b-seva.com",
    "email_from_support": "support@b-seva.com",
    "email_from_admin": "admin@b-seva.com",
    "email_from_info": "info@b-seva.com",
    "email_from_contact": "contact@b-seva.com",
    "invoice_company_name": "BSeva",
    "invoice_gstin": "",
    "invoice_company_address": "",
    "invoice_prefix_customer": "INV-C",
    "invoice_prefix_settlement": "INV-S",
}


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    row = db.execute(
        text("SELECT value FROM platform_settings WHERE key = :k"),
        {"k": key},
    ).first()
    if not row:
        return _DEFAULTS.get(key, default)
    val = row[0]
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val


def get_all_settings(db: Session) -> dict[str, Any]:
    out = dict(_DEFAULTS)
    try:
        rows = db.execute(text("SELECT key, value, description, updated_at FROM platform_settings")).mappings().all()
        for r in rows:
            out[r["key"]] = r["value"]
    except Exception:
        pass
    return out


def set_setting(db: Session, key: str, value: Any, user_id: str | None = None) -> None:
    db.execute(
        text(
            """
            INSERT INTO platform_settings (key, value, updated_by, updated_at)
            VALUES (:k, CAST(:v AS jsonb), CAST(:u AS uuid), NOW())
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value,
              updated_by = EXCLUDED.updated_by,
              updated_at = NOW()
            """
        ),
        {
            "k": key,
            "v": json.dumps(value),
            "u": user_id,
        },
    )
