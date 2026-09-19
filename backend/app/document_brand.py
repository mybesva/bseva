"""Official BSeva document chrome — header, watermark, footer, page numbers.

Web print/HTML uses bseva-export/client/src/lib/bsevaDocument.ts with the same visual rules.
Every PDF and HTML document must go through this module instead of duplicating branding.
"""
from __future__ import annotations

import html
from io import BytesIO
from pathlib import Path
from typing import Any

BRAND_NAME = "BSeva"
MOTTO = "Book, Believe, Bless"
FOOTER_LOCKUP = "BSeva — Book, Believe, Bless"
NAVY_HEX = "#1A2B4A"
ORANGE_HEX = "#FF9933"
NAVY_RGB = (0x1A / 255, 0x2B / 255, 0x4A / 255)
ORANGE_RGB = (1.0, 0x99 / 255, 0x33 / 255)
DEFAULT_LOGO_WEB = "/bseva-logo-transparent.png"
DEFAULT_EMAIL = "support@b-seva.com"
DEFAULT_WEBSITE = "www.b-seva.com"
WATERMARK_OPACITY = 0.07


def _pdf_safe(text: str) -> str:
    """Helvetica cannot encode typographic punctuation used in the HTML chrome."""
    return (
        str(text or "")
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u20b9", "Rs")
    )


