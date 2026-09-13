"""Smoke-test Google Meet creation (OAuth refresh token or service account).

1) One-time auth (browser):
     uvicorn app.main:app --reload --port 8000
     open http://localhost:8000/api/v1/auth/google
     Sign in as mybseva@gmail.com → Allow
2) Then:
     python3 -m scripts.test_google_meet
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        # Always reload from file so a newly saved refresh token is picked up
        if key:
            os.environ[key] = val


def main() -> int:
    _load_env_file(ROOT / ".env")
    _load_env_file(ROOT.parent / ".env")

    from app.meetings.google_meet import create_google_meet_event, google_meet_configured, oauth_refresh_token

    print("GOOGLE_MEET_ENABLED =", os.getenv("GOOGLE_MEET_ENABLED"))
    print("Has OAuth client =", bool(os.getenv("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")))
    print("Has refresh token =", bool(oauth_refresh_token()))
    print("Configured =", google_meet_configured())

    if not oauth_refresh_token():
        print("\nNo GOOGLE_REFRESH_TOKEN yet.")
        print("1) Start API:  cd backend && uvicorn app.main:app --reload --port 8000")
        print("2) Browser:    http://localhost:8000/api/v1/auth/google")
        print("3) Sign in as mybseva@gmail.com and Allow")
        print("4) Re-run this script")
        if not google_meet_configured():
            return 1

    if not google_meet_configured():
        print("\nFAIL: Google Meet is not configured.")
        return 1

    start = datetime.now() + timedelta(days=2)
    start = start.replace(hour=10, minute=0, second=0, microsecond=0)
    end = start + timedelta(minutes=90)

    print("\nCreating test Meet event…")
    try:
        result = create_google_meet_event(
            summary="BSeva Meet smoke test",
            description="Temporary test event — safe to delete from Google Calendar.",
            start=start,
            end=end,
            attendee_emails=[],
        )
    except Exception as e:
        print("FAIL:", e)
        return 2

    print("OK")
    print("meeting_url =", result.get("meeting_url"))
    print("event_id =", result.get("google_calendar_event_id"))
    print("html_link =", result.get("html_link"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
