"""End-to-end RBAC matrix against a running API (default http://localhost:8000).

Uses Super Admin super@bseva.test and two dedicated test admins (rbac-admin-a/b@bseva.test),
all with the seed password. Every permission change it makes is restored at the end, and the
test customer / temple it creates are deleted again.

    cd backend && python3 scripts/rbac_e2e.py [--base http://localhost:8000]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

PASSWORD = "TestPass123!"
SUPER = "super@bseva.test"
ADMIN_A = "rbac-admin-a@bseva.test"
ADMIN_B = "rbac-admin-b@bseva.test"

# Keys that must never appear in an Admin's dashboard payload.
MONEY_MARKERS = ("paise", "revenue", "fee", "payable", "payout", "settle", "commission", "profit", "earning", "amount")

results: list[tuple[str, str, bool, str]] = []


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/") + "/api/v1"

    def call(self, method: str, path: str, token: str | None = None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw) if raw else None
            except ValueError:
                return e.code, raw.decode(errors="replace")

    def login(self, email: str) -> tuple[str, str]:
        st, body = self.call("POST", "/auth/login", body={"identifier": email, "password": PASSWORD})
        if st != 200:
            raise SystemExit(f"login failed for {email}: {st} {body}")
        token = body.get("access_token") or body.get("token")
        st, me = self.call("GET", "/admin/me/permissions", token)
        uid = (body.get("user") or {}).get("id")
        return token, uid


def check(scenario: str, name: str, ok: bool, detail: str = ""):
    results.append((scenario, name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not ok else ""))


def expect(api: Api, scenario: str, token: str, method: str, path: str, want: int | tuple, body=None, label: str | None = None):
    st, data = api.call(method, path, token, body)
    wants = want if isinstance(want, tuple) else (want,)
    detail = f"got {st}"
    if st == 403 and isinstance(data, dict):
        leaked = [k for k in data if k not in ("detail",)]
        if leaked:
            detail += f" with extra body keys {leaked}"
            check(scenario, f"{label or method + ' ' + path} -> 403 has no data", False, detail)
    check(scenario, label or f"{method} {path} -> {'/'.join(map(str, wants))}", st in wants, detail)
    return st, data


def money_keys(obj, path="") -> list[str]:
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if any(m in k.lower() for m in MONEY_MARKERS):
                found.append(f"{path}.{k}")
            found += money_keys(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += money_keys(v, f"{path}[{i}]")
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    args = ap.parse_args()
    api = Api(args.base)

    sup, sup_id = api.login(SUPER)
    a, a_id = api.login(ADMIN_A)
    b, b_id = api.login(ADMIN_B)
    _, admins = api.call("GET", "/admin/admins", sup)
    by_email = {x["email"]: x for x in admins}
    a_id, b_id, sup_id = by_email[ADMIN_A]["id"], by_email[ADMIN_B]["id"], by_email[SUPER]["id"]
    original = {a_id: by_email[ADMIN_A]["permissions"], b_id: by_email[ADMIN_B]["permissions"]}

    def grant(uid, perms):
        st, body = api.call("PUT", f"/admin/users/{uid}/permissions", sup, {"permissions": perms})
        assert st == 200, (st, body)
        time.sleep(0.05)

    # Sample ids for detail endpoints
    _, bl = api.call("GET", "/bookings?page=1&limit=1", sup)
    booking_id = (bl.get("items") or [{}])[0].get("id") if isinstance(bl, dict) else None
    _, pl = api.call("GET", "/admin/pujaris?page=1&page_size=1", sup)
    pujari_id = ((pl or {}).get("items") or [{}])[0].get("id") if isinstance(pl, dict) else None

    MODULES = {  # module -> (method, path) read endpoint
        "customers": ("GET", "/admin/users?role=customer"),
        "pujaris": ("GET", "/admin/pujaris"),
        "temples": ("GET", "/admin/temples"),
        "services": ("GET", "/admin/services"),
        "recommendations": ("GET", "/admin/recommendations"),
        "bookings": ("GET", "/bookings?page=1&limit=5"),
        "seva_events": ("GET", "/admin/seva/events"),
        "muhurtham": ("GET", "/muhurta-consultations"),
        "invoices": ("GET", "/admin/invoices"),
        "pricing": ("GET", "/admin/location-prices"),
        "reviews": ("GET", "/admin/reviews"),
        "promotions": ("GET", "/admin/promos/banners"),
        "support": ("GET", "/support/tickets"),
        "legal": ("GET", "/admin/legal"),
    }
    SUPER_ONLY = {
        "financial dashboard": ("GET", "/admin/stats"),
        "financial overview": ("GET", "/admin/stats/overview"),
        "settlements": ("GET", "/settlements"),
        "reports": ("GET", "/admin/reports"),
        "admin list": ("GET", "/admin/admins"),
        "permission catalogue": ("GET", "/admin/permissions/catalog"),
        "platform config": ("GET", "/admin/config"),
        "GST / platform pricing": ("GET", "/admin/pricing"),
        "pujari roles": ("GET", "/admin/pujari-roles"),
    }

    try:
        print("\nA. Super Admin — everything works")
        for name, (m, p) in {**MODULES, **SUPER_ONLY}.items():
            expect(api, "A", sup, m, p, 200, label=f"super: {name}")
        st, dash = api.call("GET", "/admin/stats/overview", sup)
        check("A", "super: overview still has revenue", st == 200 and "revenue" in (dash or {}).get("month", {}))
        st, pay = api.call("GET", "/bookings?page=1&limit=5&stats=true", sup)
        check("A", "super: payment aggregates present", st == 200 and (pay or {}).get("payment_stats") is not None)

        print("\nB. Admin with no permissions")
        grant(a_id, [])
        st, me = api.call("GET", "/admin/me/permissions", a)
        check("B", "me/permissions is empty", st == 200 and me["permissions"] == [], str(me))
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("B", "ops dashboard renders with no sections", st == 200 and d["sections"] == [], str(d))
        for name, (m, p) in {**MODULES, **SUPER_ONLY}.items():
            expect(api, "B", a, m, p, 403, label=f"no-perms: {name} -> 403")
        st, nb = api.call("GET", "/notifications/nav-badges", a)
        leaked = [k for k in ("pujaris", "virtual_puja", "support", "payments", "settlements", "muhurtham") if k in (nb or {})]
        check("B", "nav badges expose no module counts", st == 200 and not leaked and not (nb or {}).get("bookings"), str(leaked))

        print("\nC. Admin with Customers only")
        grant(a_id, ["view_customers"])
        expect(api, "C", a, "GET", "/admin/users?role=customer", 200, label="customers list -> 200")
        expect(api, "C", a, "GET", "/admin/users?role=pujari", 403, label="users?role=pujari -> 403")
        expect(api, "C", a, "GET", "/admin/users?role=admin", 403, label="users?role=admin -> 403")
        st, ul = api.call("GET", "/admin/users?page_size=100", a)
        roles = {u["role"] for u in (ul or {}).get("items", [])}
        check("C", "unfiltered users list contains customers only", st == 200 and roles <= {"customer"}, str(roles))
        for name in ("pujaris", "bookings", "services", "temples"):
            m, p = MODULES[name]
            expect(api, "C", a, m, p, 403, label=f"customers-only: {name} -> 403")
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("C", "dashboard sections == customers", st == 200 and d["sections"] == ["customers"], str(d.get("sections")))
        new_customer = {"name": "RBAC Test Customer", "email": "rbac-cust@bsevatest.in", "phone": "9000000199",
                        "password": "TestPass123!", "role": "customer"}
        expect(api, "C", a, "POST", "/admin/users", 403, new_customer, label="create customer without create_customers -> 403")

        print("\nD. Admin with Customers + Pujaris")
        grant(a_id, ["view_customers", "view_pujaris"])
        expect(api, "D", a, "GET", "/admin/pujaris", 200, label="pujaris list -> 200")
        expect(api, "D", a, "GET", "/admin/users?role=pujari", 200, label="users?role=pujari -> 200")
        if pujari_id:
            expect(api, "D", a, "GET", f"/admin/pujaris/{pujari_id}", 200, label="pujari detail -> 200")
            expect(api, "D", a, "POST", f"/admin/pujaris/{pujari_id}/verify", 403, {"verification_status": "approved"},
                   label="verify pujari without verify_pujaris -> 403")
            expect(api, "D", a, "POST", f"/admin/users/{pujari_id}/block", 403, {"blocked": True},
                   label="block pujari without block_pujaris -> 403")
            expect(api, "D", a, "POST", f"/admin/pujaris/{pujari_id}/head", 403, {"is_head_pujari": True},
                   label="make head pujari without approve_pujaris -> 403")
        expect(api, "D", a, "GET", "/bookings?page=1&limit=5", 403, label="bookings -> 403")
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("D", "dashboard sections == customers, pujaris", st == 200 and d["sections"] == ["customers", "pujaris"], str(d.get("sections")))

        print("\nE. Admin with Bookings")
        grant(a_id, ["view_bookings"])
        st, bk = expect(api, "E", a, "GET", "/bookings?page=1&limit=5&stats=true", 200, label="bookings list -> 200")
        check("E", "no payment aggregates for admin (stats=true)", (bk or {}).get("payment_stats") is None)
        if booking_id:
            expect(api, "E", a, "GET", f"/bookings/{booking_id}", 200, label="booking detail -> 200")
            expect(api, "E", a, "POST", f"/admin/bookings/{booking_id}/assign", 403, {"pujari_id": pujari_id or booking_id},
                   label="assign pujari without manage_bookings -> 403")
            expect(api, "E", a, "PATCH", f"/bookings/{booking_id}/status?status=confirmed", 403,
                   label="change status without manage_bookings -> 403")
            expect(api, "E", a, "POST", f"/bookings/{booking_id}/cancel", 403, label="cancel without manage_bookings -> 403")
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("E", "dashboard has bookings + top_services", st == 200 and {"bookings", "top_services"} <= set(d["sections"]), str(d.get("sections")))
        expect(api, "E", a, "GET", "/admin/pujaris", 403, label="pujaris -> 403")

        print("\nF/G. Settlements are Super Admin only")
        grant(a_id, [x for x in original[a_id]] or ["view_bookings", "manage_bookings", "view_payments"])
        expect(api, "G", a, "GET", "/settlements", 403, label="GET /settlements -> 403")
        expect(api, "G", a, "POST", "/settlements/00000000-0000-0000-0000-000000000000/override", 403,
               {"status": "settled", "reason": "x"}, label="POST settlement override -> 403")
        st, bad = api.call("PUT", f"/admin/users/{a_id}/permissions", sup, {"permissions": ["manage_settlements"]})
        check("G", "Super Admin cannot assign manage_settlements to an Admin (400)", st == 400, str(bad))
        st, bad = api.call("PUT", f"/admin/users/{a_id}/permissions", sup, {"permissions": ["view_reports"]})
        check("G", "Super Admin cannot assign view_reports to an Admin (400)", st == 400, str(bad))

        print("\nG2. Legacy Super-Admin-only rows are ignored for role=admin")
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from sqlalchemy import text as _t
        from app.db import engine as _e
        with _e.begin() as c:
            c.execute(_t("INSERT INTO admin_permissions (user_id, permission) VALUES (CAST(:u AS uuid), 'manage_settlements') ON CONFLICT DO NOTHING"), {"u": a_id})
            c.execute(_t("INSERT INTO admin_permissions (user_id, permission) VALUES (CAST(:u AS uuid), 'view_reports') ON CONFLICT DO NOTHING"), {"u": a_id})
        st, me = api.call("GET", "/admin/me/permissions", a)
        check("G2", "legacy manage_settlements/view_reports not effective", "manage_settlements" not in me["permissions"] and "view_reports" not in me["permissions"], str(me["permissions"]))
        expect(api, "G2", a, "GET", "/settlements", 403, label="settlements still 403 with legacy row")
        expect(api, "G2", a, "GET", "/admin/reports", 403, label="reports still 403 with legacy row")
        with _e.begin() as c:
            c.execute(_t("DELETE FROM admin_permissions WHERE user_id = CAST(:u AS uuid) AND permission IN ('manage_settlements','view_reports')"), {"u": a_id})

        print("\nH. Admin Permissions URL/API are Super Admin only")
        grant(a_id, ["view_customers", "edit_customers"])
        expect(api, "H", a, "GET", "/admin/admins", 403, label="GET /admin/admins -> 403")
        expect(api, "H", a, "GET", "/admin/permissions/catalog", 403, label="GET catalogue -> 403")
        expect(api, "H", a, "PUT", f"/admin/users/{a_id}/permissions", 403, {"permissions": ["view_bookings"]}, label="self-grant -> 403")
        expect(api, "H", a, "PUT", f"/admin/users/{b_id}/permissions", 403, {"permissions": ["view_bookings"]}, label="grant other admin -> 403")
        expect(api, "H", a, "POST", f"/admin/users/{b_id}/promote-super", 403, label="promote to super -> 403")
        expect(api, "H", a, "POST", f"/admin/users/{b_id}/block", 403, {"blocked": True}, label="block another admin -> 403")
        expect(api, "H", a, "DELETE", f"/admin/users/{sup_id}", (400, 403), label="delete Super Admin -> denied")

        print("\nI. Dashboard data-leak check (admin with every permission)")
        st, cat = api.call("GET", "/admin/permissions/catalog", sup)
        all_assignable = [p["key"] for g in cat["groups"] for p in g["permissions"]]
        grant(a_id, all_assignable)
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        leaks = money_keys(d)
        check("I", "ops dashboard payload contains no money fields", st == 200 and not leaks, ", ".join(leaks[:8]))
        check("I", "ops dashboard has all sections", st == 200 and len(d["sections"]) >= 9, str(d.get("sections")))
        for name, (m, p) in SUPER_ONLY.items():
            expect(api, "I", a, m, p, 403, label=f"all-perms admin: {name} -> 403")
        st, bk = api.call("GET", "/bookings?page=1&limit=5&stats=true", a)
        check("I", "all-perms admin gets no payment aggregates", st == 200 and bk.get("payment_stats") is None)

        print("\nJ. Revocation takes effect")
        grant(a_id, ["view_customers", "view_pujaris", "view_bookings"])
        expect(api, "J", a, "GET", "/admin/pujaris", 200, label="before: pujaris -> 200")
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("J", "before: dashboard has pujaris", "pujaris" in d["sections"])
        grant(a_id, ["view_customers", "view_bookings"])
        expect(api, "J", a, "GET", "/admin/pujaris", 403, label="after revoke: pujaris -> 403")
        if pujari_id:
            expect(api, "J", a, "GET", f"/admin/pujaris/{pujari_id}", 403, label="after revoke: pujari detail -> 403")
        expect(api, "J", a, "GET", "/admin/users?role=pujari", 403, label="after revoke: users?role=pujari -> 403")
        st, d = api.call("GET", "/admin/dashboard/ops", a)
        check("J", "after revoke: dashboard has no pujaris section", "pujaris" not in d["sections"] and "pujaris" not in d, str(d.get("sections")))
        expect(api, "J", a, "GET", "/admin/users?role=customer", 200, label="after revoke: customers still 200")

        print("\nK. Two admins are independent")
        grant(a_id, ["view_customers"])
        grant(b_id, ["view_bookings"])
        expect(api, "K", a, "GET", "/admin/users?role=customer", 200, label="A: customers -> 200")
        expect(api, "K", a, "GET", "/bookings?page=1&limit=1", 403, label="A: bookings -> 403")
        expect(api, "K", b, "GET", "/bookings?page=1&limit=1", 200, label="B: bookings -> 200")
        expect(api, "K", b, "GET", "/admin/users?role=customer", 403, label="B: customers -> 403")
        grant(a_id, ["view_customers", "view_pujaris"])
        expect(api, "K", b, "GET", "/admin/pujaris", 403, label="changing A does not grant B pujaris")
        st, mb = api.call("GET", "/admin/me/permissions", b)
        check("K", "B's permissions unchanged", mb["permissions"] == ["view_bookings"], str(mb["permissions"]))

        print("\nL. Positive mutation lifecycle (customers + temples), then cleanup")
        grant(a_id, ["view_customers", "create_customers", "edit_customers", "view_temples", "manage_temples"])
        st, created = expect(api, "L", a, "POST", "/admin/users", 200, new_customer, label="create customer -> 200")
        cid = (created or {}).get("id") or (created or {}).get("user", {}).get("id")
        if not cid:
            _, found = api.call("GET", "/admin/users?role=customer&q=rbac-cust", sup)
            cid = ((found or {}).get("items") or [{}])[0].get("id")
        if cid:
            expect(api, "L", a, "PUT", f"/admin/users/{cid}/customer", 200, {"name": "RBAC Test Customer 2"}, label="edit customer -> 200")
            expect(api, "L", a, "POST", f"/admin/users/{cid}/block", 200, {"blocked": True, "reason": "rbac test"}, label="block customer -> 200")
            expect(api, "L", a, "POST", f"/admin/users/{cid}/block", 200, {"blocked": False}, label="unblock customer -> 200")
            expect(api, "L", b, "DELETE", f"/admin/users/{cid}", 403, label="B (no customer perms) delete -> 403")
            expect(api, "L", a, "DELETE", f"/admin/users/{cid}", 200, label="delete customer -> 200")
        st, temple = expect(api, "L", a, "POST", "/admin/temples", (200, 201), {"name": "RBAC Test Temple", "city": "Hyderabad"}, label="create temple -> 200")
        tid = (temple or {}).get("id")
        if tid:
            expect(api, "L", b, "DELETE", f"/admin/temples/{tid}", 403, label="B delete temple -> 403")
            expect(api, "L", a, "DELETE", f"/admin/temples/{tid}", 200, label="delete temple -> 200")
        grant(a_id, ["view_promotions", "view_pricing"])
        expect(api, "L", a, "GET", "/admin/promos/banners", 200, label="view promotions -> 200")
        expect(api, "L", a, "POST", "/admin/promos/banners", 403, {"title": "x"}, label="create banner without manage_promotions -> 403")
        expect(api, "L", a, "GET", "/admin/location-prices", 200, label="view pricing rules -> 200")
        expect(api, "L", a, "POST", "/admin/location-prices", 403, {"city": "X"}, label="create pricing rule without manage_pricing -> 403")

        print("\nM. Authentication")
        expect(api, "M", None, "GET", "/admin/dashboard/ops", 401, label="no token -> 401")
        expect(api, "M", "not-a-real-token", "GET", "/admin/dashboard/ops", 401, label="invalid token -> 401")
    finally:
        for uid, perms in original.items():
            api.call("PUT", f"/admin/users/{uid}/permissions", sup, {"permissions": perms})

    failed = [r for r in results if not r[2]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    for sc, name, _, detail in failed:
        print(f"  FAIL [{sc}] {name} {detail}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
