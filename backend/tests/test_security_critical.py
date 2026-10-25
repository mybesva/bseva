"""Security PR 1: wallet top-up authorization, private file access, Google OAuth setup endpoints,
and no credentials in source. Endpoint functions are called directly against a scripted fake DB."""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.config import settings
from app.rbac import require_super_admin
from app.routers import admin_pujari, pujari, wallet
from app.schemas import DocumentMetaIn, WalletAdminCreditIn, WalletLoadIn
from app.storage import clean_object_path

CUST = "00000000-0000-0000-0000-0000000000c1"
PUJ = "00000000-0000-0000-0000-0000000000a1"
OTHER = "00000000-0000-0000-0000-0000000000a2"
SUPER = "00000000-0000-0000-0000-0000000000f1"
DOC = "00000000-0000-0000-0000-0000000000d1"
REPO = Path(__file__).resolve().parents[2]


class _Result:
    def __init__(self, row=None):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row

    def all(self):
        return self._row or []

    def scalar(self):
        return None


class FakeDB:
    """Answers each SQL statement with the first matching (substring, row) rule; records writes."""

    def __init__(self, rules=()):
        self.rules, self.writes, self.committed = list(rules), [], False

    def execute(self, stmt, params=None):
        sql = str(stmt)
        if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            self.writes.append((sql, params))
        for needle, row in self.rules:
            if needle in sql:
                return _Result(row)
        return _Result()

    def commit(self):
        self.committed = True

    def rollback(self):
        pass


def _wallet_db(**extra_rules):
    return FakeDB([("FROM wallets WHERE user_id", {"id": "w1", "balance_paise": 1000, "status": "active"}), *extra_rules.items()])


def _user(uid, role):
    return {"id": uid, "role": role}


# ---------------------------------------------------------------- wallet top-up authorization


@pytest.mark.parametrize(
    "environment,mode,allowed",
    [
        ("production", "", False),
        ("production", "off", False),
        ("production", "unverified", True),
        ("development", "", True),
        ("qa", "", True),
        ("development", "off", False),
    ],
)
def test_wallet_self_topup_policy(monkeypatch, environment, mode, allowed):
    monkeypatch.setattr(settings, "environment", environment)
    monkeypatch.setattr(settings, "wallet_self_topup", mode)
    assert settings.wallet_self_topup_allowed is allowed


def test_production_refuses_unpaid_wallet_topup(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "wallet_self_topup", "")
    db = _wallet_db()
    with pytest.raises(HTTPException) as exc:
        wallet.load_wallet(WalletLoadIn(amount_paise=50_000_00), user=_user(CUST, "customer"), db=db)
    assert exc.value.status_code == 403
    assert db.writes == [] and not db.committed


def test_pujari_cannot_mint_wallet_money_in_production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "wallet_self_topup", "")
    with pytest.raises(HTTPException) as exc:
        wallet.load_wallet(WalletLoadIn(amount_paise=100), user=_user(PUJ, "pujari"), db=_wallet_db())
    assert exc.value.status_code == 403


def test_development_topup_still_credits_wallet(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "wallet_self_topup", "")
    db = _wallet_db()
    out = wallet.load_wallet(WalletLoadIn(amount_paise=500), user=_user(CUST, "customer"), db=db)
    assert out == {"ok": True, "balance_paise": 1500}
    assert db.committed and any("INSERT INTO wallet_transactions" in sql for sql, _ in db.writes)


def test_wallet_response_tells_clients_whether_topup_is_available(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "wallet_self_topup", "")
    db = FakeDB([("SELECT * FROM wallets", {"id": "w1", "balance_paise": 0}), ("wallet_transactions", [])])
    assert wallet.get_wallet(user=_user(CUST, "customer"), db=db)["self_topup_enabled"] is False


def test_admin_credit_requires_payment_reference():
    with pytest.raises(ValueError):
        WalletAdminCreditIn(amount_paise=100, reference="")


