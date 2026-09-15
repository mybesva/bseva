"""First / middle / last name validation and display composition."""
from __future__ import annotations

from fastapi import HTTPException


def compose_display_name(first: str | None, middle: str | None, last: str | None) -> str:
    parts = [p.strip() for p in (first, middle, last) if p and str(p).strip()]
    return " ".join(parts)


def split_display_name(full: str | None) -> tuple[str, str, str]:
    s = (full or "").strip()
    if not s:
        return "", "", ""
    parts = s.split()
    if len(parts) == 1:
        return parts[0], "", ""
    if len(parts) == 2:
        return parts[0], "", parts[1]
    return parts[0], " ".join(parts[1:-1]), parts[-1]


def validate_name_parts(
    *,
    first: str | None,
    middle: str | None,
    last: str | None,
    require_last: bool = True,
) -> tuple[str, str, str]:
    f = (first or "").strip()
    m = (middle or "").strip()
    l = (last or "").strip()
    if len(f) < 3:
        raise HTTPException(400, "First name must be at least 3 characters")
    if require_last and not l:
        raise HTTPException(400, "Last name is required")
    return f, m, l
