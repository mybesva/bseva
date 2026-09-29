#!/usr/bin/env python3
"""Verify web login API + localStorage token path (automation vs app bug)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

API = "http://127.0.0.1:8000/api/v1"


def login(identifier: str, password: str) -> tuple[int, dict | str]:
    body = json.dumps({"identifier": identifier, "password": password}).encode()
    req = urllib.request.Request(
        f"{API}/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main() -> int:
    code, data = login("customer1@bseva.test", "TestPass123!")
    ok = code == 200 and isinstance(data, dict) and bool(data.get("access_token"))
    print(f"api_login: {'PASS' if ok else 'FAIL'} status={code}")
    if ok:
        print(f"token_prefix={data['access_token'][:24]}...")
        print(f"role={data.get('user', {}).get('role')}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
