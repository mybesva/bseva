#!/usr/bin/env python3
"""API-backed Seva expansion verification against a running backend."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

BASE = "http://127.0.0.1:8000/api/v1"
PASSWORD = "TestPass123!"


def req(method: str, path: str, data: dict | None = None, token: str | None = None) -> tuple[int, Any]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=45) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def login(email: str) -> str | None:
    code, data = req("POST", "/auth/login", {"identifier": email, "password": PASSWORD})
    return data.get("access_token") if code == 200 else None


def main() -> int:
    results: list[tuple[str, bool, str]] = []

    customer = login("customer1@bseva.test")
    admin = login("admin@bseva.test")
    pujari = login("pujari1@bseva.test")
    results.append(("auth_customer", customer is not None, "token" if customer else "fail"))
    results.append(("auth_admin", admin is not None, "token" if admin else "fail"))
    results.append(("auth_pujari", pujari is not None, "token" if pujari else "fail"))

    code, cfg = req("GET", "/seva/config")
    results.append(("seva_config", code == 200 and cfg.get("seva_events_enabled") is True, str(cfg)))

    code, events = req("GET", "/seva/events")
    n = len(events) if isinstance(events, list) else 0
    results.append(("list_published_events", code == 200 and n > 0, str(n)))

    kinds = {e.get("puja_event_kind") for e in (events or []) if isinstance(events, list)}
    modes = {e.get("participation_mode") for e in (events or []) if isinstance(events, list)}
    results.append(("has_group_live", "group_live" in kinds, str(kinds)))
    results.append(("has_proxy", "proxy" in kinds, str(kinds)))
    results.append(("has_pravachan_modes", bool({"offline", "online", "hybrid"} & modes), str(modes)))

    if isinstance(events, list) and events:
        eid = events[0]["id"]
        code, detail = req("GET", f"/seva/events/{eid}")
        results.append(("event_detail_public", code == 200, detail.get("title", code) if code == 200 else str(detail)))

    if customer and isinstance(events, list):
        free_evt = next((e for e in events if e.get("is_free")), None)
        if free_evt:
            code, reg = req(
                "POST",
                f"/seva/events/{free_evt['id']}/register",
                {"participation_mode": "offline", "sankalp_text": "E2E test"},
                token=customer,
            )
            results.append(("register_free_event", code in (200, 201, 409), str(code)))

    code, mine = req("GET", "/seva/my-registrations", token=customer) if customer else (401, None)
    results.append(("my_seva_list", code == 200 and isinstance(mine, list), str(len(mine) if isinstance(mine, list) else code)))

    if admin:
        code, _ = req("PUT", "/admin/config", {"key": "pravachan_enabled", "value": False}, token=admin)
        code2, filtered = req("GET", "/seva/events?service_type=pravachan")
        results.append(
            (
                "pravachan_disabled_hidden",
                code == 200 and code2 == 200 and len(filtered or []) == 0,
                f"settings={code} events={len(filtered or [])}",
            )
        )
        req("PUT", "/admin/config", {"key": "pravachan_enabled", "value": True}, token=admin)

        code, _ = req("PUT", "/admin/config", {"key": "seva_events_enabled", "value": False}, token=admin)
        code2, body = req("GET", "/seva/events")
        results.append(
            (
                "seva_disabled_empty",
                code == 200 and code2 == 503,
                f"settings={code} list={code2}",
            )
        )
        req("PUT", "/admin/config", {"key": "seva_events_enabled", "value": True}, token=admin)

    if pujari:
        code, pe = req("GET", "/pujari/seva-events", token=pujari)
        results.append(("pujari_seva_events", code == 200 and isinstance(pe, list), str(len(pe) if isinstance(pe, list) else code)))

    # Event-level invite token must not work publicly
    if isinstance(events, list) and events:
        probe = "f" * 32
        code, _ = req("GET", f"/meetings/invite/{probe}")
        results.append(("unknown_invite_404", code == 404, str(code)))

    passed = sum(1 for _, ok, _ in results if ok)
    print("SEVA API E2E")
    for name, ok, info in results:
        print(f"{'PASS' if ok else 'FAIL'} {name}: {info}")
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
