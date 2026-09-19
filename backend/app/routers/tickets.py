"""Support ticket management APIs."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.db import get_db
from app.deps import current_user
from app.domain import row_dict
from app.rbac import is_admin_like, require_permission
from app.support_domain import (
    CATEGORIES,
    CATEGORY_LABELS,
    CONTACT_SOURCES,
    ESCALATION_LABELS,
    ESCALATION_TEAMS,
    MESSAGE_KINDS,
    OUTCOMES,
    PRIORITIES,
    REPORTER_TYPES,
    RESOLUTION_LABELS,
    RESOLUTION_TYPES,
    SLA_HOURS,
    STATUS_LABELS,
    TICKET_STATUSES,
    can_reopen,
    decorate_ticket,
    empty_counts,
    event_is_public,
    normalize_category,
    normalize_contact_source,
    normalize_priority,
    normalize_reporter_type,
    parse_status,
    reporter_type_from_role,
    sanitize_ticket_for_user,
    sla_hours_for,
    sql_order,
    ticket_list_filters,
)

router = APIRouter(prefix="/support", tags=["support-tickets"])

_TICKET_SELECT = """
SELECT
  t.*,
  u.name AS reporter_name,
  u.public_id AS reporter_public_id,
  u.phone AS reporter_phone,
  u.email AS reporter_email,
  u.preferred_language AS reporter_language,
  u.role AS reporter_user_role,
  a.name AS assigned_agent_name,
  ab.name AS assigned_by_name,
  b.booking_number,
  b.booking_date,
  b.start_time,
  b.location_label AS booking_location,
  b.address AS booking_address,
  b.customer_id AS booking_customer_id,
  b.pujari_id AS booking_pujari_id,
  s.name AS service_name,
  cu.name AS booking_customer_name,
  pu.name AS booking_pujari_name
FROM support_tickets t
LEFT JOIN users u ON u.id = t.user_id
LEFT JOIN users a ON a.id = t.assigned_admin_id
LEFT JOIN users ab ON ab.id = t.assigned_by
LEFT JOIN bookings b ON b.id = t.related_booking_id
LEFT JOIN services s ON s.id = b.service_id
LEFT JOIN users cu ON cu.id = b.customer_id
LEFT JOIN users pu ON pu.id = b.pujari_id
"""


class TicketCreateIn(BaseModel):
    category: str = "other"
    subject: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    related_booking_id: str | None = None
    related_settlement_id: str | None = None
    related_payment_id: str | None = None
    priority: str | None = "medium"
    user_id: str | None = None
    reporter_type: str | None = None
    contact_source: str | None = None
    expected_resolution: str | None = Field(default=None, max_length=2000)
    additional_info: str | None = Field(default=None, max_length=5000)
    assigned_admin_id: str | None = None
    sla_hours: int | None = None
    conversation_id: str | None = None
    guest_name: str | None = Field(default=None, max_length=200)
    guest_phone: str | None = Field(default=None, max_length=30)
    guest_email: str | None = Field(default=None, max_length=200)
    temple_id: str | None = None


class TicketPatchIn(BaseModel):
    status: str | None = None
    priority: str | None = None
    category: str | None = None
    assigned_admin_id: str | None = None
    unassign: bool = False
    related_booking_id: str | None = None
    sla_hours: int | None = None
    expected_resolution: str | None = None
    additional_info: str | None = None


class TicketMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    kind: str = "reply"


class EscalateIn(BaseModel):
    escalated_to: str
    reason: str = Field(min_length=5, max_length=2000)
    required_action: str | None = Field(default=None, max_length=2000)


class ResolveIn(BaseModel):
    resolution_type: str
    resolution_details: str = Field(min_length=5, max_length=5000)
    outcome: str | None = None


class FeedbackIn(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    feedback: str | None = Field(default=None, max_length=2000)
    resolved: str | None = None


class LinkConversationIn(BaseModel):
    ticket_id: str | None = None
    subject: str | None = None
    category: str | None = None
    priority: str | None = None


def _admin(user: dict) -> bool:
    return is_admin_like(user)


def _uuid(val: str | None) -> str | None:
    v = (val or "").strip()
    return v or None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_ticket(db: Session, ticket_id: str) -> dict | None:
    row = db.execute(
        text(_TICKET_SELECT + " WHERE t.id = CAST(:id AS uuid)"),
        {"id": ticket_id},
    ).mappings().first()
    return dict(row) if row else None


def _assert_access(ticket: dict, user: dict, *, staff: bool = False) -> None:
    if _admin(user):
        return
    if staff:
        raise HTTPException(403, "Not allowed")
    if not ticket.get("user_id") or str(ticket["user_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")


def _add_event(
    db: Session,
    *,
    ticket_id: str,
    actor: dict | None,
    event_type: str,
    body: str | None = None,
    visibility: str = "public",
    previous: str | None = None,
    new: str | None = None,
    meta: dict | None = None,
) -> str:
    eid = str(uuid4())
    role = None
    aid = None
    if actor:
        aid = str(actor["id"])
        role = actor.get("role")
        if _admin(actor) and event_type in ("admin_reply", "internal_note", "call_note", "agent_assigned"):
            role = "agent"
    db.execute(
        text(
            """
            INSERT INTO support_ticket_messages (
              id, ticket_id, author_id, body, visibility, event_type,
              previous_value, new_value, meta, actor_role
            ) VALUES (
              CAST(:id AS uuid), CAST(:tid AS uuid), CAST(:aid AS uuid), :body, :vis, :et,
              :prev, :new, CAST(:meta AS jsonb), :role
            )
            """
        ),
        {
            "id": eid,
            "tid": ticket_id,
            "aid": aid,
            "body": body or "",
            "vis": visibility,
            "et": event_type,
            "prev": previous,
            "new": new,
            "meta": json.dumps(meta or {}),
            "role": role,
        },
    )
    db.execute(
        text(
            """
            UPDATE support_tickets
            SET last_activity_at = NOW(), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": ticket_id},
    )
    return eid


