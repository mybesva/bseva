"""Payments, refunds and payouts against a real PostgreSQL database (Cashfree HTTP is MOCKED in-process).

A throwaway database is built by the real deploy step (`python -m app.db_bootstrap`) plus the demo seed, then
each check in tests/payments_pg_checks.py runs in its own subprocess with mail and every gateway credential
blanked, so no check can reach Cashfree, a mailbox or a remote database. Set BSEVA_TEST_PG_URL to a loopback
server, for example:

    BSEVA_TEST_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres python -m pytest tests/test_payments_pg.py

Without it these tests skip, unless REQUIRE_PG_TESTS=1 (CI), which turns the skip into a failure.
"""
from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest

BACKEND = Path(__file__).resolve().parents[1]
PG_URL = os.environ.get("BSEVA_TEST_PG_URL", "").strip()
# Present in the repo .env files; blanked so nothing can reach a real mailbox, gateway or service.
BLANKED = (
    "ZOHO_SMTP_HOST", "ZOHO_SMTP_PORT", "ZOHO_SMTP_USERNAME", "ZOHO_SMTP_PASSWORD", "ZOHO_FROM_EMAIL",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CRON_SECRET",
    "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_SERVICE_ACCOUNT_FILE", "FIREBASE_SERVICE_ACCOUNT_JSON",
    "TURNSTILE_SECRET_KEY", "TURNSTILE_SITE_KEY", "RECAPTCHA_SECRET_KEY", "EMAIL_ALLOWLIST",
    "CASHFREE_PG_APP_ID", "CASHFREE_PG_SECRET_KEY", "CASHFREE_PAYOUT_CLIENT_ID", "CASHFREE_PAYOUT_CLIENT_SECRET",
    "CASHFREE_PAYOUT_PUBLIC_KEY", "CASHFREE_PAYOUT_PUBLIC_KEY_FILE", "PAYMENT_WEBHOOK_BASE_URL",
)


def _checks() -> list[str]:
    source = (BACKEND / "tests" / "payments_pg_checks.py").read_text()
    return [line.split("(")[0][len("def check_"):] for line in source.splitlines() if line.startswith("def check_")]


def _server_url(database: str) -> str:
    parts = urlsplit(PG_URL)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def _env(database: str) -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "PYTHONDONTWRITEBYTECODE": "1",
        "ENVIRONMENT": "development",
        "JWT_SECRET": "payments-checks-jwt-secret-0123456789abcdef",
        "OTP_DEV_CODE": "246810",
        "PUBLIC_APP_URL": "https://bseva.example",
        "DATABASE_URL": _server_url(database).replace("postgresql://", "postgresql+psycopg://", 1),
        **{key: "" for key in BLANKED},
    }


@pytest.fixture(scope="module")
def database():
    if not PG_URL:
        if os.environ.get("REQUIRE_PG_TESTS") == "1":
            pytest.fail("REQUIRE_PG_TESTS=1 but BSEVA_TEST_PG_URL is not set")
        pytest.skip("BSEVA_TEST_PG_URL is not set")
    assert urlsplit(PG_URL).hostname in ("127.0.0.1", "localhost", "::1"), "refusing a non-loopback test server"
    psycopg = pytest.importorskip("psycopg")
    name = f"bseva_payments_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(_server_url("postgres"), autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')
    try:
        for step in (["-m", "app.db_bootstrap"], ["-m", "app.db_bootstrap", "--seed-demo"]):
            done = subprocess.run(
                [sys.executable, *step], cwd=BACKEND, env=_env(name), capture_output=True, text=True, timeout=300,
            )
            assert done.returncode == 0, done.stdout[-3000:] + done.stderr[-3000:]
        yield name
    finally:
        with psycopg.connect(_server_url("postgres"), autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


@pytest.mark.parametrize("check", _checks())
def test_payments(database, check):
    done = subprocess.run(
        [sys.executable, "tests/payments_pg_checks.py", check], cwd=BACKEND, env=_env(database),
        capture_output=True, text=True, timeout=240,
    )
    assert done.returncode == 0 and f"PASS {check}" in done.stdout, done.stdout[-3000:] + done.stderr[-6000:]
