from app.services.firebase_notifications import is_invalid_token_error, stringify_data, web_click_url


def test_stringify_data_coerces_non_strings():
    out = stringify_data({"link": "/customer/bookings", "booking_id": 12, "skip": None})
    assert out["link"] == "/customer/bookings"
    assert out["booking_id"] == "12"
    assert "skip" not in out


def test_invalid_token_error_codes():
    class Fake(Exception):
        code = "UNREGISTERED"

    assert is_invalid_token_error(Fake("gone"))
    assert is_invalid_token_error(Exception("Requested entity was not found."))
    assert not is_invalid_token_error(Exception("quota exceeded"))


def test_web_click_url_maps_admin_path(monkeypatch):
    monkeypatch.setenv("PUBLIC_APP_URL", "https://b-seva.example")
    monkeypatch.setenv("VITE_ADMIN_PATH", "/bseva-ops-m8k4q")
    url = web_click_url({"link": "/admin/bookings"})
    assert url == "https://b-seva.example/bseva-ops-m8k4q/bookings"
    assert web_click_url({"link": "/customer/bookings"}) == "https://b-seva.example/customer/bookings"
