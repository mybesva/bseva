from app.pricing import dakshina_fixed_paise, pujari_dakshina_paise
from app.pujari_services import premium_dakshina_paise_for_service


def test_percent_dakshina_scales_with_package_price():
    service = {"dakshina_share_percent": 80}
    assert pujari_dakshina_paise(service, 10_000_00, "standard") == 8_000_00
    assert pujari_dakshina_paise(service, 15_000_00, "premium") == 12_000_00


def test_fixed_dakshina_uses_separate_premium_amount():
    service = {"dakshina_amount_paise": 4_000_00, "premium_dakshina_amount_paise": 6_000_00}
    assert pujari_dakshina_paise(service, 10_000_00, "standard") == 4_000_00
    assert pujari_dakshina_paise(service, 15_000_00, "premium") == 6_000_00
    # No package given (older callers) keeps the Standard amount.
    assert pujari_dakshina_paise(service, 15_000_00) == 4_000_00


def test_premium_falls_back_to_standard_amount_when_empty():
    service = {"dakshina_amount_paise": 4_000_00, "premium_dakshina_amount_paise": None}
    assert dakshina_fixed_paise(service, "premium") == 4_000_00
    assert pujari_dakshina_paise(service, 15_000_00, "premium") == 4_000_00


def test_premium_amount_ignored_without_fixed_standard_amount():
    # Percentage mode: a stray Premium amount must not switch the puja to fixed pay.
    service = {"dakshina_share_percent": 85, "premium_dakshina_amount_paise": 6_000_00}
    assert dakshina_fixed_paise(service, "premium") is None
    assert pujari_dakshina_paise(service, 10_000_00, "premium") == 8_500_00


def test_fixed_dakshina_never_exceeds_puja_price():
    service = {"dakshina_amount_paise": 4_000_00, "premium_dakshina_amount_paise": 20_000_00}
    assert pujari_dakshina_paise(service, 15_000_00, "premium") == 15_000_00


def test_pujari_offer_shows_premium_share():
    service = {
        "standard_price_paise": 10_000_00,
        "premium_price_paise": 15_000_00,
        "dakshina_amount_paise": 4_000_00,
        "premium_dakshina_amount_paise": 6_000_00,
    }
    assert premium_dakshina_paise_for_service(service) == 6_000_00
    # Percentage mode: % of the Premium package price.
    assert premium_dakshina_paise_for_service({**service, "dakshina_amount_paise": None, "dakshina_share_percent": 80}) == 12_000_00
    # Main puja price set: Premium = main + (Premium − Standard).
    assert premium_dakshina_paise_for_service(
        {"standard_price_paise": 10_000_00, "premium_price_paise": 15_000_00, "main_puja_price_paise": 8_000_00, "dakshina_share_percent": 50}
    ) == 6_500_00
    assert premium_dakshina_paise_for_service({"standard_price_paise": 10_000_00}) is None


def test_percent_dakshina_uses_separate_premium_percent():
    service = {"dakshina_share_percent": 80, "premium_dakshina_share_percent": 70}
    assert pujari_dakshina_paise(service, 10_000_00, "standard") == 8_000_00
    assert pujari_dakshina_paise(service, 20_000_00, "premium") == 14_000_00
    # Empty Premium % keeps the Standard % for Premium bookings.
    assert pujari_dakshina_paise({"dakshina_share_percent": 80}, 20_000_00, "premium") == 16_000_00
    # Out-of-range Premium % is ignored rather than paying more than the puja price.
    assert pujari_dakshina_paise({"dakshina_share_percent": 80, "premium_dakshina_share_percent": 150}, 20_000_00, "premium") == 16_000_00


def test_pujari_offer_uses_premium_percent():
    service = {
        "standard_price_paise": 10_000_00,
        "premium_price_paise": 20_000_00,
        "dakshina_share_percent": 80,
        "premium_dakshina_share_percent": 70,
    }
    assert premium_dakshina_paise_for_service(service) == 14_000_00