def _events(db: Session, ticket_id: str, *, include_internal: bool) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT m.*, u.name AS actor_name
            FROM support_ticket_messages m
            LEFT JOIN users u ON u.id = m.author_id
            WHERE m.ticket_id = CAST(:id AS uuid)
            ORDER BY m.created_at ASC
            """
        ),
        {"id": ticket_id},
    ).mappings().all()
    out = []
    for r in rows:
        d = row_dict(r)
        vis = d.get("visibility") or ("internal" if d.get("event_type") in ("internal_note", "call_note") else "public")
        et = d.get("event_type") or "message"
        if et == "message":
            et = "user_message"
            d["event_type"] = et
        if not include_internal and not event_is_public(str(et), vis):
            continue
        out.append(d)
    return out


def _booking_snapshot(db: Session, booking_id: str | None) -> dict | None:
    if not booking_id:
        return None
    row = db.execute(
        text(
            """
            SELECT b.id, b.booking_number, b.booking_date, b.start_time, b.end_time, b.mode,
                   b.location_label, b.address, b.status AS booking_status, b.customer_id, b.pujari_id,
                   s.name AS service_name, cu.name AS customer_name, cu.public_id AS customer_public_id,
                   pu.name AS pujari_name, pu.public_id AS pujari_public_id
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            JOIN users cu ON cu.id = b.customer_id
            LEFT JOIN users pu ON pu.id = b.pujari_id
            WHERE b.id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    return row_dict(row) if row else None


def _assert_booking_link(db: Session, booking_id: str, user: dict, reporter_user_id: str | None) -> dict:
    snap = _booking_snapshot(db, booking_id)
    if not snap:
        raise HTTPException(400, "Related booking not found")
    if _admin(user):
        return snap
    uid = str(user["id"])
    if str(snap.get("customer_id")) == uid or (snap.get("pujari_id") and str(snap["pujari_id"]) == uid):
        return snap
    raise HTTPException(403, "Booking does not belong to this account")


def _serialize(db: Session, ticket: dict, user: dict) -> dict:
    d = decorate_ticket(row_dict(ticket))
    d["events"] = _events(db, str(d["id"]), include_internal=_admin(user))
    d["booking"] = _booking_snapshot(db, d.get("related_booking_id"))
    if _admin(user):
        return d
    return sanitize_ticket_for_user(d)


def _notify_user(db: Session, user_id: str | None, title: str, body: str, ticket_id: str) -> None:
    if not user_id:
        return
    try:
        from app.routers.notifications import create_notification

        create_notification(
            db,
            user_id=str(user_id),
            title=title,
            body=body,
            category="support",
            link="/customer/support",
        )
    except Exception:
        pass


