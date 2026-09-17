from datetime import date, time
from uuid import uuid4

from starlette.requests import Request

from app.admin_nav_badges import muhurtham_tooltip
from app.booking_visibility import booking_for_role
from app.invoice_docs import render_invoice_html
from app.preparation import (
    SECTION_CUSTOMER,
    SECTION_INCLUDED,
    build_preparation_view,
    enrich_legacy_preparation_snapshot,
)
from app.routers.bookings import (
    _booking_idempotency,
    _existing_idempotent_response,
    admin_booking_filters,
)
from app.routers.consultations import create_muhurta_consultation
from app.schemas import BookingCreateIn, MuhurtaConsultationIn


class _NoDb:
    def execute(self, *_args, **_kwargs):
        raise RuntimeError("not available in unit test")


class _MappingResult:
    def __init__(self, row):
        self.row = row

    def mappings(self):
        return self

    def first(self):
        return self.row


class _ReplayDb:
    def execute(self, *_args, **_kwargs):
        return _MappingResult(
            {
                "id": uuid4(),
                "booking_number": "BSV-RETRY",
                "total_paise": 12300,
                "status": "pending_acceptance",
                "pujari_id": None,
                "needs_reassignment": True,
                "idempotency_request_hash": "same-hash",
                "idempotency_response": {
                    "booking_number": "BSV-RETRY",
                    "total_paise": 12300,
                },
            }
        )


class _ConsultationDb:
    def __init__(self):
        self.committed = False

    def execute(self, statement, *_args, **_kwargs):
        if "SELECT * FROM services" in str(statement):
            return _MappingResult(
                {
                    "id": uuid4(),
                    "name": "Marriage Puja",
                    "active": True,
                    "muhurta_consultation_enabled": True,
                    "requires_muhurta": False,
                    "muhurta_fee_paise": 0,
                }
            )
        return _MappingResult(None)

    def commit(self):
        self.committed = True


def test_paid_customer_booking_has_confirmed_display_status_without_mutation(monkeypatch):
    monkeypatch.setattr("app.booking_visibility.can_pujari_see_full", lambda *_args: False)
    monkeypatch.setattr("app.booking_visibility.pujari_hours_before_full", lambda *_args: 20)
    booking = {
        "id": uuid4(),
        "customer_id": uuid4(),
        "status": "pending_acceptance",
        "payment_status": "paid",
        "booking_date": date.today(),
        "start_time": time(9),
        "mode": "in_person",
    }
    result = booking_for_role(
        _NoDb(),
        booking,
        {"id": booking["customer_id"], "role": "customer"},
    )
    assert result["status"] == "confirmed"
    assert "internal_status" not in result
    assert result["customer_display_status"] == "confirmed"


def test_admin_booking_keeps_raw_internal_status():
    booking = {"id": uuid4(), "status": "pending_acceptance", "mode": "in_person"}
    result = booking_for_role(_NoDb(), booking, {"id": uuid4(), "role": "admin"})
    assert result["status"] == "pending_acceptance"
    assert result["internal_status"] == "pending_acceptance"


def test_purchased_samagri_is_not_listed_as_customer_arranged():
    master = {
        "ok": True,
        "verified": True,
        "service": {"name": "Test Puja", "samagri_provider": "BSEVA"},
        "content": {},
        "items": [
            {
                "item_key": "rice",
                "item_name_en": "Rice",
                "category": "PUJA_SAMAGRI",
                "provided_by": "CUSTOMER",
                "customer_provided": False,
            },
            {
                "item_key": "clean-space",
                "item_name_en": "Clean puja space",
                "category": "HOME_VENUE",
                "provided_by": "CUSTOMER",
                "customer_provided": True,
            },
        ],
    }
    view = build_preparation_view(
        master,
        samagri_purchased=True,
        alankaram_purchased=True,
        food_purchased=False,
        lang="en",
    )
    assert any(item.get("name") == "Rice" for item in view["sections"][SECTION_INCLUDED])
    assert not any(item.get("name") == "Rice" for item in view["sections"][SECTION_CUSTOMER])
    assert any(item.get("name") == "Clean puja space" for item in view["customer_arranged"])
    assert {item["key"] for item in view["selected_addons"]} == {"samagri", "alankaram"}


