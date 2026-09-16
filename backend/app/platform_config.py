"""Central platform settings (DB-backed feature flags / business config)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

_DEFAULTS: dict[str, Any] = {
    "virtual_puja_enabled": False,
    "pujari_settlement_days": 14,
    "loyalty_pujari_puja_count": 10,
    "loyalty_pujari_reward_paise": 50000,
    "loyalty_pujari_active": True,
    "referral_customer_reward_paise": 10000,
    "referral_pujari_reward_paise": 10000,
    "referral_customer_active": True,
    "referral_pujari_active": True,
    "puja_start_otp_before_minutes": 15,
    "pujari_location_tracking_before_minutes": 15,
    "pujari_full_booking_details_before_hours": 20,
    "pujari_gps_update_interval_seconds": 60,
    "customer_tracking_refresh_seconds": 60,
    "pujari_arrival_radius_meters": 100,
    "pujari_arrival_confirm_pings": 2,
    "puja_complete_otp_before_minutes": 15,
    "puja_otp_expiry_minutes": 240,
    "puja_complete_otp_expiry_minutes": 480,
    "puja_otp_resend_cooldown_seconds": 60,
    "puja_otp_max_requests_per_hour": 5,
    "puja_otp_max_verify_attempts": 5,
    "puja_otp_lock_minutes": 10,
    "bseva_whatsapp_number": "919014654994",
    "email_from_accounts": "accounts@b-seva.com",
    "email_from_support": "support@b-seva.com",
    "email_from_admin": "admin@b-seva.com",
    "email_from_info": "info@b-seva.com",
    "email_from_contact": "contact@b-seva.com",
    "invoice_brand_name": "BSeva",
    "invoice_company_name": "BSeva Services Private Limited",
    "invoice_company_address": "123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India",
    "invoice_company_state": "Telangana",
    "invoice_company_pincode": "500034",
    "invoice_company_email": "support@b-seva.com",
    "invoice_company_phone": "",
    "invoice_gstin": "",
    "invoice_pan": "",
    "invoice_website": "www.b-seva.com",
    "invoice_logo_path": "",
    "invoice_prefix_customer": "BSEVA",
    "invoice_prefix_settlement": "INV-S",
    "invoice_signatory_name": "",
    "invoice_signatory_designation": "Authorized Signatory",
    "invoice_sac_code": "999799",
    "invoice_hsn_code": "",
    "invoice_terms": "This invoice is issued for puja/religious services booked on BSeva. GST, if charged, is as applicable under Indian tax law. Disputes are subject to Hyderabad jurisdiction.",
    "invoice_notes": "Thank you for choosing BSeva.",
    # Pujari joining fee (optional)
    "pujari_joining_fee_enabled": False,
    "pujari_joining_fee_paise": 0,
    # Pujari no-show: 100% of that puja's cost is deducted from the pujari wallet
    "pujari_no_show_penalty_enabled": True,
    # Cancellation charges (customer) — % of booking total
    "customer_cancel_fee_over_48h_percent": 10,
    "customer_cancel_fee_24_48h_percent": 50,
    "customer_cancel_fee_under_24h_percent": 100,
    "customer_cancel_min_hours": 24,
    # Cancellation charges (pujari) — % of booking total; under 24h = 100% of puja cost (no-show)
    "pujari_cancel_fee_over_48h_percent": 10,
    "pujari_cancel_fee_24_48h_percent": 50,
    "pujari_cancel_fee_under_24h_percent": 100,
    "pujari_cancel_min_hours": 24,
    # CAPTCHA (public registration) — keys via env, not stored as secrets in DB
    "registration_captcha_enabled": False,
    # Suggested puja package list prices (paise) — Admin overrides per service
    "default_package_basic_paise": 249900,
    "default_package_standard_paise": 349900,
    "default_package_premium_paise": 449900,
    # Optional Samagri kit on booking when a puja has no per-service price set (₹500 default)
    "default_samagri_kit_price_paise": 50000,
    # Admin reassignment distance rings (km)
    "assign_distance_rings_km": [10, 15, 20, 30],
    # After puja end, pujari unavailable for this many hours (same before puja start)
    "pujari_schedule_buffer_hours": 4,
    "weekend_surge_mode": "percent",
    "weekend_surge_percent": 0,
    "weekend_surge_paise": 0,
    "festival_surge_mode": "amount",
    "festival_surge_percent": 0,
    "festival_surge_paise": 0,
    "festival_surge_dates": [],
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
