"""Support ticket domain: statuses, priorities, categories, filters, visibility."""
from __future__ import annotations

from typing import Any

TICKET_STATUSES = (
    "open",
    "in_progress",
    "waiting_for_user",
    "escalated",
    "resolved",
    "closed",
)

STATUS_LABELS = {
    "open": "Open",
    "in_progress": "In Progress",
    "waiting_for_user": "Waiting for User",
    "escalated": "Escalated",
    "resolved": "Resolved",
    "closed": "Closed",
}

PRIORITIES = ("urgent", "high", "medium", "low")
PRIORITY_ALIASES = {
    "normal": "medium",
    "medium": "medium",
    "low": "low",
    "high": "high",
    "urgent": "urgent",
    "critical": "urgent",
}

SLA_HOURS = {"urgent": 4, "high": 8, "medium": 24, "low": 48}

REPORTER_TYPES = ("customer", "pujari", "temple", "other")
CONTACT_SOURCES = ("phone", "whatsapp", "email", "in_app_chat", "in_app", "other")

CATEGORIES = (
    "booking",
    "payment",
    "cancellation_refund",
    "puja_seva",
    "pujari",
    "customer",
    "samagri",
    "rescheduling",
    "technical",
    "other",
)

CATEGORY_LABELS = {
    "booking": "Booking",
    "payment": "Payment",
    "cancellation_refund": "Cancellation / Refund",
    "puja_seva": "Puja / Seva",
    "pujari": "Pujari",
    "customer": "Customer",
    "samagri": "Samagri",
    "rescheduling": "Rescheduling",
    "technical": "Technical / Website",
    "other": "Other",
}

CATEGORY_ALIASES = {
    "payments": "payment",
    "payment": "payment",
    "wallet": "payment",
    "bookings": "booking",
    "booking": "booking",
    "others": "other",
    "other": "other",
    "settlement": "pujari",
    "route map / location": "pujari",
    "route": "pujari",
    "cancellation / refund": "cancellation_refund",
    "cancellation_refund": "cancellation_refund",
    "puja / seva": "puja_seva",
    "puja_seva": "puja_seva",
    "technical / website": "technical",
    "technical": "technical",
    "samagri": "samagri",
    "rescheduling": "rescheduling",
    "pujari": "pujari",
    "customer": "customer",
}

ESCALATION_TEAMS = (
    "senior_support",
    "operations",
    "finance",
    "pujari_manager",
    "technical",
    "other",
)

ESCALATION_LABELS = {
    "senior_support": "Senior Support",
    "operations": "Operations",
    "finance": "Finance",
    "pujari_manager": "Pujari Manager",
    "technical": "Technical",
    "other": "Other",
}

RESOLUTION_TYPES = (
    "information_provided",
    "booking_updated",
    "puja_rescheduled",
    "pujari_reassigned",
    "refund_initiated",
    "payment_issue_resolved",
    "escalated",
    "other",
)

RESOLUTION_LABELS = {
    "information_provided": "Information Provided",
    "booking_updated": "Booking Updated",
    "puja_rescheduled": "Puja Rescheduled",
    "pujari_reassigned": "Pujari Reassigned",
    "refund_initiated": "Refund Initiated",
    "payment_issue_resolved": "Payment Issue Resolved",
    "escalated": "Escalated",
    "other": "Other",
}

OUTCOMES = ("yes", "no", "partially")

PUBLIC_EVENT_TYPES = {
    "ticket_created",
    "admin_created_ticket",
    "user_message",
    "admin_reply",
    "status_changed",
    "booking_linked",
    "resolution_added",
    "ticket_resolved",
    "ticket_closed",
    "ticket_reopened",
}

INTERNAL_EVENT_TYPES = {
    "internal_note",
    "call_note",
    "whatsapp_note",
    "email_note",
    "agent_assigned",
    "priority_changed",
    "escalated",
}

MESSAGE_KINDS = {
    "reply": ("admin_reply", "public"),
    "user": ("user_message", "public"),
    "internal_note": ("internal_note", "internal"),
    "call_note": ("call_note", "internal"),
    "whatsapp_note": ("whatsapp_note", "internal"),
    "email_note": ("email_note", "internal"),
}

