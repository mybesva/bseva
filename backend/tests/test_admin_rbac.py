"""Admin RBAC rules (pure) + a route-coverage guard so no /admin endpoint ships unprotected."""
from fastapi.routing import APIRoute

from app import rbac
from app.main import app


def _perms(monkeypatch, perms):
    monkeypatch.setattr(rbac, "user_permissions", lambda db, user: list(perms))


ADMIN = {"id": "a", "role": "admin"}
SUPER = {"id": "s", "role": "super_admin"}


def test_super_only_never_assignable():
    assert not set(rbac.SUPER_ADMIN_ONLY) & set(rbac.ADMIN_ASSIGNABLE)
    for key in ("manage_settlements", "view_reports", "manage_admins", "view_financials", "manage_config"):
        assert key in rbac.SUPER_ADMIN_ONLY


def test_catalog_labels_are_human_readable():
    payload = rbac.catalog_payload()
    keys = [p["key"] for g in payload["groups"] for p in g["permissions"]]
    assert keys == rbac.ADMIN_ASSIGNABLE
    for g in payload["groups"]:
        for p in g["permissions"]:
            assert p["label"] and "_" not in p["label"]


def test_super_admin_has_everything(monkeypatch):
    _perms(monkeypatch, [])
    assert rbac.has_permission(None, SUPER, "manage_settlements")
    assert rbac.has_permission(None, SUPER, "view_customers")


def test_admin_never_gets_super_only_even_with_legacy_row(monkeypatch):
    _perms(monkeypatch, ["manage_settlements", "view_reports", "view_customers"])
    assert not rbac.has_permission(None, ADMIN, "manage_settlements")
    assert not rbac.has_permission(None, ADMIN, "view_reports")
    assert rbac.has_permission(None, ADMIN, "view_customers")


def test_admin_permission_is_exact(monkeypatch):
    _perms(monkeypatch, ["view_customers"])
    assert rbac.has_permission(None, ADMIN, "view_customers")
    assert not rbac.has_permission(None, ADMIN, "edit_customers")
    assert not rbac.has_permission(None, ADMIN, "view_pujaris")


def test_non_admin_roles_have_no_back_office_permissions(monkeypatch):
    _perms(monkeypatch, ["view_customers"])
    for role in ("customer", "pujari", "head_pujari"):
        assert not rbac.has_permission(None, {"id": "x", "role": role}, "view_customers")


def test_booking_permissions_by_mode():
    assert rbac.booking_permissions("virtual", "manage") == ("manage_bookings", "manage_virtual_puja")
    assert rbac.booking_permissions("in_person", "manage") == ("manage_bookings",)
    assert "view_virtual_puja" in rbac.booking_permissions("virtual", "view")
    assert "view_virtual_puja" not in rbac.booking_permissions("in_person", "view")


def test_legacy_expansion_keeps_access_and_drops_super_only():
    out = rbac.expand_legacy(["manage_services", "view_bookings", "manage_settlements", "view_reports"])
    for k in ("view_services", "manage_temples", "view_recommendations", "view_reviews", "view_virtual_puja"):
        assert k in out
    assert "manage_settlements" not in out and "view_reports" not in out
    assert all(k in rbac.ADMIN_ASSIGNABLE for k in out)


def _guard_names(dep, out):
    name = getattr(dep.call, "__qualname__", "")
    out.append(name)
    for d in dep.dependencies:
        _guard_names(d, out)


def test_every_admin_route_is_permission_guarded():
    """/api/v1/admin/* must use require_permission / require_any_permission / require_super_admin
    (or require_admin for the caller's own permissions / the scoped ops dashboard)."""
    allowed_admin_only = {"/api/v1/admin/me/permissions", "/api/v1/admin/dashboard/ops", "/api/v1/admin/users/{user_id}/promote-super"}
    unguarded = []
    for r in app.routes:
        if not isinstance(r, APIRoute) or not r.path.startswith("/api/v1/admin"):
            continue
        names = []
        _guard_names(r.dependant, names)
        guarded = any(n.startswith(("require_permission", "require_any_permission", "require_super_admin")) for n in names)
        if not guarded and not (r.path in allowed_admin_only and any(n.startswith("require_admin") for n in names)):
            unguarded.append(f"{sorted(r.methods)} {r.path}")
    assert not unguarded, "Admin routes without a permission guard:\n" + "\n".join(unguarded)