def test_super_admin_can_credit_offline_payment_once():
    db = _wallet_db(**{"FROM users WHERE id": {"id": CUST, "role": "customer"}})
    body = WalletAdminCreditIn(amount_paise=2_000_00, reference="UPI-778812", note="Paid via UPI")
    out = wallet.admin_credit_wallet(CUST, body, admin=_user(SUPER, "super_admin"), db=db)
    assert out == {"ok": True, "balance_paise": 1000 + 2_000_00}
    tx = next(p for sql, p in db.writes if "INSERT INTO wallet_transactions" in sql)
    assert tx["ref"] == "UPI-778812" and tx["descr"].startswith(wallet.ADMIN_CREDIT_PREFIX)
    assert any("INSERT INTO audit_logs" in sql for sql, _ in db.writes)


def test_same_payment_reference_cannot_be_credited_twice():
    db = _wallet_db(**{"FROM users WHERE id": {"id": CUST, "role": "customer"}, "t.reference = :ref": {"id": "t1"}})
    body = WalletAdminCreditIn(amount_paise=100, reference="UPI-778812")
    with pytest.raises(HTTPException) as exc:
        wallet.admin_credit_wallet(CUST, body, admin=_user(SUPER, "super_admin"), db=db)
    assert exc.value.status_code == 409
    assert not any("wallet_transactions" in sql for sql, _ in db.writes)


@pytest.mark.parametrize("role", ["customer", "pujari", "head_pujari", "admin"])
def test_only_super_admin_reaches_wallet_credit(role):
    with pytest.raises(HTTPException) as exc:
        require_super_admin(user=_user(SUPER, role))
    assert exc.value.status_code == 403


def test_super_admin_passes_wallet_credit_guard():
    assert require_super_admin(user=_user(SUPER, "super_admin"))["role"] == "super_admin"


# ---------------------------------------------------------------- private file access (KYC)


@pytest.mark.parametrize(
    "path",
    [
        f"{OTHER}/signature.png",  # another pujari's object
        f"{OTHER}/profile.jpg",
        f"{CUST}/customer_photo.jpg",
        f"{PUJ}/../{OTHER}/signature.png",  # traversal out of own folder
        f"/{PUJ}/doc.pdf",
        f"{PUJ}//doc.pdf",
        f"{PUJ}\\doc.pdf",
        f"{PUJ}/doc.exe",
        "services/x/cover.jpg",
        "",
    ],
)
def test_pujari_cannot_register_foreign_or_unsafe_document_path(path):
    db = FakeDB()
    with pytest.raises(HTTPException) as exc:
        pujari.register_document(
            DocumentMetaIn(document_type="identity", storage_path=path), user=_user(PUJ, "pujari"), db=db
        )
    assert exc.value.status_code == 400
    assert db.writes == []


def test_pujari_can_register_document_in_own_folder():
    db = FakeDB()
    out = pujari.register_document(
        DocumentMetaIn(document_type="identity", storage_path=f"{PUJ}/abc_aadhaar.pdf"),
        user=_user(PUJ, "pujari"),
        db=db,
    )
    assert out == {"ok": True}
    assert db.writes[0][1]["path"] == f"{PUJ}/abc_aadhaar.pdf"


def _served(monkeypatch, module):
    served = []
    monkeypatch.setattr(module, "file_response", lambda path, filename=None: served.append(path) or "file")
    return served


def test_legacy_row_pointing_at_another_users_file_is_not_served(monkeypatch):
    served = _served(monkeypatch, pujari)
    db = FakeDB([("FROM pujari_documents", {"id": DOC, "pujari_id": PUJ, "storage_path": f"{OTHER}/signature.png"})])
    with pytest.raises(HTTPException) as exc:
        pujari.download_document(DOC, user=_user(PUJ, "pujari"), db=db)
    assert exc.value.status_code == 404
    assert served == []


def test_pujari_cannot_download_another_pujaris_document(monkeypatch):
    served = _served(monkeypatch, pujari)
    db = FakeDB([("FROM pujari_documents", {"id": DOC, "pujari_id": OTHER, "storage_path": f"{OTHER}/id.pdf"})])
    with pytest.raises(HTTPException) as exc:
        pujari.download_document(DOC, user=_user(PUJ, "pujari"), db=db)
    assert exc.value.status_code == 403
    assert served == []


def test_pujari_downloads_own_document(monkeypatch):
    served = _served(monkeypatch, pujari)
    db = FakeDB([("FROM pujari_documents", {"id": DOC, "pujari_id": PUJ, "storage_path": f"{PUJ}/x_id.pdf"})])
    assert pujari.download_document(DOC, user=_user(PUJ, "pujari"), db=db) == "file"
    assert served == [f"{PUJ}/x_id.pdf"]