USER_SAFE_FIELDS = {
    "id",
    "ticket_number",
    "category",
    "category_label",
    "subject",
    "description",
    "status",
    "status_label",
    "priority",
    "priority_label",
    "related_booking_id",
    "booking_number",
    "service_name",
    "booking_date",
    "start_time",
    "location_label",
    "created_at",
    "updated_at",
    "last_activity_at",
    "resolution",
    "resolution_type",
    "resolution_type_label",
    "resolution_outcome",
    "resolved_at",
    "feedback",
    "rating",
    "reporter_type",
    "events",
    "booking",
}

LIST_SORT_COLUMNS = {
    "created_at": "t.created_at",
    "updated_at": "t.updated_at",
    "last_activity_at": "COALESCE(t.last_activity_at, t.updated_at, t.created_at)",
    "priority": "t.priority",
    "status": "t.status",
    "ticket_number": "t.ticket_number",
    "sla_due_at": "t.sla_due_at",
    "subject": "t.subject",
}


def normalize_priority(raw: str | None, default: str = "medium") -> str:
    key = (raw or default or "medium").strip().lower()
    return PRIORITY_ALIASES.get(key, default if default in PRIORITIES else "medium")


def normalize_status(raw: str | None, default: str = "open") -> str:
    key = (raw or default or "open").strip().lower()
    if key == "waiting":
        return "waiting_for_user"
    if key in TICKET_STATUSES:
        return key
    if default in TICKET_STATUSES:
        return default
    return "open"


def parse_status(raw: str | None) -> str:
    status = normalize_status(raw)
    key = (raw or "").strip().lower()
    if key in ("waiting", *TICKET_STATUSES):
        return status
    raise ValueError("Invalid ticket status")


def normalize_category(raw: str | None, default: str = "other") -> str:
    key = (raw or default or "other").strip().lower()
    mapped = CATEGORY_ALIASES.get(key)
    if mapped:
        return mapped
    if key in CATEGORIES:
        return key
    # Accept display labels
    for canon, label in CATEGORY_LABELS.items():
        if label.lower() == key:
            return canon
    return default if default in CATEGORIES else "other"


def normalize_reporter_type(raw: str | None, role: str | None = None) -> str:
    key = (raw or "").strip().lower()
    if key in REPORTER_TYPES:
        return key
    if role in ("pujari", "head_pujari"):
        return "pujari"
    if role == "customer":
        return "customer"
    return "other"


def normalize_contact_source(raw: str | None, default: str = "in_app") -> str:
    key = (raw or default or "in_app").strip().lower().replace(" ", "_")
    if key in CONTACT_SOURCES:
        return key
    return default if default in CONTACT_SOURCES else "other"


def reporter_type_from_role(role: str | None) -> str:
    if role in ("pujari", "head_pujari"):
        return "pujari"
    if role == "customer":
        return "customer"
    return "other"


def sla_hours_for(priority: str, override: int | None = None) -> int:
    if override is not None and 1 <= int(override) <= 24 * 30:
        return int(override)
    return SLA_HOURS.get(normalize_priority(priority), 24)


def can_reopen(status: str) -> bool:
    return status in ("resolved", "closed")


def event_is_public(event_type: str, visibility: str | None = None) -> bool:
    if visibility == "internal":
        return False
    if visibility == "public":
        return event_type in PUBLIC_EVENT_TYPES or event_type in {"user_message", "admin_reply"}
    return event_type in PUBLIC_EVENT_TYPES


def decorate_ticket(row: dict[str, Any]) -> dict[str, Any]:
    status = normalize_status(str(row.get("status") or "open"))
    priority = normalize_priority(str(row.get("priority") or "medium"))
    category = normalize_category(str(row.get("category") or "other"))
    row["status"] = status
    row["status_label"] = STATUS_LABELS.get(status, status)
    row["priority"] = priority
    row["priority_label"] = priority.title()
    row["category"] = category
    row["category_label"] = CATEGORY_LABELS.get(category, category)
    res_type = row.get("resolution_type")
    if res_type:
        row["resolution_type_label"] = RESOLUTION_LABELS.get(str(res_type), str(res_type))
    esc = row.get("escalated_to")
    if esc:
        row["escalated_to_label"] = ESCALATION_LABELS.get(str(esc), str(esc))
    return row