def resolve_logo_file(configured: str | None = None) -> Path | None:
    """Resolve the official logo from disk without requiring network access."""
    value = str(configured or "").strip()
    if value.startswith(("http://", "https://")):
        return None
    repo_root = Path(__file__).resolve().parents[2]
    name = Path(value).name if value else "bseva-logo-transparent.png"
    if name in {"bseva-mark.png"}:
        name = "bseva-logo-transparent.png"
    candidates = [
        Path(value).expanduser() if value else Path(),
        repo_root / "bseva-export" / "client" / "public" / name,
        repo_root / "client" / "public" / name,
        repo_root / "bseva-export" / "client" / "public" / "bseva-logo-transparent.png",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def html_logo_src(configured: str | None = None) -> str:
    value = str(configured or DEFAULT_LOGO_WEB).strip() or DEFAULT_LOGO_WEB
    if value.rstrip("/").endswith("bseva-mark.png"):
        return DEFAULT_LOGO_WEB
    if value.startswith(("http://", "https://", "/")):
        return value
    return DEFAULT_LOGO_WEB


def contact_line(company: dict[str, Any] | None = None) -> str:
    company = company or {}
    parts: list[str] = []
    legal = str(company.get("legal_name") or company.get("brand_name") or BRAND_NAME).strip()
    email = str(company.get("email") or DEFAULT_EMAIL).strip()
    phone = str(company.get("phone") or "").strip()
    website = str(company.get("website") or DEFAULT_WEBSITE).strip()
    if legal:
        parts.append(legal)
    if email:
        parts.append(email)
    if phone:
        parts.append(phone)
    if website:
        parts.append(website)
    return "  ·  ".join(parts)


def document_chrome_css() -> str:
    return f"""
@page {{ size: A4; margin: 0; }}
@page {{
  @bottom-right {{
    content: "Page " counter(page) " of " counter(pages);
    font: 9px 'Segoe UI', Helvetica, Arial, sans-serif;
    color: {NAVY_HEX};
  }}
}}
html, body {{
  margin: 0;
  padding: 0;
  background: #fff;
  color: {NAVY_HEX};
  font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
}}
body {{
  padding: 28mm 14mm 20mm 14mm;
}}
.bseva-doc-watermark {{
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}
.bseva-doc-watermark img {{
  width: min(58%, 420px);
  opacity: {WATERMARK_OPACITY};
}}
.bseva-doc-header {{
  position: fixed;
  top: 8mm;
  left: 14mm;
  right: 14mm;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding-bottom: 8px;
  border-bottom: 3px solid {ORANGE_HEX};
  background: #fff;
}}
.bseva-doc-logo {{
  display: block;
  height: 58px;
  width: auto;
  max-width: 200px;
  object-fit: contain;
}}
.bseva-doc-title {{ text-align: right; }}
.bseva-doc-title h1 {{
  margin: 0;
  font-size: 16px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: {NAVY_HEX};
}}
.bseva-doc-ref {{
  margin: 6px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #334155;
}}
.bseva-doc-body {{
  position: relative;
  z-index: 1;
}}
.bseva-doc-footer {{
  position: fixed;
  left: 14mm;
  right: 14mm;
  bottom: 8mm;
  z-index: 2;
  padding-top: 8px;
  border-top: 2px solid {ORANGE_HEX};
  background: #fff;
  font-size: 10px;
  color: {NAVY_HEX};
  display: flex;
  justify-content: space-between;
  gap: 12px;
}}
.bseva-doc-footer p {{ margin: 2px 0 0; color: #334155; }}
@media print {{
  .noprint {{ display: none !important; }}
}}
""".strip()


def wrap_html_document(
    *,
    document_title: str,
    body_html: str,
    page_title: str | None = None,
    reference: str | None = None,
    company: dict[str, Any] | None = None,
    extra_css: str = "",
    logo_src: str | None = None,
) -> str:
    """Wrap document-specific HTML in the official BSeva header, watermark, and footer."""
    company = company or {}
    title = (page_title or document_title or BRAND_NAME).strip()
    src = html.escape(logo_src or html_logo_src(company.get("logo_path")), quote=True)
    doc_title = html.escape(document_title or BRAND_NAME)
    ref = html.escape(str(reference).strip()) if reference else ""
    contacts = html.escape(contact_line(company))
    ref_html = f'<p class="bseva-doc-ref">{ref}</p>' if ref else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>{html.escape(title)}</title>
<style>
{document_chrome_css()}
{extra_css}
</style></head><body>
<div class="bseva-doc-watermark" aria-hidden="true"><img src="{src}" alt=""/></div>
<header class="bseva-doc-header">
  <div>
    <img class="bseva-doc-logo" src="{src}" alt="{html.escape(str(company.get('brand_name') or BRAND_NAME))}"/>
  </div>
  <div class="bseva-doc-title">
    <h1>{doc_title}</h1>
    {ref_html}
  </div>
</header>
<div class="bseva-doc-body">{body_html}</div>
<footer class="bseva-doc-footer">
  <div>
    <strong>{html.escape(FOOTER_LOCKUP)}</strong>
    <p>{contacts}</p>
  </div>
</footer>
</body></html>"""


def _draw_watermark(canv: Any, page_w: float, page_h: float, logo_path: Path | None) -> None:
    if not logo_path:
        return
    from reportlab.lib.units import mm

    width = 110 * mm
    height = 110 * mm
    x = (page_w - width) / 2
    y = (page_h - height) / 2
    canv.saveState()
    try:
        canv.setFillAlpha(WATERMARK_OPACITY)
        canv.setStrokeAlpha(WATERMARK_OPACITY)
    except Exception:
        pass
    try:
        canv.drawImage(
            str(logo_path),
            x,
            y,
            width=width,
            height=height,
            preserveAspectRatio=True,
            mask="auto",
            anchor="c",
        )
    except TypeError:
        canv.drawImage(
            str(logo_path),
            x,
            y,
            width=width,
            height=height,
            preserveAspectRatio=True,
            mask="auto",
        )
    canv.restoreState()


def _draw_header(canv: Any, page_w: float, page_h: float, *, document_title: str, logo_path: Path | None) -> None:
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm

    left = 14 * mm
    right = page_w - 14 * mm
    navy = HexColor(NAVY_HEX)
    orange = HexColor(ORANGE_HEX)
    canv.saveState()
    if logo_path:
        canv.drawImage(
            str(logo_path),
            left,
            page_h - 28 * mm,
            width=42 * mm,
            height=18 * mm,
            preserveAspectRatio=True,
            mask="auto",
        )
    else:
        canv.setFillColor(navy)
        canv.setFont("Helvetica-Bold", 16)
        canv.drawString(left, page_h - 20 * mm, BRAND_NAME)
    canv.setFillColor(navy)
    canv.setFont("Helvetica-Bold", 13)
    title = _pdf_safe((document_title or BRAND_NAME).strip().upper())
    canv.drawRightString(right, page_h - 20 * mm, title)
    canv.setStrokeColor(orange)
    canv.setLineWidth(2.2)
    canv.line(left, page_h - 32 * mm, right, page_h - 32 * mm)
    canv.restoreState()


def _draw_footer_brand(canv: Any, page_w: float, *, company: dict[str, Any] | None) -> None:
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm

    left = 14 * mm
    right = page_w - 14 * mm
    canv.saveState()
    canv.setStrokeColor(HexColor(ORANGE_HEX))
    canv.setLineWidth(1.4)
    canv.line(left, 16 * mm, right, 16 * mm)
    canv.setFillColor(HexColor(NAVY_HEX))
    canv.setFont("Helvetica-Bold", 8)
    canv.drawString(left, 10.5 * mm, _pdf_safe(FOOTER_LOCKUP))
    canv.setFont("Helvetica", 7)
    canv.setFillColor(HexColor("#334155"))
    canv.drawString(left, 6.2 * mm, _pdf_safe(contact_line(company))[:110])
    canv.restoreState()


def _draw_page_xy(canv: Any, page_w: float, page: int, pages: int) -> None:
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm

    canv.saveState()
    canv.setFillColor(HexColor(NAVY_HEX))
    canv.setFont("Helvetica", 8)
    canv.drawRightString(page_w - 14 * mm, 8.2 * mm, f"Page {page} of {pages}")
    canv.restoreState()


def draw_bseva_page_chrome(canv: Any, doc: Any) -> None:
    """Draw watermark + header + footer brand on the current PDF page (behind/around flowables)."""
    page_w, page_h = doc.pagesize
    company = getattr(doc, "bseva_company", {}) or {}
    title = getattr(doc, "bseva_document_title", BRAND_NAME)
    logo_path = resolve_logo_file((company or {}).get("logo_path"))
    _draw_watermark(canv, page_w, page_h, logo_path)
    _draw_header(canv, page_w, page_h, document_title=title, logo_path=logo_path)
    _draw_footer_brand(canv, page_w, company=company)


def _numbered_canvas_class() -> type:
    from reportlab.pdfgen.canvas import Canvas

    class BSevaNumberedCanvas(Canvas):
        """Stamps Page X of Y after the full document is built."""

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            if not kwargs.get("pageCompression"):
                kwargs["pageCompression"] = 0
            super().__init__(*args, **kwargs)
            self._saved_page_states: list[dict[str, Any]] = []

        def showPage(self) -> None:  # noqa: N802 — ReportLab API
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                page_w = self._pagesize[0]
                _draw_page_xy(self, page_w, int(self._pageNumber), pages)
                Canvas.showPage(self)
            Canvas.save(self)

    return BSevaNumberedCanvas


def build_bseva_pdf(
    story: list[Any],
    *,
    document_title: str,
    company: dict[str, Any] | None = None,
    title: str | None = None,
    author: str | None = None,
) -> bytes:
    """Build an A4 PDF whose every page uses the official BSeva chrome."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate

    company = company or {}
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=36 * mm,
        bottomMargin=22 * mm,
        title=title or document_title,
        author=author or str(company.get("legal_name") or BRAND_NAME),
    )
    doc.bseva_document_title = document_title  # type: ignore[attr-defined]
    doc.bseva_company = company  # type: ignore[attr-defined]
    doc.build(
        story,
        onFirstPage=draw_bseva_page_chrome,
        onLaterPages=draw_bseva_page_chrome,
        canvasmaker=_numbered_canvas_class(),
    )
    return buf.getvalue()