def test_preparation_categories_use_corresponding_purchase_and_preserve_venue():
    master = {
        "ok": True,
        "verified": True,
        "service": {
            "name": "Test Puja",
            "samagri_provider": "BSEVA",
            "alankaram_provider": "PUJARI",
            "food_provider": "BSEVA",
        },
        "content": {},
        "items": [
            {"name": "Flowers", "category": "ALANKARAM", "provided_by": "PUJARI"},
            {"name": "Prasadam", "category": "PRASADAM", "provided_by": "BSEVA"},
            {
                "name": "Clean venue",
                "category": "HOME_VENUE",
                "provided_by": "CUSTOMER",
                "customer_provided": True,
            },
        ],
    }
    view = build_preparation_view(
        master,
        samagri_purchased=False,
        alankaram_purchased=True,
        food_purchased=False,
        lang="en",
    )
    assert any(item["name"] == "Flowers" for item in view["provider_supplied"])
    assert any(item["name"] == "Prasadam" for item in view["customer_arranged"])
    assert any(item["name"] == "Clean venue" for item in view["customer_arranged"])


def test_legacy_snapshot_is_enriched_and_misclassification_corrected():
    upgraded = enrich_legacy_preparation_snapshot(
        {
            "verified": True,
            "language": "en",
            "samagri_purchased": True,
            "items": [
                {
                    "name": "Rice",
                    "category": "PUJA_SAMAGRI",
                    "provided_by": "CUSTOMER",
                    "customer_provided": False,
                }
            ],
        },
        header={},
        service={"samagri_provider": "BSEVA"},
    )
    assert upgraded["snapshot_version"] == 2
    assert upgraded["selected_addons"][0]["key"] == "samagri"
    assert upgraded["provider_supplied"][0]["name"] == "Rice"
    assert upgraded["customer_arranged"] == []


def test_idempotency_key_header_and_body_are_supported():
    body = BookingCreateIn(
        service_id=uuid4(),
        package_type="standard",
        mode="in_person",
        booking_date=date(2030, 1, 1),
        start_time=time(9),
        terms_accepted=True,
        idempotency_key="retry-123",
    )
    request = Request({"type": "http", "headers": [(b"idempotency-key", b"retry-123")]})
    key, digest = _booking_idempotency(body, request)
    assert key == "retry-123"
    assert len(digest or "") == 64


def test_idempotent_retry_returns_original_booking_response():
    replay = _existing_idempotent_response(
        _ReplayDb(), str(uuid4()), "retry-123", "same-hash"
    )
    assert replay == {
        "booking_number": "BSV-RETRY",
        "total_paise": 12300,
        "status": "confirmed",
        "customer_display_status": "confirmed",
        "idempotent_replay": True,
    }


def test_invoice_html_renders_snapshot_duration_dynamically():
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
    assert "Puja Duration:</strong> 2 Hours 15 Minutes" in html


def test_physical_and_virtual_booking_sql_are_mutually_exclusive_pujas():
    physical_sql, _ = admin_booking_filters(mode="physical")
    virtual_sql, _ = admin_booking_filters(mode="virtual")
    assert "COALESCE(b.booking_kind, 'puja') = 'puja'" in physical_sql
    assert "COALESCE(b.booking_kind, 'puja') = 'puja'" in virtual_sql
    assert "COALESCE(b.mode, 'in_person') <> 'virtual'" in physical_sql
    assert "b.mode = 'virtual'" in virtual_sql


def test_muhurtham_badge_tooltip_covers_actionable_states():
    assert muhurtham_tooltip(2, 1) == (
        "2 new Muhurtham consultations\n1 Muhurtham consultation in progress"
    )


def test_muhurtham_create_notifies_ops_with_admin_link(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.routers.notifications.notify_ops_staff",
        lambda *_args, **kwargs: calls.append(kwargs) or 1,
    )
    db = _ConsultationDb()
    result = create_muhurta_consultation(
        MuhurtaConsultationIn(
            service_id=uuid4(),
            appointment_date=date(2030, 1, 2),
            appointment_time="09:30",
        ),
        user={"id": uuid4(), "role": "customer"},
        db=db,
    )
    assert result["status"] == "requested"
    assert db.committed
    assert calls[0]["link"] == "/admin/muhurtham"
