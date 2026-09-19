from app.document_brand import (
    FOOTER_LOCKUP,
    MOTTO,
    build_bseva_pdf,
    wrap_html_document,
)
from app.invoice_docs import render_invoice_html
from app.invoice_pdf import render_invoice_pdf


def test_html_document_wrap_includes_official_chrome():
    html = wrap_html_document(
        document_title="Samagri List",
        body_html="<p>Turmeric 100g</p>",
        reference="BK-9",
        company={"legal_name": "BSeva Services Private Limited", "email": "support@b-seva.com"},
    )
    assert 'class="bseva-doc-watermark"' in html
    assert 'class="bseva-doc-header"' in html
    assert 'class="bseva-doc-footer"' in html
    assert 'bseva-doc-motto' not in html
    assert FOOTER_LOCKUP in html
    assert "SAMAGRI LIST" in html.upper()
    assert "Turmeric 100g" in html
    assert "Page " in html and "counter(pages)" in html


def test_invoice_html_uses_shared_document_template():
    class _NoDb:
        def execute(self, *_args, **_kwargs):
            raise RuntimeError("not available in unit test")

    html = render_invoice_html(
        _NoDb(),
        {
            "invoice_number": "BSEVA/2030-31/1",
            "invoice_type": "customer",
            "total_paise": 10000,
            "snapshot": {
                "company": {"brand_name": "BSeva", "legal_name": "BSeva"},
                "service_name": "Test Puja",
                "duration_minutes": 135,
                "bill_to": {},
                "lines": [],
                "tax": {},
            },
        },
    )
    assert 'class="bseva-doc-watermark"' in html
    assert MOTTO in html
    assert FOOTER_LOCKUP in html
    assert "TAX INVOICE" in html.upper()
    assert 'bseva-doc-motto' not in html
    assert "Puja Duration:</strong> 2 Hours 15 Minutes" in html
    assert "BSEVA/2030-31/1" in html


def test_pdf_chrome_repeats_motto_and_page_numbers():
    from reportlab.platypus import PageBreak, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet

    styles = getSampleStyleSheet()
    pdf = build_bseva_pdf(
        [Paragraph("Page one content", styles["Normal"]), PageBreak(), Paragraph("Page two content", styles["Normal"])],
        document_title="Booking Confirmation",
        company={"legal_name": "BSeva Services Private Limited", "email": "support@b-seva.com"},
    )
    raw = pdf.decode("latin-1", "replace")
    assert pdf.startswith(b"%PDF")
    assert "Book, Believe, Bless" in raw
    assert "BSeva - Book, Believe, Bless" in raw
    assert "Page 1 of 2" in raw
    assert "Page 2 of 2" in raw
    assert "BOOKING CONFIRMATION" in raw


def test_render_invoice_pdf_from_snapshot_keeps_content_and_branding():
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
    raw = pdf.decode("latin-1", "replace")
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1000
    assert "Book, Believe, Bless" in raw
    assert "TAX INVOICE" in raw
    assert "BSEVA/2026-27/000001" in raw
    assert "Page 1 of 1" in raw
