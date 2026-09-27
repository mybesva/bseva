"""Exercise the real local website and authenticate the documented QA roles.

Writes screenshots/results, never credentials. Requires playwright and local QA servers.
"""
import json
import sys
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import seed

OUT = ROOT / ".runtime-qa/phase2"
OUT.mkdir(parents=True, exist_ok=True)
API = "http://localhost:8000"


def main():
    assert httpx.get(API + "/health").json()["ok"]
    assert httpx.get("http://localhost:5173").status_code == 200
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for role, email in [("customer", "customer1@bseva.test"), ("pujari", "pujari2@bseva.test"), ("head_pujari", "pujari1@bseva.test"), ("admin", "admin@bseva.test"), ("super_admin", "super@bseva.test")]:
            auth = httpx.post(API + "/api/v1/auth/login", json={"identifier": email, "password": seed.PASSWORD}, timeout=60)
            assert auth.status_code == 200, (role, auth.status_code, auth.text[:200])
            token = auth.json()["access_token"]
            me = httpx.get(API + "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=60)
            assert me.json()["role"] == role
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto("http://localhost:5173/login")
            page.locator('input').first.fill(email)
            page.locator('input[type=password]').fill(seed.PASSWORD)
            page.locator('button[type=submit]').click()
            expected = "/customer" if role == "customer" else "/pujari" if role in ("pujari", "head_pujari") else "/bseva-ops-m8k4q"
            page.wait_for_url("**" + expected, timeout=45000)
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"web-{role}-dashboard.png"), full_page=True)
            (OUT / f"web-{role}-dashboard.txt").write_text(page.locator("body").inner_text())
            results.append({"role": role, "email": email, "flow": "password login to dashboard", "url": page.url, "status": "PASS", "page_errors": errors})
            (OUT / "reference-results.json").write_text(json.dumps(results, indent=2))
            print(role, "website login and role verified", flush=True)
            context.close()
        browser.close()
    (OUT / "reference-results.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