@router.get("/tickets/meta")
def ticket_meta(user=Depends(current_user), db: Session = Depends(get_db)):
    from app.platform_config import get_setting

    configured = get_setting(db, "support_categories", list(CATEGORIES))
    cats = []
    if isinstance(configured, list) and configured:
        for item in configured:
            key = normalize_category(str(item))
            cats.append({"id": key, "label": CATEGORY_LABELS.get(key, str(item))})
    else:
        cats = [{"id": c, "label": CATEGORY_LABELS[c]} for c in CATEGORIES]
    seen = set()
    uniq = []
    for c in cats:
        if c["id"] in seen:
            continue
        seen.add(c["id"])
        uniq.append(c)
    agents = []
    if _admin(user):
        rows = db.execute(
            text(
                """
                SELECT id, name, email, role
                FROM users
                WHERE role IN ('admin', 'super_admin') AND COALESCE(blocked, FALSE) = FALSE
                ORDER BY name
                """
            )
        ).mappings().all()
        agents = [row_dict(r) for r in rows]
    return {
        "statuses": [{"id": s, "label": STATUS_LABELS[s]} for s in TICKET_STATUSES],
        "priorities": [{"id": p, "label": p.title()} for p in PRIORITIES],
        "categories": uniq,
        "reporter_types": [{"id": r, "label": r.title()} for r in REPORTER_TYPES],
        "contact_sources": [{"id": c, "label": c.replace("_", " ").title()} for c in CONTACT_SOURCES],
        "escalation_teams": [{"id": t, "label": ESCALATION_LABELS[t]} for t in ESCALATION_TEAMS],
        "resolution_types": [{"id": t, "label": RESOLUTION_LABELS[t]} for t in RESOLUTION_TYPES],
        "outcomes": list(OUTCOMES),
        "sla_hours": SLA_HOURS,
        "agents": agents,
    }


