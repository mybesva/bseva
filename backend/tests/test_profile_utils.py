from app.profile_utils import pujari_profile_missing_required


def test_pujari_profile_missing_required_flags_empty_fields():
    missing = pujari_profile_missing_required(
        {
            "first_name": "Ram",
            "last_name": "Kumar",
            "gotra": "",
            "qualifications": "[]",
            "languages": "[]",
        }
    )
    assert "gotra" in missing
    assert "languages" in missing
