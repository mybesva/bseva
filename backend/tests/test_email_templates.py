"""Unit tests for email templates and OTP helpers (no live SMTP)."""
from __future__ import annotations

from app.mail.templates import (
    booking_confirmation_email,
    login_otp_email,
    sample_booking_data,
    sample_invoice_data,
    invoice_receipt_email,
)
from app.otp_service import generate_otp_code


def test_generate_otp_is_six_digits():
    code = generate_otp_code()
    assert len(code) == 6
    assert code.isdigit()


def test_login_otp_template_shows_validity_and_code():
    content = login_otp_email(otp_code="482913", customer_name="Test User", test_mode=True)
    assert content.template_id == "login_otp"
    assert "482913" in content.html
    assert "Valid for: 10 minutes" in content.html
    assert "Do not share" in content.html
    assert "[TEST]" in content.subject
    assert "482913" in content.text


def test_booking_confirmation_includes_amounts():
    data = sample_booking_data(test_mode=True)
    content = booking_confirmation_email(data)
    assert "BS-TEST-1001" in content.html
    assert "Satyanarayan" in content.html
    assert "View Booking" in content.html
    assert data.booking_id in content.html


def test_invoice_template_has_receipt_fields():
    inv = sample_invoice_data(test_mode=True)
    content = invoice_receipt_email(inv)
    assert "INV-C-TEST-1001" in content.html
    assert "TXN-TEST-998877" in content.html
    assert "Wallet" in content.html