def test_admin_document_view_ignores_rows_pointing_outside_the_pujari_folder(monkeypatch):
    served = _served(monkeypatch, admin_pujari)
    db = FakeDB([("FROM pujari_documents", {"id": DOC, "pujari_id": PUJ, "storage_path": f"{CUST}/customer_photo.jpg"})])
    with pytest.raises(HTTPException) as exc:
        admin_pujari.admin_document_file(PUJ, DOC, user=_user(SUPER, "super_admin"), db=db)
    assert exc.value.status_code == 404
    assert served == []


def test_admin_views_pujari_document(monkeypatch):
    served = _served(monkeypatch, admin_pujari)
    db = FakeDB([("FROM pujari_documents", {"id": DOC, "pujari_id": PUJ, "storage_path": f"{PUJ}/x_id.pdf"})])
    assert admin_pujari.admin_document_file(PUJ, DOC, user=_user(SUPER, "super_admin"), db=db) == "file"


@pytest.mark.parametrize(
    "key",
    ["services/../a1/signature.png", "a/./b.png", "a//b.png", "a\\b.png", "a/%2e%2e/b.png", "a%2Fb.png", "a/b.png?x=1", "a/b#c", ""],
)
def test_storage_rejects_traversal_keys(key):
    with pytest.raises(HTTPException) as exc:
        clean_object_path(key)
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "key",
    [f"{PUJ}/0f3a_aadhaar.pdf", f"{PUJ}/profile.jpg", "services/abc/cover.webp", "promos/9a.png", "seva-events/e1/proof.jpg"],
)
def test_storage_accepts_generated_keys(key):
    assert clean_object_path(f"/{key}") == key


# ---------------------------------------------------------------- Google OAuth setup endpoints


def test_public_google_oauth_routes_are_removed():
    from app.main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/v1/auth/google" not in paths
    assert "/api/v1/auth/google/callback" not in paths


def test_app_does_not_enable_insecure_oauth_transport():
    import app.main  # noqa: F401

    assert os.environ.get("OAUTHLIB_INSECURE_TRANSPORT") != "1"
    assert not (REPO / "backend/app/routers/google_oauth.py").exists()


def test_oauth_setup_script_never_prints_the_token():
    src = (REPO / "backend/scripts/google_oauth_setup.py").read_text(encoding="utf-8")
    assert "print(creds.refresh_token" not in src and "print(f\"{creds.refresh_token" not in src
    assert "0o600" in src and 'host="127.0.0.1"' in src


# ---------------------------------------------------------------- no credentials in source

_CREDENTIAL_URL = re.compile(r"postgres(?:ql)?://[^\s:@/'\"]+:[^\s@'\"$<{]{6,}@[A-Za-z0-9.-]+")


def _tracked_files() -> list[Path]:
    try:
        out = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("git not available")
    return [REPO / f for f in out.splitlines() if f.endswith((".py", ".ts", ".tsx", ".js", ".json", ".toml", ".yml", ".yaml"))]


def test_no_database_credentials_in_tracked_source():
    offenders = []
    for path in _tracked_files():
        try:
            joined = path.read_text(encoding="utf-8", errors="ignore").replace('"\n    "', "")
        except OSError:
            continue
        for m in _CREDENTIAL_URL.finditer(joined):
            if not re.search(r"(USER|username|user|postgres):(PASSWORD|password|pass|postgres|probe)@", m.group(0)):
                offenders.append(str(path.relative_to(REPO)))
    assert offenders == []


def test_db_migration_script_reads_source_url_from_environment(monkeypatch):
    import importlib.util

    spec = importlib.util.spec_from_file_location("migrate_db", REPO / "backend/scripts/migrate_supabase_db.py")
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except ModuleNotFoundError:
        pytest.skip("psycopg not installed")
    monkeypatch.delenv("OLD_DATABASE_URL", raising=False)
    with pytest.raises(SystemExit):
        mod.load_old_database_url()
    monkeypatch.setenv("OLD_DATABASE_URL", "postgresql://u:p@h/db")
    assert mod.load_old_database_url() == "postgresql://u:p@h/db"
