"""Unit tests never reach a remote database or a payment gateway, whatever the repo .env files contain.

app.config (pydantic) and app.env_loader both let real environment variables win over .env files, so setting
them here, before any test imports the app, is enough. Real-database checks use their own throwaway loopback
database (tests/test_*_pg.py) and refuse any other host.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def _dotenv_value(key: str) -> str:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for path in (os.path.join(here, ".env"), os.path.join(os.path.dirname(here), ".env")):
        if os.path.isfile(path):
            for line in open(path, encoding="utf-8"):
                name, sep, value = line.strip().partition("=")
                if sep and name.strip() == key:
                    return value.strip().strip("'\"")
    return ""


_url = os.environ.get("DATABASE_URL") or _dotenv_value("DATABASE_URL")
_host = urlsplit(_url.replace("+psycopg", "")).hostname if _url else None
if _host not in LOOPBACK:
    # A placeholder that can only ever point at this machine; tests that need a database bring their own.
    os.environ["DATABASE_URL"] = "postgresql+psycopg://bseva-tests@127.0.0.1:5432/bseva_unit_tests_placeholder"

# Unit tests must not do DNS lookups for the sign-up email domain check.
os.environ.setdefault("EMAIL_DOMAIN_CHECK", "false")

for _key in (
    "PAYMENT_GATEWAY", "CASHFREE_PG_APP_ID", "CASHFREE_PG_SECRET_KEY", "CASHFREE_PAYOUT_CLIENT_ID",
    "CASHFREE_PAYOUT_CLIENT_SECRET", "CASHFREE_PAYOUT_PUBLIC_KEY", "CASHFREE_PAYOUT_PUBLIC_KEY_FILE",
):
    os.environ[_key] = ""
