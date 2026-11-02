"""OTP limits, contact-form protection and fail-closed behaviour against a real PostgreSQL database.

A throwaway database is built by the real deploy step (`python -m app.db_bootstrap`, so migration 037 is
included), then each check in tests/abuse_pg_checks.py runs in its own subprocess with every SMTP setting
blanked. Set BSEVA_TEST_PG_URL to a loopback server, for example:

    BSEVA_TEST_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres python -m pytest tests/test_abuse_protection_pg.py

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
CHECKS = [
    "otp_five_then_sixth",
    "otp_cooldown",
    "otp_rolling_reset",
    "otp_concurrency",
    "otp_invalid_lockout_expiry_replay",
    "otp_no_enumeration",
    "ip_limit",
    "global_otp_breaker",
    "registration_customer_and_pujari",
    "register_no_enumeration",
    "super_admin_two_factor_preserved",
    "sensitive_action_not_capped_daily",
    "contact_accepted_and_duplicate",
    "contact_bot_signals",
    "contact_injection",
    "contact_limits",
    "contact_global_cap",
    "datastore_failure_fails_closed",
    "captcha_contact_enforced",
    "captcha_answer_never_exposed",
    "captcha_single_use_expiry_refresh_tamper",
    "captcha_concurrent_use",
    "captcha_rate_limits",
    "captcha_fails_closed",
    "captcha_settings_default_on_and_rollout_switch",
    "captcha_mandatory_cannot_be_disabled",
    "captcha_switches_super_admin_only_and_audited",
    "captcha_registration_switches",
    "captcha_login_switches",
    "account_codes_five_then_sixth_and_cooldown",
    "account_codes_no_enumeration",
    "account_codes_ip_limits",
    "account_codes_global_breaker",
    "account_codes_fail_closed",
    "password_reset_customer_and_pujari",
    "password_reset_expiry_and_attempts",
    "password_reset_not_for_admins",
    "deletion_and_cancel_codes",
]
# Present in the repo .env files; blanked so nothing can reach a real mailbox or service.
BLANKED = (
    "ZOHO_SMTP_HOST", "ZOHO_SMTP_PORT", "ZOHO_SMTP_USERNAME", "ZOHO_SMTP_PASSWORD", "ZOHO_FROM_EMAIL",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CRON_SECRET",
    "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_SERVICE_ACCOUNT_FILE", "FIREBASE_SERVICE_ACCOUNT_JSON",
    "EMAIL_ALLOWLIST",
)


def _server_url(database: str) -> str:
    parts = urlsplit(PG_URL)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def _env(database: str) -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "PYTHONDONTWRITEBYTECODE": "1",
        "ENVIRONMENT": "development",
        "JWT_SECRET": "abuse-checks-jwt-secret-0123456789abcdef",
        "OTP_DEV_CODE": "246810",
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
    name = f"bseva_abuse_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(_server_url("postgres"), autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')
    try:
        done = subprocess.run(
            [sys.executable, "-m", "app.db_bootstrap"], cwd=BACKEND, env=_env(name),
            capture_output=True, text=True, timeout=300,
        )
        assert done.returncode == 0, done.stdout + done.stderr
        yield name
    finally:
        with psycopg.connect(_server_url("postgres"), autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


@pytest.mark.parametrize("check", CHECKS)
def test_abuse_protection(database, check):
    done = subprocess.run(
        [sys.executable, "tests/abuse_pg_checks.py", check], cwd=BACKEND, env=_env(database),
        capture_output=True, text=True, timeout=180,
    )
    assert done.returncode == 0 and f"PASS {check}" in done.stdout, done.stdout[-3000:] + done.stderr[-6000:]


def test_every_check_is_listed():
    text = (BACKEND / "tests" / "abuse_pg_checks.py").read_text()
    defined = {line.split("(")[0][len("def check_"):] for line in text.splitlines() if line.startswith("def check_")}
    assert defined == set(CHECKS)
