"""Encryption at rest for sensitive columns (bank account numbers). Fernet, key from DATA_ENCRYPTION_KEY.

Values are stored as "enc:v1:<token>". Without a key, values are stored as before and a warning is logged,
so an environment without the key keeps working. Losing the key makes stored values unreadable: keep it in
the secret store with a backup.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

logger = logging.getLogger("bseva.crypto")
PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet():
    key = (os.environ.get("DATA_ENCRYPTION_KEY") or "").strip()
    if not key:
        return None
    from cryptography.fernet import Fernet

    return Fernet(key.encode())


def encryption_enabled() -> bool:
    return _fernet() is not None


def encrypt_value(value: str | None) -> str | None:
    if value is None or value == "" or str(value).startswith(PREFIX):
        return value
    f = _fernet()
    if f is None:
        logger.warning("DATA_ENCRYPTION_KEY is not set; a sensitive value was stored without encryption")
        return value
    return PREFIX + f.encrypt(str(value).encode()).decode()


def decrypt_value(value: str | None) -> str | None:
    if not value or not str(value).startswith(PREFIX):
        return value
    f = _fernet()
    if f is None:
        logger.error("Encrypted value found but DATA_ENCRYPTION_KEY is not set")
        return None
    try:
        return f.decrypt(str(value)[len(PREFIX):].encode()).decode()
    except Exception:
        logger.error("Could not decrypt a stored value (wrong key?)")
        return None


ENCRYPTED_COLUMNS = ("bank_account_number",)


def encrypt_existing_bank_numbers(db) -> int:
    """One-off backfill, enabled per environment with BANK_ENCRYPTION_BACKFILL=1 once the key is in place."""
    from sqlalchemy import text

    if not encryption_enabled() or (os.environ.get("BANK_ENCRYPTION_BACKFILL") or "").strip() not in ("1", "true"):
        return 0
    rows = db.execute(
        text(
            """
            SELECT user_id, bank_account_number FROM pujari_profiles
            WHERE bank_account_number IS NOT NULL AND bank_account_number <> '' AND bank_account_number NOT LIKE 'enc:v1:%'
            LIMIT 500
            """
        )
    ).mappings().all()
    for r in rows:
        db.execute(
            text("UPDATE pujari_profiles SET bank_account_number = :v WHERE user_id = :id AND bank_account_number = :old"),
            {"v": encrypt_value(r["bank_account_number"]), "id": r["user_id"], "old": r["bank_account_number"]},
        )
    db.commit()
    return len(rows)
