#!/usr/bin/env python3
"""One-time creation of the first Super Admin on a fresh environment.

  BOOTSTRAP_PASSWORD=<from the secret store> python scripts/bootstrap_admin.py --email owner@example.com --name "Owner Name" [--phone 9XXXXXXXXX]

Refuses when any super_admin already exists, for synthetic QA domains, and for weak passwords. The password is
taken from the environment (never an argument, never printed); change it after the first sign-in.
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

QA_DOMAINS = ("@bseva.test", "@qa.b-seva.com")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--phone", default=None)
    a = ap.parse_args()
    email = a.email.strip().lower()
    password = os.environ.get("BOOTSTRAP_PASSWORD", "")
    if email.endswith(QA_DOMAINS):
        raise SystemExit("Refusing: synthetic QA addresses cannot be administrators here")
    if len(password) < 16:
        raise SystemExit("Refusing: BOOTSTRAP_PASSWORD must be at least 16 characters")

    from sqlalchemy import text

    from app.db import engine
    from app.security import hash_password

    with engine.begin() as c:
        c.execute(text("SELECT pg_advisory_xact_lock(hashtext('bseva-bootstrap-admin'))"))
        if c.execute(text("SELECT 1 FROM users WHERE role = 'super_admin' LIMIT 1")).first():
            raise SystemExit("Refusing: a super admin already exists; manage administrators in the admin console")
        if c.execute(text("SELECT 1 FROM users WHERE email = :e OR (CAST(:p AS text) IS NOT NULL AND phone = :p)"), {"e": email, "p": a.phone}).first():
            raise SystemExit("Refusing: that email or phone already belongs to an account")
        uid = c.execute(
            text(
                """
                INSERT INTO users (name, email, phone, password_hash, role, preferred_language, calendar_preference,
                                   email_verified, phone_verified)
                VALUES (:n, :e, :p, :h, 'super_admin', 'en', 'solar', TRUE, FALSE)
                RETURNING id
                """
            ),
            {"n": a.name.strip(), "e": email, "p": (a.phone or "").strip() or None, "h": hash_password(password)},
        ).scalar_one()
        c.execute(text("INSERT INTO wallets (user_id) VALUES (:u) ON CONFLICT (user_id) DO NOTHING"), {"u": uid})
    print(f"super admin created: {email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
