#!/usr/bin/env python3
"""Send all BSeva TEST email templates via Zoho SMTP.

Usage (from repo root or backend/):
  cd backend && python -m scripts.send_test_emails

Requires ZOHO_SMTP_* (or SMTP_*) in environment / .env.
Does not use production booking/payment data.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure backend package root is on path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load .env from backend/ and repo root
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env")
except ImportError:
    pass


def main() -> int:
    to = (os.getenv("EMAIL_TEST_TO") or "mybseva@gmail.com").strip()
    from app.mail.smtp_client import smtp_status
    from app.mail.test_send import send_all_test_templates

    status = smtp_status()
    print("SMTP status:", json.dumps({k: v for k, v in status.items() if k != "missing"}, indent=2))
    if not status.get("configured"):
        print("ERROR: SMTP not configured. Missing:", status.get("missing"))
        print("Set ZOHO_SMTP_HOST/PORT/USERNAME/PASSWORD and ZOHO_FROM_EMAIL in .env")
        return 1

    print(f"Sending TEST templates to {to} ...")
    report = send_all_test_templates(to=to)
    print(json.dumps(report, indent=2, default=str))
    failed = [r for r in report["results"] if not r.get("ok")]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
