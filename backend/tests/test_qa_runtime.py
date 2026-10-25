"""AWS runtime support: S3 storage adapter, QA email allowlist, job dedupe fallback, DB pool options,
reminder SQL time zone, and demo-seed refusal in production."""
from __future__ import annotations

import inspect
from contextlib import contextmanager

import pytest
from fastapi import HTTPException

from app import db as app_db
from app import storage
from app.jobs import booking_reminders, dedupe
from app.mail import smtp_client


class FakeS3:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[Key] = (Body, ContentType)

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            err = Exception("missing")
            err.response = {"Error": {"Code": "NoSuchKey"}}
            raise err
        body, ct = self.objects[Key]
        return {"Body": type("B", (), {"read": lambda self: body})(), "ContentType": ct}

    def delete_object(self, Bucket, Key):
        self.objects.pop(Key, None)


@pytest.fixture
def s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setenv("S3_BUCKET", "bseva-qa-files-test")
    monkeypatch.setattr(storage, "_s3_client", lambda: fake)
    return fake


def test_s3_upload_download_delete_roundtrip(s3):
    key = storage.upload_bytes("00000000-0000-0000-0000-0000000000a1/profile.jpg", b"jpeg-bytes", "image/jpeg")
    assert key in s3.objects
    data, ct = storage.fetch_bytes(key)
    assert data == b"jpeg-bytes" and ct == "image/jpeg"
    storage.delete_object(key)
    with pytest.raises(HTTPException) as exc:
        storage.fetch_bytes(key)
    assert exc.value.status_code == 404


def test_s3_is_preferred_over_supabase_and_counts_as_configured(s3, monkeypatch):
    monkeypatch.setattr(storage, "_supabase_configured", lambda: True)
    assert storage.storage_configured() is True
    storage.upload_bytes("services/x/cover.webp", b"x")
    assert "services/x/cover.webp" in s3.objects


def test_s3_still_rejects_traversal_keys(s3):
    with pytest.raises(HTTPException):
        storage.upload_bytes("a1/../a2/signature.png", b"x")
    assert s3.objects == {}


def test_file_response_from_s3_is_not_cached(s3):
    storage.upload_bytes("promos/1.png", b"png", "image/png")
    resp = storage.file_response("promos/1.png", filename="1.png")
    assert resp.headers["cache-control"].startswith("no-store")


@pytest.mark.parametrize(
    "allowlist,to,allowed",
    [
        ("", "anyone@example.com", True),
        ("@b-seva.com,qa.tester@gmail.com", "ops@b-seva.com", True),
        ("@b-seva.com,qa.tester@gmail.com", "QA.Tester@gmail.com", True),
        ("@b-seva.com,qa.tester@gmail.com", "real.customer@gmail.com", False),
    ],
)
def test_email_allowlist(monkeypatch, allowlist, to, allowed):
    monkeypatch.setenv("EMAIL_ALLOWLIST", allowlist)
    assert smtp_client.recipient_allowed(to) is allowed


def test_email_outside_allowlist_is_suppressed_before_smtp(monkeypatch):
    monkeypatch.setenv("EMAIL_ALLOWLIST", "@b-seva.com")
    monkeypatch.setattr(smtp_client, "load_smtp_config", lambda: (_ for _ in ()).throw(AssertionError("SMTP touched")))
    out = smtp_client.send_email(to="customer@gmail.com", subject="Reminder", text_body="x")
    assert out["status"] == "suppressed"


def test_dedupe_falls_back_to_sending_when_table_missing():
    from sqlalchemy.exc import ProgrammingError

    class Broken:
        @contextmanager
        def begin_nested(self):
            yield

        def execute(self, *a, **k):
            raise ProgrammingError("INSERT", {}, Exception("relation job_dedupe does not exist"))

    assert dedupe.claim_once(Broken(), "reminder_email:24h:x") is True


def test_dedupe_second_claim_is_refused():
    claimed = set()

    class Fake:
        @contextmanager
        def begin_nested(self):
            yield

        def execute(self, stmt, params):
            k = params["k"]
            fresh = k not in claimed
            claimed.add(k)
            return type("R", (), {"first": lambda self: (k,) if fresh else None})()

    db = Fake()
    assert dedupe.claim_once(db, "reminder_email:24h:b1") is True
    assert dedupe.claim_once(db, "reminder_email:24h:b1") is False


def test_reminder_windows_are_evaluated_in_ist():
    src = inspect.getsource(booking_reminders)
    assert src.count("AT TIME ZONE 'Asia/Kolkata'") >= 2
    assert "claim_once(session, f\"reminder_email:" in src


def test_engine_pool_defaults_to_nullpool_and_queue_is_opt_in(monkeypatch):
    from sqlalchemy.pool import NullPool

    monkeypatch.delenv("DB_POOL", raising=False)
    assert app_db._engine_kwargs() == {"poolclass": NullPool}
    monkeypatch.setenv("DB_POOL", "queue")
    monkeypatch.setenv("DB_POOL_SIZE", "4")
    kwargs = app_db._engine_kwargs()
    assert kwargs["pool_size"] == 4 and "poolclass" not in kwargs


def test_rds_ssl_settings_come_from_environment(monkeypatch):
    monkeypatch.setenv("DB_SSLMODE", "verify-full")
    monkeypatch.setenv("DB_SSLROOTCERT", "/etc/ssl/rds/global-bundle.pem")
    args = app_db._connect_args("postgresql://u@bseva-qa.abc.ap-south-1.rds.amazonaws.com/bseva")
    assert args["sslmode"] == "verify-full" and args["sslrootcert"].endswith("global-bundle.pem")


def test_demo_seed_refused_in_production(monkeypatch):
    from app import db_bootstrap
    from app.config import settings

    monkeypatch.setattr(settings, "environment", "production")
    assert db_bootstrap.seed_demo() == 2


def test_migration_order_runs_foundation_files_first():
    from app import db_bootstrap

    files = [p.name for p in db_bootstrap._files()]
    assert files[0].startswith("001_") and "025_job_dedupe.sql" in files
    assert all(db_bootstrap._number(db_bootstrap.MIGRATIONS_DIR / f) <= 12 for f in files[: files.index("013_i18n_six_languages.sql")])
