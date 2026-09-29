"""Ensure every supported locale has all seva UI keys."""

from __future__ import annotations

import importlib.util
from pathlib import Path


def _load_seva_locales():
    root = Path(__file__).resolve().parents[2]
    path = root / "packages" / "locales" / "src" / "resources" / "seva.ts"
    # Parse via executing a small python mirror — keys exported from TS module via build.
    # Use LANGS from constants through locales package index if built; fallback read keys from en dict in test.
    from app.i18n import SUPPORTED_LANGS

    # Mirror of packages/locales/src/resources/seva.ts keys — validated via Node-less import of compiled dict
    spec_path = root / "packages" / "locales" / "src" / "resources" / "seva.ts"
    text = spec_path.read_text(encoding="utf-8")
    en_block = text.split("const en: Dict = {", 1)[1].split("};", 1)[0]
    keys = []
    for line in en_block.splitlines():
        line = line.strip()
        if line.startswith('"seva.'):
            keys.append(line.split('"')[1])
    return keys, list(SUPPORTED_LANGS) + ["ml"]


def _parse_block(content: str, lang: str) -> dict[str, str]:
    marker = f"const {lang}: Dict = {{"
    block = content.split(marker, 1)[1].split("};", 1)[0]
    out: dict[str, str] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith('"seva.'):
            continue
        key = line.split('"')[1]
        value = line.split(":", 1)[1].strip().rstrip(",").strip().strip('"')
        out[key] = value
    return out


def test_seva_locale_key_parity():
    keys, langs = _load_seva_locales()
    root = Path(__file__).resolve().parents[2]
    seva_path = root / "packages" / "locales" / "src" / "resources" / "seva.ts"
    content = seva_path.read_text(encoding="utf-8")
    en_vals = _parse_block(content, "en")
    for lang in langs:
        marker = f"const {lang}: Dict = {{"
        assert marker in content, f"Missing {lang} block in seva.ts"
        block_vals = _parse_block(content, lang)
        for key in keys:
            assert key in block_vals, f"Missing {key} in {lang} seva locale"


def test_malayalam_seva_strings_not_english_fallback():
    """Malayalam must not copy English customer-visible seva strings."""
    root = Path(__file__).resolve().parents[2]
    content = (root / "packages" / "locales" / "src" / "resources" / "seva.ts").read_text(
        encoding="utf-8"
    )
    en_vals = _parse_block(content, "en")
    ml_vals = _parse_block(content, "ml")
    copied = [k for k, v in ml_vals.items() if v == en_vals.get(k)]
    assert not copied, f"Malayalam copies English for: {copied[:5]}"