def sanitize_ticket_for_user(row: dict[str, Any]) -> dict[str, Any]:
    decorate_ticket(row)
    events = row.get("events")
    public_events = []
    if isinstance(events, list):
        for ev in events:
            if not isinstance(ev, dict):
                continue
            if not event_is_public(str(ev.get("event_type") or ""), ev.get("visibility")):
                continue
            public_events.append(
                {
                    "id": ev.get("id"),
                    "event_type": ev.get("event_type"),
                    "body": ev.get("body"),
                    "actor_name": ev.get("actor_name"),
                    "actor_role": ev.get("actor_role"),
                    "created_at": ev.get("created_at"),
                    "new_value": ev.get("new_value") if ev.get("event_type") == "status_changed" else None,
                }
            )
    booking = row.get("booking") if isinstance(row.get("booking"), dict) else None
    out = {k: row.get(k) for k in USER_SAFE_FIELDS if k in row}
    out["events"] = public_events
    if booking:
        out["booking"] = {
            "id": booking.get("id"),
            "booking_number": booking.get("booking_number"),
            "service_name": booking.get("service_name"),
            "booking_date": booking.get("booking_date"),
            "start_time": booking.get("start_time"),
            "location_label": booking.get("location_label") or booking.get("address"),
            "status": booking.get("status") or booking.get("booking_status"),
        }
    return out


def ticket_list_filters(
    *,
    q: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    assigned_admin_id: str | None = None,
    reporter_type: str | None = None,
    booking_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    unassigned: bool = False,
) -> tuple[str, dict[str, Any]]:
    extra = ""
    params: dict[str, Any] = {}
    if status and status not in ("all", ""):
        extra += " AND t.status = :status"
        params["status"] = normalize_status(status)
    if priority and priority not in ("all", ""):
        extra += " AND LOWER(COALESCE(t.priority, 'medium')) = :priority"
        params["priority"] = normalize_priority(priority)
    if category and category not in ("all", ""):
        extra += " AND t.category = :category"
        params["category"] = normalize_category(category)
    if assigned_admin_id:
        extra += " AND t.assigned_admin_id = CAST(:assigned_admin_id AS uuid)"
        params["assigned_admin_id"] = assigned_admin_id
    if unassigned:
        extra += " AND t.assigned_admin_id IS NULL"
    if reporter_type and reporter_type not in ("all", ""):
        extra += " AND COALESCE(t.reporter_type, t.user_role) = :reporter_type"
        params["reporter_type"] = normalize_reporter_type(reporter_type)
    if booking_id:
        extra += " AND (t.related_booking_id = CAST(:booking_id AS uuid) OR b.booking_number ILIKE :booking_q)"
        params["booking_id"] = booking_id
        params["booking_q"] = f"%{booking_id.strip()}%"
    if date_from:
        extra += " AND t.created_at::date >= CAST(:date_from AS date)"
        params["date_from"] = date_from
    if date_to:
        extra += " AND t.created_at::date <= CAST(:date_to AS date)"
        params["date_to"] = date_to
    if q and q.strip():
        extra += """
          AND (
            t.ticket_number ILIKE :q
            OR t.subject ILIKE :q
            OR COALESCE(t.description, '') ILIKE :q
            OR COALESCE(u.name, '') ILIKE :q
            OR COALESCE(u.phone, '') ILIKE :q
            OR COALESCE(u.email, '') ILIKE :q
            OR COALESCE(u.public_id, '') ILIKE :q
            OR CAST(u.id AS text) ILIKE :q
            OR COALESCE(t.guest_name, '') ILIKE :q
            OR COALESCE(t.guest_phone, '') ILIKE :q
            OR COALESCE(b.booking_number, '') ILIKE :q
            OR COALESCE(a.name, '') ILIKE :q
          )
        """
        params["q"] = f"%{q.strip()}%"
    return extra, params


def sql_order(sort_by: str | None, sort_dir: str | None) -> str:
    col = LIST_SORT_COLUMNS.get((sort_by or "created_at").strip(), "t.created_at")
    direction = "ASC" if (sort_dir or "desc").lower() == "asc" else "DESC"
    return f"ORDER BY {col} {direction} NULLS LAST, t.created_at DESC"


def empty_counts() -> dict[str, int]:
    counts = {s: 0 for s in TICKET_STATUSES}
    counts["all"] = 0
    return counts
