from app.booking_access import accept_denied, is_uuid, same_id
from app.routers.notifications import (
    customer_booking_link,
    pujari_booking_link,
    rewrite_customer_booking_link,
    rewrite_pujari_booking_link,
)


def test_customer_booking_link_points_at_one_booking():
    assert customer_booking_link("abc-123") == "/booking/abc-123"


def test_rewrite_uses_booking_number_in_existing_notification_body():
    lookup = {"BSV-260916-CD70F915": "11111111-1111-1111-1111-111111111111"}
    link = rewrite_customer_booking_link(
        "/customer/bookings",
        "Your booking BSV-260916-CD70F915 has been accepted.",
        lookup,
    )
    assert link == "/booking/11111111-1111-1111-1111-111111111111"


def test_rewrite_keeps_specific_booking_link():
    link = rewrite_customer_booking_link("/booking/already", "Booking BSV-1", {})
    assert link == "/booking/already"


def test_rewrite_query_booking_id_without_a_body_match():
    link = rewrite_customer_booking_link("/customer/bookings?booking=booking-9", "", {})
    assert link == "/booking/booking-9"


def test_pujari_booking_link_points_at_one_booking():
    assert pujari_booking_link("abc-123") == "/pujari/bookings/abc-123"


def test_pujari_rewrite_uses_booking_number_in_existing_notification():
    lookup = {"BSV-260922-BCDF3C1": "22222222-2222-2222-2222-222222222222"}
    link = rewrite_pujari_booking_link(
        "/pujari/bookings",
        "New booking BSV-260922-BCDF3C1 awaiting your acceptance.",
        lookup,
    )
    assert link == "/pujari/bookings/22222222-2222-2222-2222-222222222222"


def test_pujari_rewrite_keeps_specific_booking_link():
    link = rewrite_pujari_booking_link(
        "/pujari/bookings/already",
        "Booking BSV-260922-BCDF3C1",
        {},
    )
    assert link == "/pujari/bookings/already"


def test_pujari_rewrite_leaves_unrelated_links():
    link = rewrite_pujari_booking_link("/pujari/referral", "Booking BSV-1", {"BSV-1": "id"})
    assert link == "/pujari/referral"


def test_accept_allows_assigned_and_unassigned_bookings():
    assert accept_denied(True, "other", "me") is None
    assert accept_denied(False, None, "me") is None
    assert accept_denied(False, "other-pujari", "me") == "Another pujari already accepted this booking"


def test_same_id_ignores_uuid_punctuation():
    assert same_id("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", "aaaaaaaabbbbccccddddeeeeeeeeeeee")
    assert not same_id("me", "other")
    assert is_uuid("11111111-1111-1111-1111-111111111111")
    assert not is_uuid("BSV-260922-BCDF3C1")