@router.get("/tickets/directory")
def support_directory(
    q: str = Query(..., min_length=1),
    kind: str = Query("customer"),
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    kind_n = kind.strip().lower()
    like = f"%{q.strip()}%"
    if kind_n == "temple":
        rows = db.execute(
            text(
                """
                SELECT t.id, t.name, t.city, t.contact_phone AS phone, t.contact_email AS email,
                       t.pujari_name, 'temple' AS role
                FROM temples t
                WHERE t.name ILIKE :q OR COALESCE(t.city,'') ILIKE :q
                   OR COALESCE(t.contact_phone,'') ILIKE :q OR COALESCE(t.pujari_name,'') ILIKE :q
                ORDER BY t.name
                LIMIT 20
                """
            ),
            {"q": like},
        ).mappings().all()
        return [row_dict(r) for r in rows]
    role_sql = "('customer')" if kind_n == "customer" else "('pujari', 'head_pujari')"
    rows = db.execute(
        text(
            f"""
            SELECT u.id, u.public_id, u.name, u.email, u.phone, u.role, u.preferred_language
            FROM users u
            WHERE u.role IN {role_sql}
              AND (
                u.name ILIKE :q OR COALESCE(u.email,'') ILIKE :q OR COALESCE(u.phone,'') ILIKE :q
                OR COALESCE(u.public_id,'') ILIKE :q OR CAST(u.id AS text) ILIKE :q
              )
            ORDER BY u.name
            LIMIT 20
            """
        ),
        {"q": like},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/tickets/directory/{user_id}/bookings")
def directory_bookings(
    user_id: str,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT b.id, b.booking_number, b.booking_date, b.start_time, b.status, b.mode,
                   b.location_label, s.name AS service_name, b.customer_id, b.pujari_id,
                   cu.name AS customer_name, pu.name AS pujari_name
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            JOIN users cu ON cu.id = b.customer_id
            LEFT JOIN users pu ON pu.id = b.pujari_id
            WHERE b.customer_id = CAST(:id AS uuid) OR b.pujari_id = CAST(:id AS uuid)
            ORDER BY b.created_at DESC
            LIMIT 50
            """
        ),
        {"id": user_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/tickets")
def create_ticket(body: TicketCreateIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.validation_rules import validate_support_text

    admin = _admin(user)
    subject, description = validate_support_text(body.subject, body.description)
    category = normalize_category(body.category)
    priority = normalize_priority(body.priority)
    if admin:
        reporter_type = normalize_reporter_type(body.reporter_type, None)
        target_user_id = _uuid(body.user_id)
        if reporter_type in ("customer", "pujari") and not target_user_id:
            raise HTTPException(400, "Select a customer or pujari")
        if target_user_id:
            target = db.execute(
                text("SELECT id, role, name FROM users WHERE id = CAST(:id AS uuid)"),
                {"id": target_user_id},
            ).mappings().first()
            if not target:
                raise HTTPException(400, "Selected person was not found")
            if reporter_type == "customer" and target["role"] != "customer":
                raise HTTPException(400, "Selected user is not a customer")
            if reporter_type == "pujari" and target["role"] not in ("pujari", "head_pujari"):
                raise HTTPException(400, "Selected user is not a pujari")
        contact_source = normalize_contact_source(body.contact_source, "phone")
        created_event = "admin_created_ticket"
        user_role = reporter_type if reporter_type in ("customer", "pujari") else "other"
    else:
        # Never trust supplied identity from customers/pujaris.
        reporter_type = reporter_type_from_role(user.get("role"))
        target_user_id = str(user["id"])
        contact_source = normalize_contact_source(body.contact_source, "in_app")
        created_event = "ticket_created"
        user_role = user["role"]
        if user_role not in ("customer", "pujari", "head_pujari"):
            raise HTTPException(403, "Not allowed")

    booking_id = _uuid(body.related_booking_id)
    if booking_id:
        _assert_booking_link(db, booking_id, user, target_user_id)

    sla_h = sla_hours_for(priority, body.sla_hours)
    due = _now() + timedelta(hours=sla_h)
    tid = str(uuid4())
    num = f"TKT-{datetime.utcnow().strftime('%y%m%d')}-{uuid4().hex[:6].upper()}"
    assigned = _uuid(body.assigned_admin_id) if admin else None
    conv_id = _uuid(body.conversation_id) if admin else None

    db.execute(
        text(
            """
            INSERT INTO support_tickets (
              id, ticket_number, user_id, user_role, category,
              related_booking_id, related_settlement_id, related_payment_id,
              subject, description, status, priority,
              reporter_type, contact_source, expected_resolution, additional_info,
              assigned_admin_id, assigned_at, assigned_by, sla_hours, sla_due_at,
              created_by, conversation_id, guest_name, guest_phone, guest_email,
              last_activity_at
            ) VALUES (
              CAST(:id AS uuid), :n, CAST(:u AS uuid), :r, :c,
              CAST(:b AS uuid), CAST(:setl AS uuid), CAST(:pay AS uuid),
              :subj, :d, 'open', :pri,
              :rt, :src, :exp, :add,
              CAST(:aid AS uuid), CASE WHEN :aid IS NOT NULL THEN NOW() END,
              CAST(:aby AS uuid), :sla, :due,
              CAST(:cby AS uuid), CAST(:cid AS uuid), :gn, :gp, :ge,
              NOW()
            )
            """
        ),
        {
            "id": tid,
            "n": num,
            "u": target_user_id,
            "r": user_role,
            "c": category,
            "b": booking_id,
            "setl": _uuid(body.related_settlement_id),
            "pay": _uuid(body.related_payment_id),
            "subj": subject,
            "d": description,
            "pri": priority,
            "rt": reporter_type,
            "src": contact_source,
            "exp": (body.expected_resolution or "").strip() or None,
            "add": (body.additional_info or "").strip() or None,
            "aid": assigned,
            "aby": str(user["id"]) if assigned else None,
            "sla": sla_h,
            "due": due,
            "cby": str(user["id"]),
            "cid": conv_id,
            "gn": (body.guest_name or "").strip() or None,
            "gp": (body.guest_phone or "").strip() or None,
            "ge": (body.guest_email or "").strip() or None,
        },
    )
    _add_event(
        db,
        ticket_id=tid,
        actor=user,
        event_type=created_event,
        body=description,
        visibility="public",
        meta={"contact_source": contact_source, "reporter_type": reporter_type},
    )
    if assigned:
        _add_event(
            db,
            ticket_id=tid,
            actor=user,
            event_type="agent_assigned",
            body="Ticket assigned",
            visibility="internal",
            new=assigned,
        )
    if booking_id:
        _add_event(
            db,
            ticket_id=tid,
            actor=user,
            event_type="booking_linked",
            body="Booking linked",
            visibility="public",
            new=booking_id,
        )
    if conv_id:
        db.execute(
            text(
                """
                UPDATE support_conversations
                SET ticket_id = CAST(:tid AS uuid), updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"tid": tid, "id": conv_id},
        )
        _import_conversation(db, conv_id, tid, user)
    write_audit(db, str(user["id"]), created_event, "support_ticket", tid)
    db.commit()
    return {"id": tid, "ticket_number": num, "status": "open"}


def _import_conversation(db: Session, conversation_id: str, ticket_id: str, actor: dict) -> None:
    rows = db.execute(
        text(
            """
            SELECT sender_id, sender_role, body, created_at
            FROM support_messages
            WHERE conversation_id = CAST(:id AS uuid)
            ORDER BY created_at ASC
            """
        ),
        {"id": conversation_id},
    ).mappings().all()
    for r in rows:
        role = str(r["sender_role"] or "customer")
        et = "admin_reply" if role in ("agent", "admin", "super_admin") else "user_message"
        db.execute(
            text(
                """
                INSERT INTO support_ticket_messages (
                  id, ticket_id, author_id, body, visibility, event_type, actor_role, created_at, meta
                ) VALUES (
                  CAST(:id AS uuid), CAST(:tid AS uuid), CAST(:aid AS uuid), :body, 'public', :et, :role, :ts,
                  CAST(:meta AS jsonb)
                )
                """
            ),
            {
                "id": str(uuid4()),
                "tid": ticket_id,
                "aid": str(r["sender_id"]) if r["sender_id"] else None,
                "body": r["body"],
                "et": et,
                "role": role,
                "ts": r["created_at"],
                "meta": json.dumps({"from_conversation": conversation_id}),
            },
        )


@router.get("/tickets")
def list_tickets(
    q: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    assigned_admin_id: str | None = None,
    reporter_type: str | None = None,
    booking_id: str | None = None,
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    unassigned: bool = False,
    sort: str | None = None,
    dir: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    extra, params = ticket_list_filters(
        q=q,
        status=status,
        priority=priority,
        category=category,
        assigned_admin_id=assigned_admin_id,
        reporter_type=reporter_type,
        booking_id=booking_id,
        date_from=date_from,
        date_to=date_to,
        unassigned=unassigned,
    )
    if not _admin(user):
        extra += " AND t.user_id = CAST(:viewer AS uuid)"
        params["viewer"] = str(user["id"])
    count_sql = f"""
        SELECT COUNT(*) FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assigned_admin_id
        LEFT JOIN bookings b ON b.id = t.related_booking_id
        WHERE 1=1 {extra}
    """
    total = int(db.execute(text(count_sql), params).scalar() or 0)
    params["lim"] = page_size
    params["off"] = (page - 1) * page_size
    order = sql_order(sort, dir)
    rows = db.execute(
        text(
            f"""
            {_TICKET_SELECT}
            WHERE 1=1 {extra}
            {order}
            LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).mappings().all()
    items = [decorate_ticket(row_dict(r)) for r in rows]
    if not _admin(user):
        items = [sanitize_ticket_for_user(i) for i in items]

    counts = empty_counts()
    count_params = {k: v for k, v in params.items() if k not in ("lim", "off", "status")}
    extra_no_status, _ = ticket_list_filters(
        q=q,
        priority=priority,
        category=category,
        assigned_admin_id=assigned_admin_id,
        reporter_type=reporter_type,
        booking_id=booking_id,
        date_from=date_from,
        date_to=date_to,
        unassigned=unassigned,
    )
    if not _admin(user):
        extra_no_status += " AND t.user_id = CAST(:viewer AS uuid)"
        count_params["viewer"] = str(user["id"])
    for r in db.execute(
        text(
            f"""
            SELECT t.status, COUNT(*) AS n
            FROM support_tickets t
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN users a ON a.id = t.assigned_admin_id
            LEFT JOIN bookings b ON b.id = t.related_booking_id
            WHERE 1=1 {extra_no_status}
            GROUP BY t.status
            """
        ),
        count_params,
    ).mappings().all():
        st = str(r["status"] or "open")
        n = int(r["n"] or 0)
        counts[st] = counts.get(st, 0) + n
        counts["all"] += n
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        "counts": counts,
    }


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    _assert_access(t, user)
    return _serialize(db, t, user)


@router.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: str,
    body: TicketPatchIn,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    sets = ["updated_at = NOW()", "last_activity_at = NOW()"]
    params: dict = {"id": ticket_id}
    if body.status:
        new_status = parse_status(body.status)
        old = str(t.get("status") or "open")
        if new_status != old:
            sets.append("status = :st")
            params["st"] = new_status
            if new_status == "closed":
                sets.append("closed_at = NOW()")
            if new_status == "open" and can_reopen(old):
                sets.append("reopened_at = NOW()")
            et = "status_changed"
            if new_status == "closed":
                et = "ticket_closed"
            elif new_status == "resolved":
                et = "ticket_resolved"
            elif new_status == "open" and can_reopen(old):
                et = "ticket_reopened"
            _add_event(
                db,
                ticket_id=ticket_id,
                actor=user,
                event_type=et,
                body=f"Status changed to {STATUS_LABELS.get(new_status, new_status)}",
                visibility="public" if et in ("ticket_closed", "ticket_resolved", "ticket_reopened", "status_changed") else "internal",
                previous=old,
                new=new_status,
            )
            write_audit(db, str(user["id"]), f"ticket_status:{old}->{new_status}", "support_ticket", ticket_id)
    if body.priority:
        new_p = normalize_priority(body.priority)
        old_p = normalize_priority(str(t.get("priority") or "medium"))
        if new_p != old_p:
            sets.append("priority = :pri")
            params["pri"] = new_p
            hours = sla_hours_for(new_p, body.sla_hours if body.sla_hours is not None else t.get("sla_hours"))
            sets.append("sla_hours = :sla")
            sets.append("sla_due_at = created_at + make_interval(hours => :sla)")
            params["sla"] = hours
            _add_event(
                db,
                ticket_id=ticket_id,
                actor=user,
                event_type="priority_changed",
                body=f"Priority changed to {new_p}",
                visibility="internal",
                previous=old_p,
                new=new_p,
            )
            write_audit(db, str(user["id"]), f"ticket_priority:{old_p}->{new_p}", "support_ticket", ticket_id)
    elif body.sla_hours is not None:
        hours = sla_hours_for(str(t.get("priority") or "medium"), body.sla_hours)
        sets.append("sla_hours = :sla")
        sets.append("sla_due_at = created_at + make_interval(hours => :sla)")
        params["sla"] = hours
    if body.category:
        sets.append("category = :cat")
        params["cat"] = normalize_category(body.category)
    if body.unassign:
        sets.append("assigned_admin_id = NULL")
        sets.append("assigned_at = NULL")
        _add_event(
            db,
            ticket_id=ticket_id,
            actor=user,
            event_type="agent_assigned",
            body="Agent unassigned",
            visibility="internal",
            previous=str(t.get("assigned_admin_id") or ""),
            new="",
        )
    elif body.assigned_admin_id:
        aid = _uuid(body.assigned_admin_id)
        sets.append("assigned_admin_id = CAST(:aid AS uuid)")
        sets.append("assigned_at = NOW()")
        sets.append("assigned_by = CAST(:aby AS uuid)")
        params["aid"] = aid
        params["aby"] = str(user["id"])
        _add_event(
            db,
            ticket_id=ticket_id,
            actor=user,
            event_type="agent_assigned",
            body="Agent assigned",
            visibility="internal",
            previous=str(t.get("assigned_admin_id") or ""),
            new=aid,
        )
        write_audit(db, str(user["id"]), "ticket_assigned", "support_ticket", ticket_id)
    if body.related_booking_id:
        bid = _uuid(body.related_booking_id)
        _assert_booking_link(db, bid, user, str(t.get("user_id") or "") or None)
        sets.append("related_booking_id = CAST(:bid AS uuid)")
        params["bid"] = bid
        _add_event(
            db,
            ticket_id=ticket_id,
            actor=user,
            event_type="booking_linked",
            body="Booking linked",
            visibility="public",
            previous=str(t.get("related_booking_id") or ""),
            new=bid,
        )
    if body.expected_resolution is not None:
        sets.append("expected_resolution = :exp")
        params["exp"] = body.expected_resolution.strip() or None
    if body.additional_info is not None:
        sets.append("additional_info = :ainfo")
        params["ainfo"] = body.additional_info.strip() or None
    db.execute(text(f"UPDATE support_tickets SET {', '.join(sets)} WHERE id = CAST(:id AS uuid)"), params)
    db.commit()
    return _serialize(db, _load_ticket(db, ticket_id), user)


@router.post("/tickets/{ticket_id}/messages")
def add_message(
    ticket_id: str,
    body: TicketMessageIn,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    _assert_access(t, user)
    kind = (body.kind or "reply").strip().lower()
    admin = _admin(user)
    if not admin:
        if str(t.get("status")) == "closed":
            raise HTTPException(400, "Ticket is closed. Reopen it to send a new message.")
        kind = "user"
    if kind not in MESSAGE_KINDS:
        raise HTTPException(400, "Invalid message kind")
    if kind != "user" and not admin:
        raise HTTPException(403, "Not allowed")
    event_type, visibility = MESSAGE_KINDS[kind]
    if not admin and event_type == "admin_reply":
        event_type, visibility = "user_message", "public"
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type=event_type,
        body=body.body.strip(),
        visibility=visibility,
    )
    if not admin and str(t.get("status")) == "waiting_for_user":
        db.execute(
            text("UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = CAST(:id AS uuid)"),
            {"id": ticket_id},
        )
        _add_event(
            db,
            ticket_id=ticket_id,
            actor=user,
            event_type="status_changed",
            body="Status changed to In Progress",
            visibility="public",
            previous="waiting_for_user",
            new="in_progress",
        )
    elif admin and event_type == "admin_reply" and str(t.get("status")) == "open":
        db.execute(
            text("UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = CAST(:id AS uuid)"),
            {"id": ticket_id},
        )
    if admin and event_type == "admin_reply" and t.get("user_id"):
        _notify_user(db, str(t["user_id"]), "Support replied", body.body.strip()[:180], ticket_id)
    write_audit(db, str(user["id"]), event_type, "support_ticket", ticket_id)
    db.commit()
    return {"ok": True}


@router.post("/tickets/{ticket_id}/escalate")
def escalate_ticket(
    ticket_id: str,
    body: EscalateIn,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    team = body.escalated_to.strip().lower()
    if team not in ESCALATION_TEAMS:
        raise HTTPException(400, "Invalid escalation team")
    db.execute(
        text(
            """
            UPDATE support_tickets SET
              status = 'escalated',
              escalated_to = :to,
              escalation_reason = :reason,
              escalation_action = :act,
              escalated_at = NOW(),
              escalated_by = CAST(:by AS uuid),
              updated_at = NOW(),
              last_activity_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "to": team,
            "reason": body.reason.strip(),
            "act": (body.required_action or "").strip() or None,
            "by": str(user["id"]),
            "id": ticket_id,
        },
    )
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type="escalated",
        body=body.reason.strip(),
        visibility="internal",
        new=team,
        meta={"required_action": body.required_action},
    )
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type="status_changed",
        body="Status changed to Escalated",
        visibility="public",
        previous=str(t.get("status") or "open"),
        new="escalated",
    )
    write_audit(db, str(user["id"]), f"ticket_escalated:{team}", "support_ticket", ticket_id)
    db.commit()
    return _serialize(db, _load_ticket(db, ticket_id), user)


