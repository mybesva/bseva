"""Official BSeva document chrome — header, watermark, footer, page numbers.

Web print/HTML uses bseva-export/client/src/lib/bsevaDocument.ts with the same visual rules.
Every PDF and HTML document must go through this module instead of duplicating branding.
"""
from __future__ import annotations

import base64
import html
import mimetypes
from io import BytesIO
from pathlib import Path
from typing import Any

BRAND_NAME = "BSeva"
MOTTO = "Book, Believe, Bless"
FOOTER_LOCKUP = "BSeva — Book, Believe, Bless"
NAVY_HEX = "#1A2B4A"
ORANGE_HEX = "#FF7A00"
NAVY_RGB = (0x1A / 255, 0x2B / 255, 0x4A / 255)
ORANGE_RGB = (1.0, 0x7A / 255, 0x00 / 255)
DEFAULT_LOGO_WEB = "/bseva-logo-transparent.png"
DEFAULT_EMAIL = "support@b-seva.com"
DEFAULT_WEBSITE = "www.b-seva.com"
WATERMARK_OPACITY = 0.07
DOC_PAGE_WIDTH_MM = 210


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
    app_dir = Path(__file__).resolve().parent
    repo_root = app_dir.parents[1]
    name = Path(value).name if value else "bseva-logo-transparent.png"
    if name in {"bseva-mark.png"}:
        name = "bseva-logo-transparent.png"
    candidates = [
        app_dir / "static" / name,
        app_dir / "static" / "bseva-logo-transparent.png",
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


def embedded_logo_data_uri(configured: str | None = None) -> str | None:
    """Inline logo for HTML/PDF so mobile WebViews and email clients do not need auth or static hosting."""
    path = resolve_logo_file(configured)
    if not path or not path.is_file():
        return None
    mime = mimetypes.guess_type(str(path))[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def resolve_document_logo_src(company: dict[str, Any] | None = None) -> str:
    company = company or {}
    embedded = embedded_logo_data_uri(company.get("logo_path"))
    if embedded:
        return embedded
    return html_logo_src(company.get("logo_path"))


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


def _mobile_screen_rules(prefix: str = "") -> str:
    """Shared mobile invoice layout rules. Prefix with html.bseva-doc-mobile for RN WebView."""
    p = prefix
    navy = NAVY_HEX
    return f"""
  {p}.bseva-doc-page {{
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    padding: 16px !important;
    box-shadow: none !important;
    margin: 0 !important;
  }}
  {p}.bseva-doc-viewport {{ padding: 0 !important; }}
  {p}.bseva-doc-watermark {{ opacity: .35; }}
  {p}.bseva-doc-watermark img {{ width: min(72%, 240px); opacity: .04; }}
  {p}.bseva-doc-header-block {{
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }}
  {p}.bseva-doc-header-right {{
    text-align: left;
    min-width: 0;
    max-width: none;
  }}
  {p}.bseva-doc-doc-title {{ font-size: 20px; letter-spacing: .1em; }}
  {p}.bseva-doc-meta {{ font-size: 13px; line-height: 1.6; }}
  {p}.bseva-doc-company {{ font-size: 12px; }}
  {p}.bseva-doc-brand-name {{ font-size: 20px; }}
  {p}.bseva-doc-motto {{ font-size: 10px; }}
  {p}.bseva-doc-logo {{ height: 44px; }}
  {p}.bseva-doc-grid {{ grid-template-columns: 1fr; gap: 12px; margin: 16px 0; }}
  {p}.bseva-doc-box {{ padding: 12px 14px; }}
  {p}.bseva-doc-box h3 {{ font-size: 11px; margin-bottom: 10px; }}
  {p}.bseva-doc-box p {{ font-size: 13px; line-height: 1.6; }}
  {p}.bseva-doc-table-wrap {{ display: none !important; }}
  {p}.bseva-doc-items-mobile {{ display: block !important; }}
  {p}.bseva-doc-item-card {{
    border: 1px solid #d7dde8;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 10px;
    background: #fff;
  }}
  {p}.bseva-doc-item-title {{
    font-size: 14px;
    font-weight: 600;
    color: {navy};
    line-height: 1.45;
    margin-bottom: 6px;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }}
  {p}.bseva-doc-item-meta {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 10px;
  }}
  {p}.bseva-doc-item-amounts {{ border-top: 1px solid #e2e8f0; padding-top: 8px; }}
  {p}.bseva-doc-item-row {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-size: 13px;
    padding: 3px 0;
  }}
  {p}.bseva-doc-item-row .lbl {{ color: #64748b; }}
  {p}.bseva-doc-item-row .val {{ font-weight: 600; color: {navy}; white-space: nowrap; }}
  {p}.bseva-doc-item-row.bseva-doc-item-amt .val {{ font-size: 14px; }}
  {p}.bseva-doc-totals-wrap {{ justify-content: stretch; margin-top: 12px; }}
  {p}.bseva-doc-totals {{ width: 100%; max-width: none; }}
  {p}.bseva-doc-totals td {{ font-size: 13px; padding: 5px 0; }}
  {p}.bseva-doc-totals .grand td {{ font-size: 16px; padding-top: 10px; }}
  {p}.bseva-doc-words {{ font-size: 12px; line-height: 1.55; margin-top: 14px; }}
  {p}.bseva-doc-paid {{ font-size: 12px; margin-top: 12px; padding: 5px 16px; }}
  {p}.bseva-doc-payment {{ font-size: 13px; padding: 12px 14px; margin: 16px 0; }}
  {p}.bseva-doc-payment h3 {{ font-size: 11px; margin-bottom: 8px; }}
  {p}.bseva-doc-notes {{ font-size: 11px; margin-top: 16px; }}
  {p}.bseva-doc-footer-block {{ font-size: 11px; margin-top: 18px; }}
  {p}.bseva-doc-toolbar {{ max-width: none; padding: 8px 12px 0; }}
""".strip()


def document_responsive_css() -> str:
    """Screen layouts for mobile WebView and narrow browsers. Print/PDF keep A4 table."""
    media_rules = _mobile_screen_rules("")
    webview_rules = _mobile_screen_rules("html.bseva-doc-mobile ")
    return f"""
.bseva-doc-items-mobile {{ display: none; }}
@media screen and (max-width: 767px) {{
{media_rules}
}}
@media screen and (min-width: 768px) and (max-width: 1023px) {{
  .bseva-doc-page {{
    width: auto !important;
    min-width: 0 !important;
    max-width: 720px !important;
    padding: 18px 20px !important;
  }}
}}
@media screen {{
{webview_rules}
}}
""".strip()


def document_body_css() -> str:
    return f"""
.bseva-doc-page {{
  width: {DOC_PAGE_WIDTH_MM}mm;
  min-width: {DOC_PAGE_WIDTH_MM}mm;
  max-width: {DOC_PAGE_WIDTH_MM}mm;
  margin: 0 auto;
  padding: 20px 24px;
  background: #fff;
  box-sizing: border-box;
}}
@media screen {{
  .bseva-doc-page {{
    box-shadow: 0 2px 16px rgba(26, 43, 74, .08);
  }}
}}
.bseva-doc-header-block {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 12px;
  border-bottom: 3px solid {ORANGE_HEX};
  margin-bottom: 16px;
}}
.bseva-doc-header-left {{ flex: 1 1 58%; min-width: 0; }}
.bseva-doc-header-right {{ flex: 0 0 auto; text-align: right; min-width: 170px; max-width: 42%; }}
.bseva-doc-brand-row {{ display: flex; align-items: flex-start; gap: 10px; }}
.bseva-doc-logo {{
  display: block;
  height: 50px;
  width: auto;
  max-width: 150px;
  object-fit: contain;
  flex-shrink: 0;
}}
.bseva-doc-brand-text {{ min-width: 0; }}
.bseva-doc-brand-name {{
  font-size: 18px;
  font-weight: 700;
  color: {NAVY_HEX};
  letter-spacing: .05em;
  line-height: 1.2;
}}
.bseva-doc-motto {{
  font-size: 9px;
  color: {ORANGE_HEX};
  letter-spacing: .08em;
  margin-top: 2px;
  text-transform: uppercase;
}}
.bseva-doc-company {{
  margin-top: 8px;
  font-size: 9.5px;
  line-height: 1.55;
  color: #334155;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}}
.bseva-doc-doc-title {{
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: {NAVY_HEX};
}}
.bseva-doc-meta {{
  margin-top: 8px;
  font-size: 9.5px;
  line-height: 1.65;
  color: #334155;
}}
.bseva-doc-meta div {{ margin: 1px 0; }}
.bseva-doc-meta strong {{ color: {NAVY_HEX}; font-weight: 600; }}
.bseva-doc-grid {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 14px 0;
}}
.bseva-doc-box {{
  border: 1px solid #d7dde8;
  border-radius: 4px;
  padding: 10px 12px;
  min-width: 0;
  background: #f8fafc;
}}
.bseva-doc-box h3 {{
  margin: 0 0 8px;
  font-size: 9.5px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: {ORANGE_HEX};
  font-weight: 700;
}}
.bseva-doc-box p {{
  margin: 0;
  font-size: 9.5px;
  line-height: 1.55;
  color: #334155;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}}
.bseva-doc-table {{
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  table-layout: fixed;
}}
.bseva-doc-table th, .bseva-doc-table td {{
  border: 1px solid #d7dde8;
  padding: 6px 7px;
  font-size: 9.5px;
  text-align: left;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}}
.bseva-doc-table th {{
  background: {NAVY_HEX};
  color: #fff;
  font-weight: 600;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}
.bseva-doc-table tbody tr:nth-child(even) {{ background: #f8fafc; }}
.bseva-doc-table-wrap {{ margin: 14px 0; }}
.bseva-doc-table .num {{ text-align: center; width: 6%; }}
.bseva-doc-table .desc {{ width: 38%; }}
.bseva-doc-table .code {{ width: 12%; }}
.bseva-doc-table .qty {{ text-align: center; width: 8%; }}
.bseva-doc-table .r {{ text-align: right; white-space: nowrap; width: 18%; }}
.bseva-doc-totals-wrap {{ display: flex; justify-content: flex-end; margin-top: 6px; }}
.bseva-doc-totals {{ width: min(100%, 260px); }}
.bseva-doc-totals table {{ width: 100%; border-collapse: collapse; }}
.bseva-doc-totals td {{
  padding: 4px 0;
  font-size: 9.5px;
  border: none;
  vertical-align: top;
}}
.bseva-doc-totals .label {{ text-align: right; padding-right: 12px; color: #64748b; }}
.bseva-doc-totals .value {{ text-align: right; font-weight: 500; white-space: nowrap; color: {NAVY_HEX}; }}
.bseva-doc-totals .grand td {{
  font-size: 12px;
  font-weight: 700;
  color: {NAVY_HEX};
  border-top: 2px solid {ORANGE_HEX};
  padding-top: 8px;
}}
.bseva-doc-words {{
  margin-top: 10px;
  font-size: 9.5px;
  line-height: 1.5;
  color: #334155;
}}
.bseva-doc-paid {{
  display: inline-block;
  margin-top: 8px;
  padding: 4px 14px;
  border: 2px solid #16a34a;
  background: #f0fdf4;
  color: #16a34a;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: .1em;
  border-radius: 4px;
}}
.bseva-doc-payment {{
  margin: 14px 0;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  font-size: 9.5px;
  line-height: 1.6;
  color: #334155;
}}
.bseva-doc-payment h3 {{
  margin: 0 0 6px;
  font-size: 9.5px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: {ORANGE_HEX};
}}
.bseva-doc-section {{ margin: 14px 0; }}
.bseva-doc-section h3 {{
  margin: 0 0 6px;
  font-size: 9.5px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: {ORANGE_HEX};
  font-weight: 700;
}}
.bseva-doc-list {{
  margin: 0;
  padding-left: 16px;
  font-size: 9.5px;
  line-height: 1.55;
  color: #334155;
}}
.bseva-doc-notes {{
  margin-top: 16px;
  font-size: 9.5px;
  color: #64748b;
  line-height: 1.55;
}}
.bseva-doc-notes p {{ margin: 4px 0; }}
.bseva-doc-footer-block {{
  margin-top: 20px;
  padding-top: 10px;
  border-top: 2px solid {ORANGE_HEX};
  font-size: 8.5px;
  color: #64748b;
  line-height: 1.55;
}}
.bseva-doc-footer-block strong {{ color: {NAVY_HEX}; font-size: 9px; }}
.bseva-doc-footer-block p {{ margin: 3px 0; }}
.bseva-doc-toolbar {{
  max-width: {DOC_PAGE_WIDTH_MM}mm;
  margin: 0 auto 10px;
  padding: 0 4px;
}}
.bseva-doc-toolbar button {{
  background: {NAVY_HEX};
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}}
.bseva-doc-toolbar button:hover {{ opacity: .92; }}
.noprint {{ }}
@media print {{
  .noprint, .bseva-doc-toolbar, .bseva-doc-screen-only, .bseva-doc-items-mobile {{
    display: none !important;
  }}
  html, body {{ background: #fff !important; }}
  .bseva-doc-viewport {{ padding: 0 !important; background: #fff !important; overflow: visible !important; }}
  .bseva-doc-watermark {{ position: fixed; }}
  .bseva-doc-page {{
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }}
  .bseva-doc-table-wrap {{ display: block !important; }}
  .bseva-doc-table thead {{ display: table-header-group; }}
  .bseva-doc-table tr, .bseva-doc-box, .bseva-doc-payment, .bseva-doc-totals-wrap {{
    page-break-inside: avoid;
  }}
  .bseva-doc-header-block, .bseva-doc-grid, .bseva-doc-words {{
    page-break-inside: avoid;
  }}
}}
""".strip()


def document_chrome_css() -> str:
    return f"""
@page {{ size: A4; margin: 14mm; }}
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
  background: #eef2f7;
  color: {NAVY_HEX};
  font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
}}
.bseva-doc-viewport {{
  min-height: 100vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
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
.bseva-doc-body {{
  position: relative;
  z-index: 1;
}}
{document_body_css()}
{document_responsive_css()}
""".strip()


def render_meta_rows_html(rows: list[tuple[str, str]]) -> str:
    parts: list[str] = []
    for label, value in rows:
        val = str(value or "").strip()
        if not val:
            continue
        parts.append(f"<div><strong>{html.escape(label)}:</strong> {html.escape(val)}</div>")
    return "".join(parts)


def render_company_header_left(company: dict[str, Any] | None, logo_src: str) -> str:
    company = company or {}
    brand = html.escape(str(company.get("brand_name") or BRAND_NAME))
    legal = html.escape(str(company.get("legal_name") or company.get("name") or ""))
    address = html.escape(str(company.get("address") or ""))
    state = html.escape(str(company.get("state") or ""))
    pin = html.escape(str(company.get("pincode") or ""))
    email = html.escape(str(company.get("email") or DEFAULT_EMAIL))
    phone = html.escape(str(company.get("phone") or ""))
    website = html.escape(str(company.get("website") or DEFAULT_WEBSITE))
    gstin = html.escape(str(company.get("gstin") or ""))
    location = ", ".join(x for x in [state, pin] if x)
    lines = [f"<strong>{legal}</strong>"] if legal else []
    if address:
        lines.append(address)
    if location:
        lines.append(location)
    lines.append(f"Email: {email}")
    if phone:
        lines.append(f"Phone: {phone}")
    if website:
        lines.append(f"Website: {website}")
    if gstin:
        lines.append(f"GSTIN: {gstin}")
    company_html = "<br/>".join(lines)
    src = html.escape(logo_src, quote=True)
    return f"""
<div class="bseva-doc-header-left">
  <div class="bseva-doc-brand-row">
    <img class="bseva-doc-logo" src="{src}" alt="{brand}"/>
    <div class="bseva-doc-brand-text">
      <div class="bseva-doc-brand-name">B-SEVA</div>
      <div class="bseva-doc-motto">{html.escape(MOTTO)}</div>
    </div>
  </div>
  <div class="bseva-doc-company">{company_html}</div>
</div>""".strip()


def render_document_meta_right(document_title: str, meta_rows: list[tuple[str, str]]) -> str:
    meta = render_meta_rows_html(meta_rows)
    return f"""
<div class="bseva-doc-header-right">
  <h1 class="bseva-doc-doc-title">{html.escape(document_title)}</h1>
  <div class="bseva-doc-meta">{meta}</div>
</div>""".strip()


def render_document_header(
    *,
    company: dict[str, Any] | None,
    document_title: str,
    meta_rows: list[tuple[str, str]],
    logo_src: str | None = None,
) -> str:
    src = logo_src or resolve_document_logo_src(company)
    left = render_company_header_left(company, src)
    right = render_document_meta_right(document_title, meta_rows)
    return f'<div class="bseva-doc-header-block">{left}{right}</div>'


def render_info_box(title: str, body_html: str) -> str:
    return f"""
<div class="bseva-doc-box">
  <h3>{html.escape(title)}</h3>
  <p>{body_html}</p>
</div>""".strip()


def render_document_footer(company: dict[str, Any] | None, *, disclaimer: str | None = None) -> str:
    company = company or {}
    legal = html.escape(str(company.get("legal_name") or company.get("name") or BRAND_NAME))
    address = html.escape(str(company.get("address") or ""))
    email = html.escape(str(company.get("email") or DEFAULT_EMAIL))
    website = html.escape(str(company.get("website") or DEFAULT_WEBSITE))
    disc = html.escape(
        disclaimer or "This is a computer-generated document and does not require a physical signature."
    )
    return f"""
<div class="bseva-doc-footer-block">
  <strong>{html.escape(FOOTER_LOCKUP)}</strong>
  <p>{legal}<br/>{address}<br/>{email} · {website}</p>
  <p><em>{disc}</em></p>
</div>""".strip()


def wrap_html_document(
    *,
    document_title: str,
    body_html: str,
    page_title: str | None = None,
    reference: str | None = None,
    company: dict[str, Any] | None = None,
    extra_css: str = "",
    logo_src: str | None = None,
    toolbar_html: str = "",
) -> str:
    """Wrap document-specific HTML in the official BSeva viewer shell."""
    company = company or {}
    title = (page_title or document_title or BRAND_NAME).strip()
    src = html.escape(logo_src or resolve_document_logo_src(company), quote=True)
    toolbar = toolbar_html or ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>{html.escape(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
{document_chrome_css()}
{extra_css}
</style></head><body>
<div class="bseva-doc-watermark" aria-hidden="true"><img src="{src}" alt=""/></div>
<div class="bseva-doc-viewport">
  {toolbar}
  <div class="bseva-doc-page">
    <div class="bseva-doc-body">{body_html}</div>
  </div>
</div>
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
    """Draw watermark + footer brand on the current PDF page (behind/around flowables)."""
    page_w, page_h = doc.pagesize
    company = getattr(doc, "bseva_company", {}) or {}
    logo_path = resolve_logo_file((company or {}).get("logo_path"))
    _draw_watermark(canv, page_w, page_h, logo_path)
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
        topMargin=14 * mm,
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
