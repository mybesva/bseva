"""One-time Google OAuth for Calendar / Meet (refresh token)."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.meetings.google_meet import (
    SCOPES,
    oauth_client_id,
    oauth_client_secret,
    oauth_redirect_uri,
)
from app import env_loader  # noqa: F401

logger = logging.getLogger(__name__)

router = APIRouter(tags=["google-oauth"])


def _get_flow():
    try:
        from google_auth_oauthlib.flow import Flow
    except ImportError as e:
        raise HTTPException(
            500,
            "Missing google-auth-oauthlib. Run: pip install google-auth-oauthlib google-api-python-client",
        ) from e

    client_id = oauth_client_id()
    client_secret = oauth_client_secret()
    if not client_id or not client_secret:
        raise HTTPException(500, "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set")

    # Allow http://localhost for local OAuth
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=oauth_redirect_uri(),
    )


def _append_refresh_token_to_env(token: str) -> Path | None:
    """Persist refresh token into repo-root .env if present."""
    candidates = [
        Path(__file__).resolve().parents[3] / ".env",  # repo root
        Path(__file__).resolve().parents[2].parent / ".env",
        Path.cwd().parent / ".env",
        Path.cwd() / ".env",
    ]
    env_path = next((p for p in candidates if p.is_file()), None)
    if not env_path:
        return None
    text = env_path.read_text(encoding="utf-8")
    line = f"GOOGLE_REFRESH_TOKEN={token}"
    lines: list[str] = []
    replaced = False
    for raw in text.splitlines():
        stripped = raw.strip()
        # Replace active or commented GOOGLE_REFRESH_TOKEN lines
        if stripped.startswith("GOOGLE_REFRESH_TOKEN=") or stripped.startswith("# GOOGLE_REFRESH_TOKEN="):
            if not replaced:
                lines.append(line)
                replaced = True
            # drop duplicate commented/active lines
            continue
        lines.append(raw)
    if not replaced:
        lines.append(line)
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["GOOGLE_REFRESH_TOKEN"] = token
    return env_path


@router.get("/auth/google")
def login_google():
    """Visit in browser once to authorize mybseva@gmail.com (or your Google account)."""
    flow = _get_flow()
    auth_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@router.get("/auth/google/callback")
def google_callback(request: Request):
    flow = _get_flow()
    try:
        # Use the full URL Google redirected to
        flow.fetch_token(authorization_response=str(request.url))
    except Exception as e:
        logger.exception("Google OAuth token exchange failed")
        raise HTTPException(400, f"Google OAuth failed: {e}") from e

    credentials = flow.credentials
    refresh = credentials.refresh_token
    if not refresh:
        raise HTTPException(
            400,
            "No refresh_token returned. Revoke app access at "
            "https://myaccount.google.com/permissions and try again with prompt=consent.",
        )

    print(f"YOUR REFRESH TOKEN: {refresh}", flush=True)
    logger.info("Google OAuth refresh_token received (length=%s)", len(refresh))
    saved = _append_refresh_token_to_env(refresh)

    html = f"""
    <html><body style="font-family: system-ui; max-width: 40rem; margin: 2rem auto;">
      <h1>Google Calendar connected</h1>
      <p>Refresh token saved{(' to <code>' + str(saved) + '</code>') if saved else ' (printed in server logs only)'}.</p>
      <p>You can close this tab and run:</p>
      <pre>cd backend && python3 -m scripts.test_google_meet</pre>
    </body></html>
    """
    return HTMLResponse(html)
