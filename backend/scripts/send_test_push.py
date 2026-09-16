"""Send a test FCM push to the signed-in user's registered devices.

Usage (from backend/, with API running):

  export BSEVA_API_URL=http://localhost:8000
  export BSEVA_EMAIL=you@example.com
  export BSEVA_PASSWORD='your-password'
  python3 -m scripts.send_test_push

Or pass a JWT:

  export BSEVA_JWT='eyJ...'
  python3 -m scripts.send_test_push
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def _env(*keys: str, default: str = "") -> str:
    for key in keys:
        val = os.getenv(key, "").strip()
        if val:
            return val
    return default


def _post(url: str, payload: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = json.loads(res.read().decode("utf-8") or "{}")
            return res.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"detail": raw}
        return exc.code, body


def main() -> int:
    base = _env("BSEVA_API_URL", "API_URL", default="http://localhost:8000").rstrip("/")
    jwt = _env("BSEVA_JWT")
    if not jwt:
        email = _env("BSEVA_EMAIL")
        password = _env("BSEVA_PASSWORD")
        if not email or not password:
            print("Set BSEVA_JWT or BSEVA_EMAIL + BSEVA_PASSWORD", file=sys.stderr)
            return 2
        code, body = _post(
            f"{base}/api/v1/auth/login",
            {"identifier": email, "password": password},
        )
        if code >= 400:
            print(f"login failed ({code}): {body}", file=sys.stderr)
            return 1
        jwt = str(body.get("access_token") or "")
        if not jwt:
            print("login succeeded but no access_token", file=sys.stderr)
            return 1
    code, body = _post(f"{base}/api/v1/notifications/fcm/test", {}, jwt)
    print(json.dumps({"status": code, **body}, indent=2, default=str))
    return 0 if 200 <= code < 300 else 1


if __name__ == "__main__":
    raise SystemExit(main())
