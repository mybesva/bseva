"""One-time Google Calendar/Meet authorisation — run on an operator's own machine, never on a server.

Replaces the former public /api/v1/auth/google endpoints. It opens a browser for consent on a
loopback port, then writes the refresh token to a file readable only by you. The token is never
printed. Store it as GOOGLE_REFRESH_TOKEN in the environment's secret store, then delete the file.

Prerequisite: in Google Cloud Console → Credentials, use a "Desktop app" OAuth client, or add
http://localhost:8765/ as an authorised redirect URI on the existing client.

Usage:
    cd backend
    GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
      python3 scripts/google_oauth_setup.py [--out ./google_refresh_token.txt] [--port 8765]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="google_refresh_token.txt", help="file to write the refresh token to")
    parser.add_argument("--port", type=int, default=8765, help="loopback port for the consent redirect")
    args = parser.parse_args()

    from app.meetings.google_meet import SCOPES, oauth_client_id, oauth_client_secret

    client_id, client_secret = oauth_client_id(), oauth_client_secret()
    if not client_id or not client_secret:
        print("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.", file=sys.stderr)
        return 1
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
        return 1

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
    # Loopback redirect on 127.0.0.1 only; google-auth-oauthlib validates the OAuth state value.
    creds = flow.run_local_server(
        host="127.0.0.1",
        port=args.port,
        access_type="offline",
        prompt="consent",
        open_browser=True,
    )
    if not creds.refresh_token:
        print("Google did not return a refresh token. Revoke the app's access and try again.", file=sys.stderr)
        return 2

    out = Path(args.out).expanduser().resolve()
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(creds.refresh_token + "\n")
    os.chmod(out, 0o600)
    print(f"Refresh token saved to {out} (mode 600).")
    print("Next: store it as GOOGLE_REFRESH_TOKEN in the target environment's secret store, then delete the file.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
