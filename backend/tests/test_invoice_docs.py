from datetime import date

from app.invoice_docs import (
    _allocate_gst,
    _tax_split,
    amount_in_words,
    format_duration_minutes,
    indian_fy,
    pdf_filename,
)


def test_amount_in_words_matches_indian_invoice_style():
    assert amount_in_words(499900) == "Rupees Four Thousand Nine Hundred Ninety-Nine Only"
    assert amount_in_words(0) == "Rupees Zero Only"


def test_duration_uses_human_hours_and_minutes():
    assert format_duration_minutes(120) == "2 Hours"
    assert format_duration_minutes(135) == "2 Hours 15 Minutes"


def test_pdf_filename_sanitizes_invoice_number():
    assert pdf_filename("BSEVA/2026-27/000001") == "BSeva_Invoice_BSEVA_2026-27_000001.pdf"


def test_indian_financial_year():
    assert indian_fy(date(2026, 9, 15)) == "2026-27"
    assert indian_fy(date(2026, 3, 31)) == "2025-26"


def test_tax_split_intra_vs_inter_state():
    intra = _tax_split(1800, 18, "Telangana", "Telangana")
    assert intra["mode"] == "cgst_sgst"
    assert intra["cgst_paise"] + intra["sgst_paise"] == 1800
    inter = _tax_split(1800, 18, "Karnataka", "Telangana")
    assert inter["mode"] == "igst"
    assert inter["igst_paise"] == 1800


def test_allocate_gst_across_lines():
    lines = [
        {"taxable_paise": 10000, "gst_paise": 0, "amount_paise": 10000},
        {"taxable_paise": 10000, "gst_paise": 0, "amount_paise": 10000},
    ]
    _allocate_gst(lines, 3600)
    assert sum(int(x["gst_paise"]) for x in lines) == 3600
    assert lines[0]["amount_paise"] == lines[0]["taxable_paise"] + lines[0]["gst_paise"]


def test_render_invoice_pdf_from_snapshot():
    from app.invoice_pdf import render_invoice_pdf

    pdf = render_invoice_pdf(
        {
            "invoice_number": "BSEVA/2026-27/000001",
            "total_paise": 499900,
            "snapshot": {
                "title": "TAX INVOICE",
                "invoice_date": "2026-09-15",
                "booking_number": "BK-1001",
                "payment_id": "pay_test",
                "payment_date": "2026-09-15T10:00:00",
                "payment_method": "Wallet",
                "payment_status": "PAID",
                "service_name": "Satyanarayana Swamy Puja",
                "package_type": "premium",
                "booking_date": "2026-09-20",
                "start_time": "09:00:00",
                "company": {
                    "brand_name": "BSeva",
                    "legal_name": "BSeva Services Private Limited",
                    "address": "123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India",
                    "email": "support@b-seva.com",
                    "website": "www.b-seva.com",
                    "gstin": "36AAAAA0000A1Z5",
                    "notes": "Thank you for choosing BSeva.",
                    "terms": "Subject to Hyderabad jurisdiction.",
                },
                "bill_to": {
                    "name": "Test Customer",
                    "address": "1, Sample Street",
                    "city": "Hyderabad",
                    "state": "Telangana",
                    "pincode": "500034",
                    "phone": "9000000000",
                    "email": "customer@example.com",
                },
                "lines": [
                    {
                        "description": "Satyanarayana Swamy Puja – Premium Package",
                        "hsn_sac": "999799",
                        "qty": 1,
                        "rate_paise": 423644,
                        "taxable_paise": 423644,
                        "gst_paise": 76256,
                        "amount_paise": 499900,
                    }
                ],
                "subtotal_paise": 423644,
                "discount_paise": 0,
                "taxable_paise": 423644,
                "tax": {"cgst_paise": 38128, "sgst_paise": 38128, "igst_paise": 0, "gst_paise": 76256},
                "total_paise": 499900,
                "amount_in_words": "Rupees Four Thousand Nine Hundred Ninety-Nine Only",
            },
        }
    )
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1000
