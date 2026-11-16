"""Send push notifications straight to Apple (APNs) for iPhone device tokens.

The iOS apps register the raw APNs device token (expo-notifications getDevicePushTokenAsync), which Firebase
cannot deliver to. Those tokens (hex strings) are sent here instead, signed with the team's APNs auth key (.p8).

Configuration (backend only):
  APNS_KEY_ID          10-character key ID from Apple Developer -> Keys
  APNS_TEAM_ID         Apple team ID
  APNS_AUTH_KEY_FILE   path to the AuthKey_<id>.p8 file (servers: /run/bseva-secrets/apns_auth_key.p8)
  APNS_AUTH_KEY        alternatively the .p8 contents (literal "\\n" sequences are accepted)
  APNS_TOPICS          optional comma list of bundle IDs to try (default: the three B-Seva apps)
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Mapping

logger = logging.getLogger(__name__)

PRODUCTION_HOST = "https://api.push.apple.com"
SANDBOX_HOST = "https://api.sandbox.push.apple.com"
DEFAULT_TOPICS = ("com.bseva.app", "com.bseva.pujari", "com.bseva.admin")
# APNs device tokens are hex (32 bytes today). FCM registration tokens always contain ":" or "-"/"_".
_APNS_TOKEN_RE = re.compile(r"[0-9a-fA-F]{64,200}")
# Reasons meaning "this token is dead": deactivate it.
GONE_REASONS = {"Unregistered", "ExpiredToken"}

_lock = threading.Lock()
_jwt_cache: tuple[str, float] | None = None
# token -> (host, topic) that worked, so later sends skip the probing.
_route_cache: dict[str, tuple[str, str]] = {}


def is_apns_token(token: str) -> bool:
    return bool(_APNS_TOKEN_RE.fullmatch((token or "").strip()))


def _setting(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        try:
            from app.config import settings

            value = getattr(settings, name.lower(), "") or ""
        except Exception:
            value = ""
    return str(value).strip()


def _auth_key() -> str:
    inline = _setting("APNS_AUTH_KEY")
    if inline:
        return inline.replace("\\n", "\n")
    path = _setting("APNS_AUTH_KEY_FILE")
    if path:
        p = Path(path).expanduser()
        if p.is_file():
            return p.read_text().strip()
        logger.warning("APNs auth key file not found: %s", path)
    return ""


def apns_configured() -> bool:
    return bool(_setting("APNS_KEY_ID") and _setting("APNS_TEAM_ID") and _auth_key())


def topics() -> list[str]:
    raw = _setting("APNS_TOPICS")
    items = [t.strip() for t in raw.split(",") if t.strip()] if raw else list(DEFAULT_TOPICS)
    return items or list(DEFAULT_TOPICS)


def _provider_token() -> str:
    """ES256 provider JWT; Apple accepts one for up to 60 minutes, refresh every 50."""
    global _jwt_cache
    import jwt

    with _lock:
        now = time.time()
        if _jwt_cache and now - _jwt_cache[1] < 50 * 60:
            return _jwt_cache[0]
        token = jwt.encode(
            {"iss": _setting("APNS_TEAM_ID"), "iat": int(now)},
            _auth_key(),
            algorithm="ES256",
            headers={"kid": _setting("APNS_KEY_ID")},
        )
        _jwt_cache = (token, now)
        return token


def build_payload(title: str, body: str, data: Mapping[str, str]) -> dict[str, Any]:
    # expo-notifications reads remote-notification data from the "body" key on iOS.
    return {
        "aps": {"alert": {"title": title, "body": body}, "sound": "default", "badge": 1},
        "body": dict(data),
    }


def _reason(resp: Any) -> str:
    try:
        return str(resp.json().get("reason") or "")
    except Exception:
        return ""


def _routes(token: str) -> list[tuple[str, str]]:
    cached = _route_cache.get(token)
    order = [(h, t) for h in (PRODUCTION_HOST, SANDBOX_HOST) for t in topics()]
    if cached in order:
        order.remove(cached)
        order.insert(0, cached)
    return order


def send_apns(
    client: Any,
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: Mapping[str, str],
) -> tuple[int, int, list[str]]:
    """Deliver to each APNs token. Returns (success, failure, dead_tokens).

    One device token belongs to one app (topic) and one environment: TestFlight / App Store builds use
    production, Xcode debug builds use sandbox. Wrong topic -> DeviceTokenNotForTopic, wrong environment ->
    BadDeviceToken, so try each route until one is accepted and remember it.
    """
    payload = json.dumps(build_payload(title, body, data)).encode()
    success = failure = 0
    dead: list[str] = []
    for token in tokens:
        delivered = gone = False
        last = ""
        for host, topic in _routes(token):
            headers = {
                "authorization": f"bearer {_provider_token()}",
                "apns-topic": topic,
                "apns-push-type": "alert",
                "apns-priority": "10",
            }
            try:
                resp = client.post(f"{host}/3/device/{token}", content=payload, headers=headers)
            except Exception as exc:
                last = f"{type(exc).__name__}: {exc}"
                break
            if resp.status_code == 200:
                _route_cache[token] = (host, topic)
                delivered = True
                break
            last = _reason(resp) or str(resp.status_code)
            if resp.status_code == 410 or last in GONE_REASONS:
                gone = True
                break
            if last in ("DeviceTokenNotForTopic", "BadDeviceToken", "TopicDisallowed"):
                continue
            break  # auth/payload problem: trying other routes will not help
        if delivered:
            success += 1
            continue
        failure += 1
        if gone:
            dead.append(token)
            _route_cache.pop(token, None)
        elif last in ("DeviceTokenNotForTopic", "BadDeviceToken"):
            # No B-Seva app/environment accepts this token: it cannot ever be delivered.
            dead.append(token)
        else:
            logger.warning("APNs send failed for token …%s: %s", token[-8:], last)
    return success, failure, dead


def send_to_apns_tokens(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: Mapping[str, str],
) -> tuple[int, int, list[str]]:
    import httpx

    with httpx.Client(http2=True, timeout=10.0) as client:
        return send_apns(client, tokens, title=title, body=body, data=data)
