"""Shared BSeva HTML email shell — orange/blue brand, Gmail-compatible tables."""
from __future__ import annotations

import html
from typing import Any

from app.mail.smtp_config import app_base_url, support_email, support_phone_display

# Brand (matches app: saffron primary + deep blue)
PRIMARY = "#FF9933"
NAVY = "#1A2B4A"
BG = "#F5F7FA"
TEXT = "#1A2B4A"
MUTED = "#5A6577"
BORDER = "#E2E8F0"
WHITE = "#FFFFFF"


def _esc(v: Any) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def logo_url() -> str:
    return f"{app_base_url()}/bseva-mark.png"


def booking_url(booking_id: str) -> str:
    return f"{app_base_url()}/booking/{booking_id}"


def format_inr_paise(paise: int | None) -> str:
    v = (paise or 0) / 100.0
    return f"₹{v:,.2f}"


def render_email(
    *,
    title: str,
    preheader: str = "",
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    language: str = "en",
    test_banner: bool = False,
) -> str:
    """Wrap content in responsive table layout for Gmail/Outlook."""
    lang = (language or "en").lower()
    footer_note = {
        "hi": "यह ईमेल BSeva से भेजा गया है। कृपया इस ईमेल का उत्तर न दें।",
        "te": "ఈ ఇమెయిల్ BSeva నుండి పంపబడింది. దయచేసి ఈ ఇమెయిల్‌కు ప్రత్యుత్తరం ఇవ్వవద్దు.",
    }.get(lang, "This email was sent by BSeva. Please do not reply to this message.")
    support_label = {"hi": "सहायता", "te": "సహాయం"}.get(lang, "Support")
    banner = ""
    if test_banner:
        banner = f"""
        <tr>
          <td style="background:#B45309;color:{WHITE};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;text-align:center;padding:10px 16px;">
            TEST EMAIL — Not a real booking or payment
          </td>
        </tr>"""

    cta = ""
    if cta_label and cta_url:
        cta = f"""
        <tr>
          <td style="padding:8px 28px 28px;text-align:center;">
            <a href="{_esc(cta_url)}"
               style="display:inline-block;background:{PRIMARY};color:{WHITE};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:8px;">
              {_esc(cta_label)}
            </a>
          </td>
        </tr>"""

    pre = _esc(preheader) if preheader else ""
    return f"""<!DOCTYPE html>
<html lang="{_esc(lang)}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>{_esc(title)}</title>
  <!--[if mso]><style>body,table,td{{font-family:Arial,sans-serif !important;}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:{BG};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{pre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:{WHITE};border-radius:12px;overflow:hidden;border:1px solid {BORDER};">
          {banner}
          <tr>
            <td style="background:{NAVY};padding:20px 28px;text-align:center;">
              <img src="{_esc(logo_url())}" alt="BSeva" width="72" height="72" style="display:inline-block;border:0;outline:none;text-decoration:none;height:72px;width:auto;max-width:120px;"/>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:{PRIMARY};margin-top:8px;letter-spacing:0.5px;">BSeva</div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:{PRIMARY};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:{TEXT};font-size:15px;line-height:1.55;">
              {body_html}
            </td>
          </tr>
          {cta}
          <tr>
            <td style="background:{NAVY};padding:20px 28px;font-family:Arial,Helvetica,sans-serif;color:#CBD5E1;font-size:12px;line-height:1.6;text-align:center;">
              <strong style="color:{PRIMARY};">{_esc(support_label)}</strong><br/>
              {_esc(support_email())} · {_esc(support_phone_display())}<br/>
              <span style="color:#94A3B8;">{_esc(footer_note)}</span><br/>
              <a href="{_esc(app_base_url())}" style="color:{PRIMARY};text-decoration:none;">{_esc(app_base_url())}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def detail_rows(rows: list[tuple[str, str]]) -> str:
    parts = [
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:16px 0;border:1px solid {BORDER};border-radius:8px;overflow:hidden;">'
    ]
    for i, (label, value) in enumerate(rows):
        bg = "#FAFBFC" if i % 2 == 0 else WHITE
        parts.append(
            f'<tr style="background:{bg};">'
            f'<td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MUTED};width:42%;">{_esc(label)}</td>'
            f'<td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{TEXT};font-weight:600;">{_esc(value)}</td>'
            f"</tr>"
        )
    parts.append("</table>")
    return "".join(parts)


def heading(text: str) -> str:
    return (
        f'<h1 style="margin:0 0 12px;font-family:Georgia,\'Times New Roman\',serif;'
        f'font-size:22px;line-height:1.3;color:{NAVY};">{_esc(text)}</h1>'
    )


def paragraph(text: str) -> str:
    return f'<p style="margin:0 0 12px;color:{TEXT};">{_esc(text)}</p>'


def muted(text: str) -> str:
    return f'<p style="margin:0 0 12px;color:{MUTED};font-size:13px;">{_esc(text)}</p>'


def otp_box(code: str) -> str:
    return (
        f'<div style="margin:20px 0;text-align:center;background:#FFF7ED;border:2px dashed {PRIMARY};'
        f'border-radius:10px;padding:20px 12px;">'
        f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;color:{MUTED};text-transform:uppercase;">Your OTP</div>'
        f'<div style="font-family:Consolas,Monaco,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:{NAVY};margin-top:8px;">{_esc(code)}</div>'
        f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MUTED};margin-top:8px;">Valid for: 10 minutes</div>'
        f"</div>"
    )
