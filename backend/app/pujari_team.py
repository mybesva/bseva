"""Pujari team size per service package (Standard / Premium / Basic)."""
from __future__ import annotations

PACKAGE_COLS = {
    "basic": "basic_pujaris_required",
    "standard": "standard_pujaris_required",
    "premium": "premium_pujaris_required",
}


def _clamp(n: int) -> int:
    return min(20, max(1, int(n)))


def pujaris_required_for_package(service: dict, package_type: str) -> int:
    pkg = (package_type or "standard").strip().lower()
    col = PACKAGE_COLS.get(pkg, "standard_pujaris_required")
    val = service.get(col)
    if val is not None:
        try:
            if int(val) >= 1:
                return _clamp(int(val))
        except (TypeError, ValueError):
            pass
    for fallback in (service.get("pujaris_required"), service.get("priests_min"), 1):
        if fallback is None:
            continue
        try:
            if int(fallback) >= 1:
                return _clamp(int(fallback))
        except (TypeError, ValueError):
            continue
    return 1


def package_pujaris_map(service: dict) -> dict[str, int]:
    return {
        "basic": pujaris_required_for_package(service, "basic"),
        "standard": pujaris_required_for_package(service, "standard"),
        "premium": pujaris_required_for_package(service, "premium"),
    }


def resolve_booking_pujaris_required(data: dict) -> int:
    snap = data.get("pujaris_required")
    if snap is not None:
        try:
            if int(snap) >= 1:
                return _clamp(int(snap))
        except (TypeError, ValueError):
            pass
    svc = {
        "basic_pujaris_required": data.get("basic_pujaris_required"),
        "standard_pujaris_required": data.get("standard_pujaris_required"),
        "premium_pujaris_required": data.get("premium_pujaris_required"),
        "pujaris_required": data.get("service_pujaris_required") or data.get("pujaris_required"),
        "priests_min": data.get("service_priests_min"),
    }
    return pujaris_required_for_package(svc, str(data.get("package_type") or "standard"))


def enrich_booking_pujari_team(data: dict) -> None:
    n = resolve_booking_pujaris_required(data)
    data["pujaris_required"] = n
    add = max(0, n - 1)
    data["additional_pujaris_required"] = add
    data["pujaris_included_label"] = "1 Pujari" if n == 1 else f"{n} Pujaris"
    if n > 1:
        data["pujari_team_customer_note"] = f"This package includes {n} Pujaris for your ritual."
        data["pujari_team_notice"] = (
            f"This booking requires {n} Pujaris. You need to bring {add} additional "
            f"Pujari{'s' if add != 1 else ''} with you."
        )
        data["pujari_payment_notice"] = (
            "The full Dakshina for this booking is paid to you as the assigned Pujari. "
            "Bring your team and distribute payment among them — BSeva does not assign or pay "
            "additional Pujaris separately."
        )
    else:
        data["pujari_team_customer_note"] = "This package includes 1 Pujari."
        data["pujari_team_notice"] = None
        data["pujari_payment_notice"] = None
