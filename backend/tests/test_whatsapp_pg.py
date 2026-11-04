"""WhatsApp webhook and client against a real PostgreSQL database (migration 042 applied by the deploy step).

Each check in tests/whatsapp_pg_checks.py runs in its own subprocess with test-only WhatsApp settings. Meta is
never contacted. Set BSEVA_TEST_PG_URL to a loopback server, for example:

    BSEVA_TEST_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres python -m pytest tests/test_whatsapp_pg.py

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
    "send_then_delivery_statuses",
    "replayed_event_is_idempotent",
    "out_of_order_status_never_moves_backwards",
    "failed_status_recorded_safely",
    "unknown_message_status_creates_webhook_row",
    "inbound_message_content_never_stored_or_logged",
    "otp_never_stored_or_logged",
    "send_failure_recorded",
    "other_fields_deduplicated",
    "other_objects_acknowledged_and_ignored",
    "malformed_event_rolls_back_whole_delivery",
    "store_failure_returns_503_and_retry_succeeds",
    "bad_signature_changes_nothing",
    "worker_prunes_old_events",
]
# Present in the repo .env files; blanked so nothing can reach a real mailbox or service.
BLANKED = (
    "ZOHO_SMTP_HOST", "ZOHO_SMTP_PORT", "ZOHO_SMTP_USERNAME", "ZOHO_SMTP_PASSWORD", "ZOHO_FROM_EMAIL",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CRON_SECRET",
    "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_SERVICE_ACCOUNT_FILE", "FIREBASE_SERVICE_ACCOUNT_JSON",
    "EMAIL_ALLOWLIST",
)
WHATSAPP_TEST_ENV = {
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "pg-check-verify-token",
    "WHATSAPP_APP_SECRET": "pg-check-app-secret",
    "WHATSAPP_ACCESS_TOKEN": "pg-check-access-token",
    "WHATSAPP_PHONE_NUMBER_ID": "123456789012345",
    "WHATSAPP_SEND_ENABLED": "true",
    "WHATSAPP_RECIPIENT_ALLOWLIST": "919800000001",
}


def _server_url(database: str) -> str:
    parts = urlsplit(PG_URL)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def _env(database: str) -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "PYTHONDONTWRITEBYTECODE": "1",
        "ENVIRONMENT": "development",
        "JWT_SECRET": "whatsapp-checks-jwt-secret-0123456789",
        "DATABASE_URL": _server_url(database).replace("postgresql://", "postgresql+psycopg://", 1),
        **{key: "" for key in BLANKED},
        **WHATSAPP_TEST_ENV,
    }


@pytest.fixture(scope="module")
def database():
    if not PG_URL:
        if os.environ.get("REQUIRE_PG_TESTS") == "1":
            pytest.fail("REQUIRE_PG_TESTS=1 but BSEVA_TEST_PG_URL is not set")
        pytest.skip("BSEVA_TEST_PG_URL is not set")
    assert urlsplit(PG_URL).hostname in ("127.0.0.1", "localhost", "::1"), "refusing a non-loopback test server"
    psycopg = pytest.importorskip("psycopg")
    name = f"bseva_whatsapp_{uuid.uuid4().hex[:10]}"
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
def test_whatsapp(database, check):
    done = subprocess.run(
        [sys.executable, "tests/whatsapp_pg_checks.py", check], cwd=BACKEND, env=_env(database),
        capture_output=True, text=True, timeout=180,
    )
    assert done.returncode == 0 and f"PASS {check}" in done.stdout, done.stdout[-3000:] + done.stderr[-6000:]


def test_every_check_is_listed():
    text = (BACKEND / "tests" / "whatsapp_pg_checks.py").read_text()
    defined = {line.split("(")[0][len("def check_"):] for line in text.splitlines() if line.startswith("def check_")}
    assert defined == set(CHECKS)
