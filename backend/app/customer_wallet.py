"""Customer wallet on/off (Super Admin setting `customer_wallet_enabled`).

When it is off, customers pay only through the payment gateway: no wallet payments, no top-ups and no wallet
rewards. Balances customers already had stay visible and are settled outside the app by a Super Admin
(`wallet_manual_refunds`). Pujari wallets (settlements, penalties, joining fee) are never affected.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.platform_config import get_setting

WALLET_OFF_MESSAGE = "Wallet payments are turned off. Please pay online."


def customer_wallet_enabled(db: Session) -> bool:
    """Off by default wherever online payment works; on only where there is no gateway, so customers can always
    pay. A Super Admin's explicit setting wins."""
    value = get_setting(db, "customer_wallet_enabled", None)
    if value is None:
        from app.payments.providers import active_gateway

        return active_gateway() is None
    if isinstance(value, str):
        return value.strip().lower() not in ("false", "0", "off", "no")
    return bool(value)


def require_customer_wallet(db: Session) -> None:
    if not customer_wallet_enabled(db):
        raise HTTPException(400, WALLET_OFF_MESSAGE)


def online_charges_required(db: Session) -> bool:
    """Customer payments go through the gateway (wallet off). A missing gateway is refused when starting one."""
    return not customer_wallet_enabled(db)
