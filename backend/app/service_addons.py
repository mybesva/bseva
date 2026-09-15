"""Customer-facing optional add-on prices (Samagri kit, etc.)."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.platform_config import get_setting


def customer_samagri_price_paise(db: Session, service: dict[str, Any] | Any) -> int:
    """Per-puja Samagri kit price for booking; falls back to platform default when unset."""
    if isinstance(service, dict):
        data = service
    else:
        data = dict(service)
    if data.get("samagri_available") is False:
        return 0
    explicit = int(data.get("samagri_price_paise") or 0)
    if explicit > 0:
        return explicit
    return max(0, int(get_setting(db, "default_samagri_kit_price_paise", 50000) or 0))
