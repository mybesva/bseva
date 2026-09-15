"""Customer-facing optional add-on prices (Samagri kit, etc.)."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def customer_samagri_price_paise(db: Session, service: dict[str, Any] | Any) -> int:
    """Per-puja Samagri kit price for booking. 0 when not configured on the service."""
    if isinstance(service, dict):
        data = service
    else:
        data = dict(service)
    if data.get("samagri_available") is False:
        return 0
    return max(0, int(data.get("samagri_price_paise") or 0))
