"""Convert official BSeva HTML documents to PDF (same engine/CSS as View / Print)."""
from __future__ import annotations

import logging
import re

logger = logging.getLogger("bseva.html_pdf")


def _prepare_html_for_print_pdf(html: str) -> str:
    """Remove screen-only chrome; keep markup and styles identical to View / Print."""
    return re.sub(
        r'<div class="noprint bseva-doc-toolbar">.*?</div>\s*',
        "",
        html,
        count=1,
        flags=re.S,
    )


def _pdf_via_playwright(html: str) -> bytes:
    """Headless Chromium print — matches browser Print / Save PDF."""
    from playwright.sync_api import sync_playwright

    prepared = _prepare_html_for_print_pdf(html)
    last_error: Exception | None = None
    with sync_playwright() as p:
        browser = None
        for launch_kwargs in (
            {"channel": "chrome", "headless": True},
            {"channel": "msedge", "headless": True},
            {"headless": True},
        ):
            try:
                browser = p.chromium.launch(**launch_kwargs)
                break
            except Exception as exc:
                last_error = exc
                continue
        if browser is None:
            raise RuntimeError(
                "Chromium is not available for invoice PDF export. "
                "Install with: pip install playwright && playwright install chromium"
            ) from last_error

        try:
            page = browser.new_page()
            page.set_content(prepared, wait_until="load")
            page.emulate_media(media="print")
            pdf = page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            if not pdf or not pdf.startswith(b"%PDF"):
                raise RuntimeError("Chromium did not produce a valid PDF")
            return pdf
        finally:
            browser.close()


def _pdf_via_weasyprint(html: str) -> bytes | None:
    try:
        from weasyprint import HTML
    except Exception:
        return None
    try:
        prepared = _prepare_html_for_print_pdf(html)
        return HTML(string=prepared).write_pdf()
    except Exception as exc:
        logger.info("WeasyPrint PDF export failed: %s", exc)
        return None


def html_document_to_pdf(html: str) -> bytes:
    """
    Render the official HTML document to PDF.

    Order: Chromium (Playwright) → WeasyPrint (if system libs present).
    Does not use xhtml2pdf/jsPDF-style layout engines (they break flex/watermarks).
    """
    errors: list[str] = []
    try:
        return _pdf_via_playwright(html)
    except Exception as exc:
        errors.append(f"playwright: {exc}")
        logger.warning("Playwright PDF export failed: %s", exc)

    weasy = _pdf_via_weasyprint(html)
    if weasy:
        return weasy
    errors.append("weasyprint: unavailable or failed")

    raise RuntimeError(
        "Could not render invoice PDF. "
        + "; ".join(errors)
        + ". Use View / Print and Save as PDF, or install Playwright (playwright install chromium)."
    )
