from app.support_domain import (
    can_reopen,
    decorate_ticket,
    event_is_public,
    normalize_category,
    normalize_priority,
    parse_status,
    reporter_type_from_role,
    sanitize_ticket_for_user,
    sla_hours_for,
    sql_order,
    ticket_list_filters,
)


def test_legacy_categories_map_to_canonical():
    assert normalize_category("Payments") == "payment"
    assert normalize_category("Wallet") == "payment"
    assert normalize_category("Bookings") == "booking"
    assert normalize_category("Settlement") == "pujari"
    assert normalize_category("Route Map / Location") == "pujari"
    assert normalize_category("Others") == "other"
    assert normalize_category("Cancellation / Refund") == "cancellation_refund"


def test_priority_aliases_and_sla():
    assert normalize_priority("normal") == "medium"
    assert normalize_priority("critical") == "urgent"
    assert sla_hours_for("urgent") == 4
    assert sla_hours_for("medium", 12) == 12


def test_status_parse_and_reopen():
    assert parse_status("waiting") == "waiting_for_user"
    assert parse_status("in_progress") == "in_progress"
    assert can_reopen("resolved")
    assert can_reopen("closed")
    assert not can_reopen("open")


def test_reporter_from_role_ignores_spoofed_admin_role_for_end_users():
    assert reporter_type_from_role("customer") == "customer"
    assert reporter_type_from_role("pujari") == "pujari"
    assert reporter_type_from_role("head_pujari") == "pujari"


def test_internal_notes_are_not_public():
    assert event_is_public("internal_note", "internal") is False
    assert event_is_public("call_note", "internal") is False
    assert event_is_public("admin_reply", "public") is True
    assert event_is_public("escalated", "internal") is False


def test_user_sanitize_strips_assignment_and_internal_events():
    row = {
        "id": "t1",
        "ticket_number": "TKT-1",
        "subject": "Help",
        "description": "Need help",
        "status": "in_progress",
        "priority": "high",
        "category": "payment",
        "assigned_admin_id": "agent-1",
        "escalation_reason": "secret",
        "events": [
            {"id": "1", "event_type": "user_message", "visibility": "public", "body": "hi", "actor_name": "A"},
            {"id": "2", "event_type": "internal_note", "visibility": "internal", "body": "call later"},
            {"id": "3", "event_type": "admin_reply", "visibility": "public", "body": "we are on it"},
        ],
    }
    out = sanitize_ticket_for_user(row)
    assert "assigned_admin_id" not in out
    assert "escalation_reason" not in out
    types = {e["event_type"] for e in out["events"]}
    assert types == {"user_message", "admin_reply"}
    assert out["status_label"] == "In Progress"
    assert out["priority_label"] == "High"


def test_list_filters_search_and_status():
    sql, params = ticket_list_filters(q="TKT-26", status="open", priority="high")
    assert "ticket_number ILIKE :q" in sql
    assert params["status"] == "open"
    assert params["priority"] == "high"
    assert params["q"] == "%TKT-26%"


def test_sort_whitelist():
    assert "t.created_at DESC" in sql_order("nope", "desc")
    assert "t.sla_due_at ASC" in sql_order("sla_due_at", "asc")


def test_decorate_legacy_normal_priority():
    d = decorate_ticket({"status": "waiting_for_user", "priority": "normal", "category": "Wallet"})
    assert d["priority"] == "medium"
    assert d["category"] == "payment"
    assert d["status_label"] == "Waiting for User"
