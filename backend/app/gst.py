"""GST rules: validation, tax type and line calculation. No database access."""
from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}
# Union territories without a legislature charge UTGST instead of SGST.
UTGST_CODES = {"04", "26", "31", "35", "38"}
LINE_TYPES = ("puja", "surge", "samagri", "alankaram", "food")
CLASSIFICATIONS = ("taxable", "exempt", "nil_rated")
# Rates seen in CBIC schedules; anything else is flagged for review, not silently accepted.
OFFICIAL_RATES = {Decimal(x) for x in ("0", "0.1", "0.25", "1", "1.5", "3", "5", "6", "7.5", "12", "18", "28", "40")}

_GSTIN = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_ALIASES = {
    "orissa": "21", "pondicherry": "34", "uttaranchal": "05", "jammu & kashmir": "01",
    "andaman & nicobar islands": "35", "daman and diu": "26", "dadra and nagar haveli": "26",
    "nct of delhi": "07", "new delhi": "07",
}
_BY_NAME = {name.lower(): code for code, name in STATE_CODES.items()}


def state_code(value: Any) -> str | None:
    """Two-digit GST state code from a state name or code; None when it is not an Indian state."""
    raw = str(value or "").strip()
    if not raw:
        return None
    if raw.isdigit():
        code = raw.zfill(2)
        return code if code in STATE_CODES else None
    key = re.sub(r"\s+", " ", raw.lower())
    return _BY_NAME.get(key) or _ALIASES.get(key)


def valid_gstin(gstin: Any) -> bool:
    value = str(gstin or "").strip().upper()
    if not _GSTIN.match(value) or value[:2] not in STATE_CODES:
        return False
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    total = 0
    for i, ch in enumerate(value[:14]):
        product = chars.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return chars[(36 - total % 36) % 36] == value[14]


def valid_hsn_sac(code: Any) -> bool:
    """HSN is 4, 6 or 8 digits; a service code (SAC) is 6 digits beginning 99."""
    value = str(code or "").strip()
    if not value.isdigit() or len(value) not in (4, 6, 8):
        return False
    return len(value) == 6 if value.startswith("99") else not value.startswith("00")


def tax_type(supplier_code: str | None, pos_code: str | None) -> str | None:
    if not supplier_code or not pos_code:
        return None
    return "intra" if supplier_code == pos_code else "inter"


def _round_paise(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _spread(total: int, weights: list[int]) -> list[int]:
    """Split total across weights in proportion; the shares always add up to total."""
    whole = sum(weights)
    if total <= 0 or whole <= 0:
        return [0] * len(weights)
    shares = [total * w // whole for w in weights]
    order = sorted(range(len(weights)), key=lambda i: -(total * weights[i] % whole))
    for i in order[: total - sum(shares)]:
        shares[i] += 1
    return shares


def calculate_lines(lines: list[dict[str, Any]], discount_paise: int = 0) -> dict[str, Any]:
    """Tax for each line after spreading the discount. Does not depend on place of supply,
    so the amount a customer pays never changes once the place of supply is known."""
    amounts = [max(0, int(line["amount_paise"])) for line in lines]
    discount = min(max(0, int(discount_paise or 0)), sum(amounts))
    shares = _spread(discount, amounts)
    out = []
    for line, amount, share in zip(lines, amounts, shares):
        taxable = amount - share
        rate = Decimal(str(line.get("gst_rate") or 0))
        charged = line.get("classification") == "taxable"
        tax = _round_paise(Decimal(taxable) * rate / 100) if charged else 0
        out.append(
            {
                **line,
                "gst_rate": float(rate) if charged else 0.0,
                "amount_paise": amount,
                "discount_paise": share,
                "taxable_paise": taxable,
                "tax_paise": tax,
            }
        )
    return {
        "lines": out,
        "taxable_paise": sum(x["taxable_paise"] for x in out),
        "tax_paise": sum(x["tax_paise"] for x in out),
    }


def split_tax(calc: dict[str, Any], supplier_code: str | None, pos_code: str | None) -> dict[str, Any]:
    """CGST + SGST/UTGST for intra-State, IGST for inter-State. Never both for the same supply."""
    kind = tax_type(supplier_code, pos_code)
    lines = []
    for line in calc["lines"]:
        tax = int(line["tax_paise"])
        half = tax // 2
        cgst = tax - half if kind == "intra" else 0
        sgst = half if kind == "intra" else 0
        igst = tax if kind == "inter" else 0
        lines.append({**line, "cgst_paise": cgst, "sgst_paise": sgst, "igst_paise": igst})
    mode = {"intra": "cgst_sgst", "inter": "igst"}.get(kind or "", "unassigned")
    total = int(calc["tax_paise"])
    if total <= 0:
        mode = "none"
    return {
        "lines": lines,
        "mode": mode,
        "sgst_label": "UTGST" if pos_code in UTGST_CODES else "SGST",
        "taxable_paise": int(calc["taxable_paise"]),
        "gst_paise": total,
        "cgst_paise": sum(x["cgst_paise"] for x in lines),
        "sgst_paise": sum(x["sgst_paise"] for x in lines),
        "igst_paise": sum(x["igst_paise"] for x in lines),
    }
