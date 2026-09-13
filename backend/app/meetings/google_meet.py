"""Google Calendar → Meet via OAuth refresh token (preferred) or service account."""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

from app import env_loader  # noqa: F401

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CALENDAR_API = "https://www.googleapis.com/calendar/v3"


def _env(*names: str, default: str = "") -> str:
    for name in names:
        v = (os.getenv(name) or "").strip()
        if v:
            return v
    return default


def oauth_client_id() -> str:
    return _env("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID")


def oauth_client_secret() -> str:
    return _env("GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET")


def oauth_redirect_uri() -> str:
    """Callback URL registered in Google Cloud OAuth client.

    Local:  http://localhost:8000/api/v1/auth/google/callback
    Vercel: https://bseva.vercel.app/api/v1/auth/google/callback
    """
    explicit = _env("GOOGLE_OAUTH_REDIRECT_URI", "GOOGLE_REDIRECT_URI")
    if explicit:
        return explicit
    public = _env("PUBLIC_APP_URL", "VERCEL_URL").rstrip("/")
    if public:
        if public.startswith("http"):
            return f"{public}/api/v1/auth/google/callback"
        return f"https://{public}/api/v1/auth/google/callback"
    return "http://localhost:8000/api/v1/auth/google/callback"



def oauth_refresh_token() -> str:
    return _env("GOOGLE_REFRESH_TOKEN")


def _oauth_ready() -> bool:
    return bool(oauth_client_id() and oauth_client_secret() and oauth_refresh_token())


def _service_account_ready() -> bool:
    if _env("GOOGLE_SERVICE_ACCOUNT_JSON"):
        return True
    path = _env("GOOGLE_SERVICE_ACCOUNT_FILE")
    return bool(path and Path(path).is_file())


def google_meet_configured() -> bool:
    if _env("GOOGLE_MEET_ENABLED", default="0").lower() not in ("1", "true", "yes", "on"):
        return False
    # OAuth client present → require refresh token (don't silently use broken SA path)
    if oauth_client_id() and oauth_client_secret():
        return _oauth_ready()
    return _service_account_ready()


def _load_service_account_info() -> dict[str, Any]:
    raw = _env("GOOGLE_SERVICE_ACCOUNT_JSON")
    if raw:
        return json.loads(raw)
    path = _env("GOOGLE_SERVICE_ACCOUNT_FILE")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _access_token() -> str:
    """Return a bearer token — OAuth refresh token first, else service account."""
    if _oauth_ready():
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
        except ImportError as e:
            raise RuntimeError("pip install google-auth") from e
        creds = Credentials(
            token=None,
            refresh_token=oauth_refresh_token(),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=oauth_client_id(),
            client_secret=oauth_client_secret(),
            scopes=SCOPES,
        )
        creds.refresh(Request())
        if not creds.token:
            raise RuntimeError("Failed to refresh Google OAuth access token")
        return str(creds.token)

    if not _service_account_ready():
        raise RuntimeError("No Google OAuth refresh token or service account configured")

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError as e:
        raise RuntimeError("pip install google-auth") from e

    info = _load_service_account_info()
    subject = _env("GOOGLE_MEET_IMPERSONATE") or None
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    if subject:
        creds = creds.with_subject(subject)
    creds.refresh(Request())
    if not creds.token:
        raise RuntimeError("Failed to obtain Google access token")
    return str(creds.token)


def create_google_meet_event(
    *,
    summary: str,
    description: str,
    start: datetime,
    end: datetime,
    attendee_emails: list[str],
    request_id: str | None = None,
) -> dict[str, Any]:
    """Create a Calendar event with a Meet conference. Returns hangoutLink + event id."""
    if not google_meet_configured():
        raise RuntimeError(
            "Google Meet is not configured. Set GOOGLE_REFRESH_TOKEN (via /api/v1/auth/google) "
            "or a Workspace service account."
        )

    timezone = _env("GOOGLE_MEET_TIMEZONE", default="Asia/Kolkata") or "Asia/Kolkata"
    calendar_id = _env("GOOGLE_CALENDAR_ID", default="primary") or "primary"
    token = _access_token()
    attendees = [{"email": e} for e in sorted({e.strip().lower() for e in attendee_emails if e and "@" in e})]
    body: dict[str, Any] = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start.isoformat(timespec="seconds"), "timeZone": timezone},
        "end": {"dateTime": end.isoformat(timespec="seconds"), "timeZone": timezone},
        "attendees": attendees,
        "conferenceData": {
            "createRequest": {
                "requestId": request_id or str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "guestsCanModify": False,
        "guestsCanInviteOthers": True,
        "guestsCanSeeOtherGuests": True,
    }
    params = {"conferenceDataVersion": "1", "sendUpdates": "all"}
    url = f"{CALENDAR_API}/calendars/{calendar_id}/events"
    with httpx.Client(timeout=30.0) as client:
        res = client.post(url, params=params, headers={"Authorization": f"Bearer {token}"}, json=body)
        if res.status_code >= 400:
            logger.error("Google Calendar create failed: %s %s", res.status_code, res.text[:500])
            raise RuntimeError(f"Google Calendar error ({res.status_code}): {res.text[:240]}")
        data = res.json()

    meet_url = data.get("hangoutLink") or ""
    if not meet_url:
        entry = (data.get("conferenceData") or {}).get("entryPoints") or []
        for ep in entry:
            if ep.get("entryPointType") == "video" and ep.get("uri"):
                meet_url = ep["uri"]
                break
    if not meet_url:
        raise RuntimeError("Google Calendar event created but no Meet link was returned")

    return {
        "meeting_url": meet_url,
        "google_calendar_event_id": data.get("id"),
        "html_link": data.get("htmlLink"),
        "raw": data,
    }


def patch_google_meet_attendees(*, event_id: str, attendee_emails: list[str]) -> None:
    """Add attendees to an existing event and resend invites."""
    if not google_meet_configured() or not event_id:
        return
    calendar_id = _env("GOOGLE_CALENDAR_ID", default="primary") or "primary"
    token = _access_token()
    attendees = [{"email": e} for e in sorted({e.strip().lower() for e in attendee_emails if e and "@" in e})]
    url = f"{CALENDAR_API}/calendars/{calendar_id}/events/{event_id}"
    with httpx.Client(timeout=30.0) as client:
        res = client.patch(
            url,
            params={"sendUpdates": "all"},
            headers={"Authorization": f"Bearer {token}"},
            json={"attendees": attendees},
        )
        if res.status_code >= 400:
            logger.warning("Google Calendar patch attendees failed: %s %s", res.status_code, res.text[:300])
