"""VPN / proxy detection for Virtual Puja bookings (server-side)."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

VPN_MESSAGE = (
    "Virtual Puja cannot be booked while a VPN or proxy is active. "
    "Please turn off your VPN/proxy and try again."
)

_VPN_ORG_HINTS = (
    "vpn",
    "proxy",
    "datacenter",
    "data center",
    "hosting",
    "cloudflare",
    "digitalocean",
    "linode",
    "ovh",
    "amazon.com",
    "aws",
    "google cloud",
    "microsoft azure",
    "hetzner",
    "m247",
    "nordvpn",
    "expressvpn",
    "surfshark",
    "cyberghost",
    "private internet access",
)


def client_ip(request: Request) -> str:
    for header in ("cf-connecting-ip", "true-client-ip", "x-real-ip", "x-forwarded-for"):
        raw = (request.headers.get(header) or "").strip()
        if not raw:
            continue
        return raw.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return ""


def _looks_like_vpn_org(org: str) -> bool:
    blob = (org or "").lower()
    return any(h in blob for h in _VPN_ORG_HINTS)


def inspect_ip(ip: str) -> dict[str, Any]:
    """Return detection details. Never raises to the caller."""
    out: dict[str, Any] = {
        "ip": ip,
        "vpn_or_proxy": False,
        "country_code": None,
        "org": None,
        "source": None,
    }
    if not ip or ip in {"127.0.0.1", "::1", "localhost", "testclient"}:
        out["source"] = "local"
        return out
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,message,proxy,hosting,countryCode,org,as,query"
        with httpx.Client(timeout=4.0) as client:
            res = client.get(url)
            data = res.json() if res.status_code == 200 else {}
        if str(data.get("status") or "") == "success":
            out["source"] = "ip-api"
            out["country_code"] = data.get("countryCode")
            out["org"] = data.get("org") or data.get("as")
            if data.get("proxy") or data.get("hosting") or _looks_like_vpn_org(str(out["org"] or "")):
                out["vpn_or_proxy"] = True
            return out
    except Exception:
        logger.warning("VPN lookup via ip-api failed for %s", ip, exc_info=True)
    try:
        with httpx.Client(timeout=4.0) as client:
            res = client.get(f"https://ipapi.co/{ip}/json/")
            data = res.json() if res.status_code == 200 else {}
        if data.get("error"):
            return out
        out["source"] = "ipapi.co"
        out["country_code"] = data.get("country") or data.get("country_code")
        out["org"] = data.get("org") or data.get("org_name")
        if _looks_like_vpn_org(str(out["org"] or "")):
            out["vpn_or_proxy"] = True
    except Exception:
        logger.warning("VPN lookup via ipapi.co failed for %s", ip, exc_info=True)
    return out


def assert_not_vpn(request: Request) -> dict[str, Any]:
    from fastapi import HTTPException

    info = inspect_ip(client_ip(request))
    if info.get("vpn_or_proxy"):
        raise HTTPException(403, VPN_MESSAGE)
    return info
