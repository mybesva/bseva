from app.admin_nav_badges import (
    booking_tooltip,
    format_tooltip,
    payment_tooltip,
    pujari_tooltip,
    settlement_tooltip,
)


def test_format_tooltip_skips_empty():
    assert format_tooltip(["a", "", "b"]) == "a\nb"
    assert format_tooltip([]) == ""


def test_pujari_tooltip_single_reason():
    assert pujari_tooltip({"pending": 4}) == "4 Pujaris pending verification"
    assert pujari_tooltip({"pending": 1}) == "1 Pujari pending verification"


def test_pujari_tooltip_breakdown():
    tip = pujari_tooltip({"pending": 3, "correction_required": 1, "under_review": 2})
    assert tip == (
        "3 Pujaris pending verification\n"
        "2 Pujaris under review\n"
        "1 Pujari needs correction"
    )


def test_pujari_tooltip_includes_service_reviews():
    tip = pujari_tooltip({"pending": 1}, service_reviews=2)
    assert "1 Pujari pending verification" in tip
    assert "2 approved Pujaris have services awaiting review" in tip


def test_booking_tooltip_assignment_only():
    assert booking_tooltip(27, 0, virtual=False) == "27 bookings awaiting Pujari assignment"
    assert booking_tooltip(1, 0, virtual=False) == "1 booking awaiting Pujari assignment"


def test_booking_tooltip_mixed_reasons():
    tip = booking_tooltip(12, 3, virtual=False)
    assert tip == (
        "12 bookings awaiting Pujari assignment\n"
        "3 bookings requiring Pujari reassignment"
    )


def test_virtual_puja_tooltip():
    assert booking_tooltip(2, 0, virtual=True) == "2 Virtual Puja requests requiring action"
    assert booking_tooltip(0, 0, virtual=True, awaiting_accept=2) == (
        "2 Virtual Puja requests awaiting pujari acceptance"
    )
    tip = booking_tooltip(1, 1, virtual=True)
    assert "1 Virtual Puja request awaiting Pujari assignment" in tip
    assert "1 Virtual Puja request requiring reassignment" in tip


def test_payment_tooltip():
    assert payment_tooltip({"failed": 2, "refund_requested": 1}) == "2 failed payments\n1 refund requested"


def test_settlement_tooltip():
    assert settlement_tooltip(3, 1) == (
        "3 settlements awaiting payout cycle\n1 blocked settlement needing review"
    )