@router.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(
    ticket_id: str,
    body: ResolveIn,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rtype = body.resolution_type.strip().lower()
    if rtype not in RESOLUTION_TYPES:
        raise HTTPException(400, "Invalid resolution type")
    outcome = (body.outcome or "").strip().lower() or None
    if outcome and outcome not in OUTCOMES:
        raise HTTPException(400, "Invalid outcome")
    db.execute(
        text(
            """
            UPDATE support_tickets SET
              status = 'resolved',
              resolution = :details,
              resolution_type = :rtype,
              resolution_outcome = :outc,
              resolved_by = CAST(:by AS uuid),
              resolved_at = NOW(),
              updated_at = NOW(),
              last_activity_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "details": body.resolution_details.strip(),
            "rtype": rtype,
            "outc": outcome,
            "by": str(user["id"]),
            "id": ticket_id,
        },
    )
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type="resolution_added",
        body=body.resolution_details.strip(),
        visibility="public",
        new=rtype,
    )
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type="ticket_resolved",
        body="Ticket resolved",
        visibility="public",
        previous=str(t.get("status") or "open"),
        new="resolved",
    )
    write_audit(db, str(user["id"]), f"ticket_resolved:{rtype}", "support_ticket", ticket_id)
    if t.get("user_id"):
        _notify_user(db, str(t["user_id"]), "Support ticket resolved", body.resolution_details.strip()[:180], ticket_id)
    db.commit()
    return _serialize(db, _load_ticket(db, ticket_id), user)


@router.post("/tickets/{ticket_id}/reopen")
def reopen_ticket(ticket_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    _assert_access(t, user)
    old = str(t.get("status") or "open")
    if not can_reopen(old) and not _admin(user):
        raise HTTPException(400, "Ticket cannot be reopened")
    db.execute(
        text(
            """
            UPDATE support_tickets SET
              status = 'open', reopened_at = NOW(), updated_at = NOW(), last_activity_at = NOW(),
              closed_at = NULL
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": ticket_id},
    )
    _add_event(
        db,
        ticket_id=ticket_id,
        actor=user,
        event_type="ticket_reopened",
        body="Ticket reopened",
        visibility="public",
        previous=old,
        new="open",
    )
    write_audit(db, str(user["id"]), "ticket_reopened", "support_ticket", ticket_id)
    db.commit()
    return _serialize(db, _load_ticket(db, ticket_id), user)


@router.post("/tickets/{ticket_id}/feedback")
def ticket_feedback(ticket_id: str, body: FeedbackIn, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    _assert_access(t, user)
    if _admin(user) and str(t.get("user_id")) != str(user["id"]):
        # staff may record user-provided feedback while on a call
        pass
    elif str(t.get("user_id")) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    outcome = (body.resolved or "").strip().lower() or None
    if outcome and outcome not in OUTCOMES:
        raise HTTPException(400, "Invalid outcome")
    db.execute(
        text(
            """
            UPDATE support_tickets SET
              rating = COALESCE(:rating, rating),
              feedback = COALESCE(:fb, feedback),
              resolution_outcome = COALESCE(:outc, resolution_outcome),
              updated_at = NOW(), last_activity_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "rating": body.rating,
            "fb": (body.feedback or "").strip() or None,
            "outc": outcome,
            "id": ticket_id,
        },
    )
    db.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/to-ticket")
def conversation_to_ticket(
    conversation_id: str,
    body: LinkConversationIn,
    user=Depends(require_permission("manage_support")),
    db: Session = Depends(get_db),
):
    conv = db.execute(
        text("SELECT * FROM support_conversations WHERE id = CAST(:id AS uuid)"),
        {"id": conversation_id},
    ).mappings().first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if conv.get("ticket_id") and not body.ticket_id:
        return {"id": str(conv["ticket_id"]), "linked": True, "existing": True}
    if body.ticket_id:
        t = _load_ticket(db, body.ticket_id)
        if not t:
            raise HTTPException(404, "Ticket not found")
        db.execute(
            text(
                """
                UPDATE support_conversations
                SET ticket_id = CAST(:tid AS uuid), updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"tid": body.ticket_id, "id": conversation_id},
        )
        db.execute(
            text(
                """
                UPDATE support_tickets
                SET conversation_id = CAST(:cid AS uuid), updated_at = NOW()
                WHERE id = CAST(:tid AS uuid)
                """
            ),
            {"cid": conversation_id, "tid": body.ticket_id},
        )
        if not conv.get("ticket_id"):
            _import_conversation(db, conversation_id, body.ticket_id, user)
        _add_event(
            db,
            ticket_id=body.ticket_id,
            actor=user,
            event_type="ticket_created",
            body="Live chat linked to ticket",
            visibility="internal",
            new=conversation_id,
        )
        db.commit()
        return {"id": body.ticket_id, "linked": True}
    first_msg = db.execute(
        text(
            """
            SELECT body FROM support_messages
            WHERE conversation_id = CAST(:id AS uuid)
            ORDER BY created_at ASC LIMIT 1
            """
        ),
        {"id": conversation_id},
    ).first()
    desc = (first_msg[0] if first_msg else conv.get("subject") or "Live chat conversation")
    if len(desc) < 10:
        desc = f"{desc} — converted from live chat"
    payload = TicketCreateIn(
        category=body.category or "other",
        subject=(body.subject or conv.get("subject") or "Live chat")[:200],
        description=desc[:5000],
        user_id=str(conv["customer_id"]),
        reporter_type="customer",
        contact_source="in_app_chat",
        priority=body.priority or "medium",
        conversation_id=conversation_id,
    )
    return create_ticket(payload, user, db)
