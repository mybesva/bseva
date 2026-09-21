"""Customer/pujari-facing wallet labels — no demo/mock wording."""

from __future__ import annotations

import re

_DEMO_PAREN = re.compile(r"\s*\((?:demo|mock)[^)]*\)", re.I)
_DEMO_WORD = re.compile(r"\b(?:demo|mock)\b", re.I)
_SPACES = re.compile(r"\s{2,}")


def public_wallet_description(raw: str | None, fallback: str = "Wallet transaction") -> str:
    s = str(raw or "").strip()
    if not s:
        return fallback
    s = _DEMO_PAREN.sub("", s)
    s = _DEMO_WORD.sub("", s)
    s = _SPACES.sub(" ", s).strip(" -–")
    return s or fallback
