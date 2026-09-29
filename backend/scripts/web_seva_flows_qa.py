#!/usr/bin/env python3
"""Customer Web Seva flow verification via API + HTTP checks."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

WEB = "http://127.0.0.1:5174"
API = "http://127.0.0.1:8000/api/v1"
PASSWORD = "TestPass123!"


def req(method: str, path: str, data: dict | None = None, token: str | None = None, base: str = API) -> tuple[int, object]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def get(path: str) -> tuple[int, str]:
    request = urllib.request.Request(WEB + path)
    try:
        with urllib.request.urlopen(request, timeout=20) as resp:
            return resp.status, resp.read().decode(errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="ignore")


def main() -> int:
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        results.append((name, ok, detail))
        print(f"{name}: {'PASS' if ok else 'FAIL'} — {detail}")

    code, login = req("POST", "/auth/login", {"identifier": "customer1@bseva.test", "password": PASSWORD})
    token = login.get("access_token") if isinstance(login, dict) else None
    check("web_login_api", code == 200 and bool(token), f"status={code}")

    code, html = get("/login?role=customer")
    check("web_login_page", code == 200 and "Login" in html, f"status={code}")

    code, events = req("GET", "/seva/events")
    group = next((e for e in (events or []) if e.get("puja_event_kind") == "group_live"), None) if isinstance(events, list) else None
    check("web_seva_events", code == 200 and bool(group), f"events={len(events or [])}")

    if token:
        code, regs = req("GET", "/seva/my-registrations", token=token)
        reg = regs[0] if isinstance(regs, list) and regs else {}
        check("web_my_seva_api", code == 200 and bool(reg), reg.get("registration_number", str(code)))
        rid = reg.get("id")
        if rid:
            code, detail = req("GET", f"/seva/my-registrations/{rid}", token=token)
            join = detail.get("join_token") if isinstance(detail, dict) else None
            check("web_join_live_api", code == 200 and bool(join), f"can_join={detail.get('can_join_live') if isinstance(detail, dict) else None}")
            if join:
                code, invite = req("GET", f"/meetings/invite/{join}")
                check("web_join_live_invite", code == 200, str(invite)[:120] if invite else str(code))
                code, join_html = get(f"/join/{join}")
                check("web_join_live_page", code == 200 and ("Meeting" in join_html or "Video" in join_html or "meeting" in join_html.lower()), f"status={code}")
            check("web_proof_api", bool(reg.get("proof_released")), str(reg.get("proof_image_path")))
            check("web_prasad_api", reg.get("prasad_status") == "shipped", f"{reg.get('prasad_status')} {reg.get('prasad_tracking')}")
            code, my_html = get("/customer/my-seva")
            check("web_my_seva_page", code == 200 and ("My Seva" in my_html or "seva" in my_html.lower()), f"status={code}")

    # Virtual puja: enable flag + pick virtual-available service
    super_code, super_login = req("POST", "/auth/login", {"identifier": "super@bseva.test", "password": PASSWORD})
    super_token = super_login.get("access_token") if isinstance(super_login, dict) else None
    if super_token:
        req("PUT", "/admin/config", {"key": "virtual_puja_enabled", "value": True}, token=super_token)
    code, services = req("GET", "/services")
    virt = next((s for s in (services or []) if s.get("virtual_available")), None) if isinstance(services, list) else None
    if virt:
        slug = virt.get("canonical_slug") or virt.get("slug")
        code, book_html = get(f"/book/{slug}")
        check("web_virtual_puja_page", code == 200 and ("Virtual" in book_html or "virtual" in book_html.lower()), slug or str(code))
    else:
        check("web_virtual_puja_page", False, "no virtual_available service")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"SUMMARY {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
