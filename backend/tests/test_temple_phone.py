from app.routers.temples import attach_pujari_status, phone_last10


def test_phone_last10_strips_country_code():
    assert phone_last10("+91 98765 43210") == "9876543210"
    assert phone_last10("919876543210") == "9876543210"
    assert phone_last10("9876543210") == "9876543210"


def test_phone_last10_empty():
    assert phone_last10("") == ""
    assert phone_last10(None) == ""


def test_attach_marks_registered_pujari():
    index = {
        "9876543210": {
            "pujari_user_id": "u1",
            "pujari_account_name": "Pandit Sharma",
            "pujari_verification_status": "approved",
            "pujari_blocked": False,
        }
    }
    out = attach_pujari_status({"contact_phone": "+91-9876543210", "pujari_name": ""}, index)
    assert out["pujari_registered"] is True
    assert out["pujari_account_name"] == "Pandit Sharma"
    assert out["pujari_name"] == "Pandit Sharma"


def test_attach_marks_not_on_platform():
    out = attach_pujari_status({"contact_phone": "9999999999", "pujari_name": "Local Priest"}, {})
    assert out["pujari_registered"] is False
    assert out["pujari_name"] == "Local Priest"
