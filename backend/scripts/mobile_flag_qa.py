#!/usr/bin/env python3
"""Verify Customer Mobile seva flag filtering matches /seva/config (API contract QA)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"
PASSWORD = "TestPass123!"


def req(method: str, path: str, data: dict | None = None, token: str | None = None) -> tuple[int, object]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
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


def login(email: str) -> str:
    code, data = req("POST", "/auth/login", {"identifier": email, "password": PASSWORD})
    assert code == 200, data
    return data["access_token"]


def set_flag(token: str, key: str, value: bool) -> None:
    code, data = req("PUT", "/admin/config", {"key": key, "value": value}, token=token)
    assert code == 200, data


def mobile_lines(cfg: dict) -> list[str]:
    lines = []
    if cfg.get("seva_events_enabled", True) is not False:
        lines.append("puja")
    if cfg.get("chadhava_enabled", True) is not False:
        lines.append("chadhava")
    if cfg.get("pravachan_enabled", True) is not False:
        lines.append("pravachan")
    return lines


def main() -> int:
    super_token = login("super@bseva.test")
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        results.append((name, ok, detail))
        print(f"{name}: {'PASS' if ok else 'FAIL'} — {detail}")

    # baseline restore
    for key in ("seva_events_enabled", "chadhava_enabled", "pravachan_enabled"):
        set_flag(super_token, key, True)

    cases = [
        ("seva_events_enabled", False, ["chadhava", "pravachan"]),
        ("chadhava_enabled", False, ["puja", "pravachan"]),
        ("pravachan_enabled", False, ["puja", "chadhava"]),
    ]
    for key, val, expected in cases:
        for restore_key in ("seva_events_enabled", "chadhava_enabled", "pravachan_enabled"):
            set_flag(super_token, restore_key, True)
        set_flag(super_token, key, val)
        code, cfg = req("GET", "/seva/config")
        lines = mobile_lines(cfg if isinstance(cfg, dict) else {})
        check(f"mobile_flag_{key}_disabled", code == 200 and lines == expected, f"lines={lines}")

    for key in ("seva_events_enabled", "chadhava_enabled", "pravachan_enabled"):
        set_flag(super_token, key, True)
    code, cfg = req("GET", "/seva/config")
    lines = mobile_lines(cfg if isinstance(cfg, dict) else {})
    check("mobile_flag_restore_all", code == 200 and lines == ["puja", "chadhava", "pravachan"], f"lines={lines}")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"SUMMARY {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
