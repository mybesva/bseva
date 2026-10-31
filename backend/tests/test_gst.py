"""GST rules: tax type, rounding, validation and exclusivity of IGST and CGST/SGST."""
import pytest

from app import gst
from app.tax_config import invoice_tax

TELANGANA = "36"


def gstin_for(state: str) -> str:
    body = f"{state}AAAAA0000A1Z"
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    total = 0
    for i, ch in enumerate(body):
        product = chars.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return body + chars[(36 - total % 36) % 36]


def line(amount=100000, rate=18, kind="taxable", code="999591", name="Puja"):
    return {
        "line_type": "puja", "description": name, "amount_paise": amount, "gst_rate": rate,
        "classification": kind, "hsn_sac": code, "configured": True,
    }


def snapshot(lines, pos="36", source="puja_location", discount=0):
    calc = gst.calculate_lines(lines, discount)
    return {**calc, "place_of_supply": {"code": pos, "state": gst.STATE_CODES.get(pos or ""), "source": source}}


COMPANY = {"gstin": gstin_for(TELANGANA), "state": "Telangana"}


@pytest.mark.parametrize("pos", ["29", "27"])
def test_inter_state_is_igst_only(pos):
    tax = invoice_tax(snapshot([line()], pos), COMPANY, "")
    assert (tax["mode"], tax["igst_paise"], tax["cgst_paise"], tax["sgst_paise"]) == ("igst", 18000, 0, 0)


def test_intra_state_is_cgst_and_sgst_only():
    tax = invoice_tax(snapshot([line()]), COMPANY, "")
    assert (tax["mode"], tax["cgst_paise"], tax["sgst_paise"], tax["igst_paise"]) == ("cgst_sgst", 9000, 9000, 0)
    assert tax["flags"] == []


def test_union_territory_uses_utgst():
    calc = snapshot([line()], "04")
    tax = gst.split_tax(calc, "04", "04")
    assert tax["sgst_label"] == "UTGST"
    assert gst.split_tax(calc, "07", "07")["sgst_label"] == "SGST"


@pytest.mark.parametrize("supplier, pos", [("36", "36"), ("36", "29"), ("29", "36"), ("36", None), (None, "36")])
def test_igst_and_cgst_never_appear_together(supplier, pos):
    tax = gst.split_tax(gst.calculate_lines([line(100001), line(33333, 5)]), supplier, pos)
    assert not (tax["igst_paise"] and (tax["cgst_paise"] or tax["sgst_paise"]))
    for row in tax["lines"]:
        assert not (row["igst_paise"] and (row["cgst_paise"] or row["sgst_paise"]))


def test_tax_total_is_the_same_whatever_the_place_of_supply():
    calc = gst.calculate_lines([line(100001), line(33333, 5)])
    intra = gst.split_tax(calc, "36", "36")
    inter = gst.split_tax(calc, "36", "29")
    assert intra["cgst_paise"] + intra["sgst_paise"] == inter["igst_paise"] == calc["tax_paise"]


def test_rate_is_not_hard_coded():
    assert gst.calculate_lines([line(rate=5)])["tax_paise"] == 5000
    assert gst.calculate_lines([line(rate=40)])["tax_paise"] == 40000


def test_decimal_half_up_rounding():
    assert gst.calculate_lines([line(50, 5)])["tax_paise"] == 3  # 2.5 paise rounds up, not to even


def test_mixed_rates_and_exempt_lines():
    calc = gst.calculate_lines([line(100000, 18), line(100000, 5), line(100000, 0, "exempt"), line(100000, 0, "nil_rated")])
    assert [x["tax_paise"] for x in calc["lines"]] == [18000, 5000, 0, 0]
    assert calc["tax_paise"] == 23000


def test_exempt_line_ignores_any_rate_left_on_it():
    assert gst.calculate_lines([line(100000, 18, "exempt")])["tax_paise"] == 0


def test_discount_reduces_taxable_and_adds_up_exactly():
    calc = gst.calculate_lines([line(100000), line(33333)], 10001)
    assert sum(x["discount_paise"] for x in calc["lines"]) == 10001
    assert calc["taxable_paise"] == 123332


def test_all_exempt_invoice_has_no_tax_components():
    tax = invoice_tax(snapshot([line(rate=0, kind="exempt")]), COMPANY, "")
    assert tax["mode"] == "none" and tax["gst_paise"] == 0


@pytest.mark.parametrize("code, ok", [
    ("999591", True), ("999799", True), ("0910", True), ("33051090", True),
    ("", False), ("12", False), ("99959", False), ("99959100", False), ("ABCDEF", False), ("000000", False),
])
def test_hsn_sac_validation(code, ok):
    assert gst.valid_hsn_sac(code) is ok


def test_gstin_validation():
    good = gstin_for("36")
    assert gst.valid_gstin(good) and gst.valid_gstin(good.lower())
    assert not gst.valid_gstin(good[:-1] + ("A" if good[-1] != "A" else "B"))  # wrong check digit
    assert not gst.valid_gstin("36AAAAA0000A1")
    assert not gst.valid_gstin("99" + good[2:])


def test_state_codes():
    assert gst.state_code("Telangana") == "36" and gst.state_code("karnataka") == "29"
    assert gst.state_code("36") == "36" and gst.state_code("Orissa") == "21"
    assert gst.state_code("Atlantis") is None and gst.state_code("") is None


@pytest.mark.parametrize("change, flag", [
    ({"company": {"gstin": "", "state": "Telangana"}}, "Supplier GSTIN is missing"),
    ({"company": {"gstin": "36ABC", "state": "Telangana"}}, "Supplier GSTIN is invalid"),
    ({"company": {"gstin": gstin_for("29"), "state": "Telangana"}}, "does not match"),
    ({"pos": None}, "Place of Supply is missing"),
    ({"code": ""}, "HSN/SAC missing or invalid"),
    ({"code": "12"}, "HSN/SAC missing or invalid"),
    ({"rate": 20}, "not a recognised rate"),
])
def test_missing_or_invalid_tax_details_block_the_tax_invoice(change, flag):
    snap = snapshot([line(rate=change.get("rate", 18), code=change.get("code", "999591"))], change.get("pos", "36"))
    tax = invoice_tax(snap, change.get("company", COMPANY), "")
    assert tax["blocking"] is True
    assert any(flag in message for message in tax["flags"])


def test_customer_gstin_shown_only_when_valid():
    good = gstin_for("29")
    assert invoice_tax(snapshot([line()]), COMPANY, good)["customer_gstin"] == good
    tax = invoice_tax(snapshot([line()]), COMPANY, "BAD")
    assert tax["customer_gstin"] == "" and tax["blocking"] is False
