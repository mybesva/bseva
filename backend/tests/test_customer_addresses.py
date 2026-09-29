"""Customer saved-address API behavior."""

from __future__ import annotations

from app.routers.customer import _addresses_match, _normalize_addr_field


def test_normalize_addr_field_collapses_whitespace():
    assert _normalize_addr_field("  Hello   World ") == "hello world"


def test_addresses_match_ignores_label():
    a = {
        "address_line1": "12 MG Road",
        "address_line2": "",
        "city": "Hyderabad",
        "district": "Hyderabad",
        "state": "Telangana",
        "pincode": "500001",
        "country": "India",
        "latitude": 17.385,
        "longitude": 78.4867,
    }
    b = {**a, "label": "Home"}
    c = {**a, "address_line1": "13 MG Road"}
    assert _addresses_match(a, b)
    assert not _addresses_match(a, c)


def test_addresses_match_requires_coords_when_both_present():
    a = {
        "address_line1": "12 MG Road",
        "city": "Hyderabad",
        "district": "Hyderabad",
        "state": "Telangana",
        "pincode": "500001",
        "country": "India",
        "latitude": 17.385,
        "longitude": 78.4867,
    }
    b = {**a, "latitude": 17.39, "longitude": 78.4867}
    assert not _addresses_match(a, b)
