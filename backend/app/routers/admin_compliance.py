"""Admin review of account deletion requests and of user reports. Financial actions stay on their own screens."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import account_lifecycle as al
from app.db import get_db
from app.domain import row_dict
from app.rbac import require_any_permission, require_permission

router = APIRouter(prefix="/admin", tags=["admin-compliance"])

view_deletions = require_any_permission("view_account_deletions", "manage_account_deletions")
manage_deletions = require_permission("manage_account_deletions")
view_reports = require_any_permission("view_complaints", "manage_complaints")
manage_reports = require_permission("manage_complaints")


def _pages(total: int, size: int) -> int:
    return max(1, (total + size - 1) // size) if total else 1


# --- account deletions ----------------------------------------------------------------------------

@router.get("/account-deletions")
def list_deletions(
    status: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(view_deletions),
    db: Session = Depends(get_db),
):
    where = " WHERE 1=1 "
    params: dict = {}
    if status == "overdue":
        where += " AND r.state IN ('requested', 'pending_resolution', 'ready', 'escalated') AND r.deadline_at < NOW()"
    elif status:
        where += " AND r.state = :st"
        params["st"] = status
    if q:
        where += " AND (u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q OR u.public_id ILIKE :q OR CAST(r.id AS TEXT) ILIKE :q)"
        params["q"] = f"%{q.strip()}%"
    base = f"FROM account_deletion_requests r JOIN users u ON u.id = r.user_id LEFT JOIN users a ON a.id = r.assigned_admin_id {where}"
    total = int(db.execute(text(f"SELECT COUNT(*) {base}"), params).scalar() or 0)
    rows = db.execute(
        text(
            f"""
            SELECT r.id, r.user_id, r.role, u.name, u.email, u.phone, u.created_at AS account_created_at,
                   r.requested_at, r.deadline_at, r.reason, r.explanation, r.state, r.obligations,
                   a.name AS assigned_admin_name,
                   (r.state IN ('requested', 'pending_resolution', 'ready', 'escalated') AND r.deadline_at < NOW()) AS overdue,
                   (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = r.user_id OR b.pujari_id = r.user_id) AS booking_count
            {base}
            ORDER BY r.requested_at DESC
            LIMIT :lim OFFSET :off
            """
        ),
        {**params, "lim": page_size, "off": (page - 1) * page_size},
    ).mappings().all()
    items = []
    for r in rows:
        d = row_dict(r)
        ob = r["obligations"] or {}
        d["active_bookings"] = sum(1 for b in ob.get("bookings", []) if b.get("kind") == "ongoing")
        d["financial_status"] = "open" if (ob.get("pending_settlement_paise") or ob.get("wallet_balance_paise")) else "clear"
        d.pop("obligations", None)
        d["reason_label"] = al.REASONS.get(r["reason"], r["reason"])
        items.append(d)
    counts_row = db.execute(
        text(
            """
            SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE state = 'requested') AS requested,
              COUNT(*) FILTER (WHERE state = 'pending_resolution') AS pending_resolution,
              COUNT(*) FILTER (WHERE state = 'ready') AS ready,
              COUNT(*) FILTER (WHERE state = 'deleted') AS deleted,
              COUNT(*) FILTER (WHERE state = 'cancelled') AS cancelled,
              COUNT(*) FILTER (WHERE state = 'escalated') AS escalated,
              COUNT(*) FILTER (WHERE state IN ('requested', 'pending_resolution', 'ready', 'escalated') AND deadline_at < NOW()) AS overdue
            FROM account_deletion_requests
            """
        )
    ).mappings().one()
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": _pages(total, page_size),
        "counts": {k: int(v or 0) for k, v in dict(counts_row).items()},
    }


def _load_request(db: Session, request_id: str) -> dict:
    row = db.execute(
        text("SELECT * FROM account_deletion_requests WHERE id = CAST(:id AS uuid)"), {"id": request_id}
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Deletion request not found")
    return dict(row)


@router.get("/account-deletions/{request_id}")
def deletion_detail(request_id: str, user=Depends(view_deletions), db: Session = Depends(get_db)):
    req = _load_request(db, request_id)
    owner = db.execute(
        text("SELECT id, name, email, phone, role, created_at, account_state, blocked FROM users WHERE id = :id"),
        {"id": req["user_id"]},
    ).mappings().one()
    live = al.obligations(db, dict(owner), preview_cancellations=False) if owner["account_state"] != "deleted" else {}
    events = db.execute(
        text(
            "SELECT action, actor_name, detail, created_at FROM account_deletion_events WHERE request_id = :id ORDER BY created_at"
        ),
        {"id": req["id"]},
    ).mappings().all()
    assigned = None
    if req.get("assigned_admin_id"):
        assigned = db.execute(text("SELECT name FROM users WHERE id = :id"), {"id": req["assigned_admin_id"]}).scalar()
    out = row_dict(req)
    out.pop("contact_email", None)
    out["reason_label"] = al.REASONS.get(req["reason"], req["reason"])
    out["assigned_admin_name"] = assigned
    out["escalation_reason"] = req.get("escalated_reason")
    out["overdue"] = req["state"] in al.OPEN_STATES and req["deadline_at"] < datetime.now(timezone.utc)
    return {
        "request": out,
        "user": row_dict(owner),
        "obligations": live or req.get("obligations") or {},
        "events": [row_dict(e) for e in events],
    }


class AssignIn(BaseModel):
    admin_id: str | None = None


class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class ReviewIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class EscalateIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


@router.post("/account-deletions/{request_id}/assign")
def assign_deletion(request_id: str, body: AssignIn, user=Depends(manage_deletions), db: Session = Depends(get_db)):
    req = _load_request(db, request_id)
    name = None
    if body.admin_id:
        name = db.execute(
            text("SELECT name FROM users WHERE id = CAST(:id AS uuid) AND role IN ('admin', 'super_admin')"),
            {"id": body.admin_id},
        ).scalar()
        if not name:
            raise HTTPException(400, "Choose an admin")
    db.execute(
        text("UPDATE account_deletion_requests SET assigned_admin_id = CAST(:a AS uuid), updated_at = NOW() WHERE id = :id"),
        {"a": body.admin_id, "id": req["id"]},
    )
    al.add_event(db, str(req["id"]), "assigned", user, admin=name)
    db.commit()
    return {"ok": True}


@router.post("/account-deletions/{request_id}/note")
def note_deletion(request_id: str, body: NoteIn, user=Depends(manage_deletions), db: Session = Depends(get_db)):
    req = _load_request(db, request_id)
    al.add_event(db, str(req["id"]), "note", user, note=body.note.strip())
    db.commit()
    return {"ok": True}


@router.post("/account-deletions/{request_id}/review-complete")
def review_deletion(request_id: str, body: ReviewIn, user=Depends(manage_deletions), db: Session = Depends(get_db)):
    """Confirms money questions are handled. Open or ongoing bookings still block final deletion."""
    req = _load_request(db, request_id)
    if req["state"] not in ("requested", "pending_resolution", "ready", "escalated"):
        raise HTTPException(400, "This request is closed")
    owner = db.execute(text("SELECT id, role, name, email FROM users WHERE id = :id"), {"id": req["user_id"]}).mappings().one()
    ob = al.obligations(db, dict(owner), preview_cancellations=False)
    open_bookings = [b for b in ob["bookings"] if b["kind"] == "ongoing" or owner["role"] == "customer"]
    if open_bookings:
        raise HTTPException(400, "Bookings are still open. Resolve them first.")
    db.execute(
        text(
            """
            UPDATE account_deletion_requests SET review_completed_at = NOW(), review_completed_by = CAST(:u AS uuid),
              state = CASE WHEN state = 'escalated' THEN 'pending_resolution' ELSE state END, updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"u": str(user["id"]), "id": req["id"]},
    )
    al.add_event(db, str(req["id"]), "review_completed", user, note=(body.note or "").strip() or None,
                 wallet_balance_paise=ob["wallet_balance_paise"], pending_settlement_paise=ob["pending_settlement_paise"])
    state = al._refresh_state(db, str(req["id"]), dict(owner), actor=user)  # noqa: SLF001
    db.commit()
    return {"ok": True, "state": state}


@router.post("/account-deletions/{request_id}/escalate")
def escalate_deletion(request_id: str, body: EscalateIn, user=Depends(manage_deletions), db: Session = Depends(get_db)):
    req = _load_request(db, request_id)
    if req["state"] in ("deleted", "cancelled"):
        raise HTTPException(400, "This request is closed")
    db.execute(
        text("UPDATE account_deletion_requests SET state = 'escalated', escalated_reason = :r, updated_at = NOW() WHERE id = :id"),
        {"r": body.reason.strip(), "id": req["id"]},
    )
    al.add_event(db, str(req["id"]), "escalated", user, reason=body.reason.strip())
    db.commit()
    return {"ok": True}


@router.get("/admins-lite")
def admins_lite(user=Depends(view_deletions), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT id, name FROM users WHERE role IN ('admin', 'super_admin') AND COALESCE(blocked, FALSE) = FALSE ORDER BY name")
    ).mappings().all()
    return [row_dict(r) for r in rows]


# --- user reports ---------------------------------------------------------------------------------

@router.get("/user-reports")
def list_reports(
    status: str | None = None,
    target_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(view_reports),
    db: Session = Depends(get_db),
):
    where = " WHERE 1=1 "
    params: dict = {}
    if status:
        where += " AND r.status = :st"
        params["st"] = status
    if target_type:
        where += " AND r.target_type = :tt"
        params["tt"] = target_type
    base = f"FROM user_reports r JOIN users rep ON rep.id = r.reporter_id LEFT JOIN users t ON t.id = r.target_user_id LEFT JOIN bookings b ON b.id = r.booking_id {where}"
    total = int(db.execute(text(f"SELECT COUNT(*) {base}"), params).scalar() or 0)
    rows = db.execute(
        text(
            f"""
            SELECT r.id, r.target_type, r.reason, r.status, r.created_at, r.updated_at, r.reporter_role,
                   rep.name AS reporter_name, t.name AS target_name, b.booking_number, r.booking_id
            {base} ORDER BY r.created_at DESC LIMIT :lim OFFSET :off
            """
        ),
        {**params, "lim": page_size, "off": (page - 1) * page_size},
    ).mappings().all()
    counts = db.execute(
        text(
            """
            SELECT COUNT(*) FILTER (WHERE status = 'open') AS open,
              COUNT(*) FILTER (WHERE status = 'in_review') AS in_review,
              COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
              COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
              COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed
            FROM user_reports
            """
        )
    ).mappings().one()
    return {
        "items": [row_dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": _pages(total, page_size),
        "counts": {k: int(v or 0) for k, v in dict(counts).items()},
    }


@router.get("/user-reports/{report_id}")
def report_detail(report_id: str, user=Depends(view_reports), db: Session = Depends(get_db)):
    r = db.execute(
        text(
            """
            SELECT r.*, rep.name AS reporter_name, rep.email AS reporter_email, rep.phone AS reporter_phone,
                   t.name AS target_name, t.email AS target_email, t.phone AS target_phone,
                   b.booking_number, b.booking_date, b.status AS booking_status
            FROM user_reports r JOIN users rep ON rep.id = r.reporter_id
            LEFT JOIN users t ON t.id = r.target_user_id LEFT JOIN bookings b ON b.id = r.booking_id
            WHERE r.id = CAST(:id AS uuid)
            """
        ),
        {"id": report_id},
    ).mappings().first()
    if not r:
        raise HTTPException(404, "Report not found")
    history = db.execute(
        text("SELECT action, actor_name, note, created_at FROM user_report_events WHERE report_id = :id ORDER BY created_at"),
        {"id": r["id"]},
    ).mappings().all()
    return {"report": row_dict(r), "history": [row_dict(h) for h in history]}


class ReportUpdateIn(BaseModel):
    status: str
    resolution: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)


@router.patch("/user-reports/{report_id}")
def update_report(report_id: str, body: ReportUpdateIn, user=Depends(manage_reports), db: Session = Depends(get_db)):
    if body.status not in ("in_review", "escalated", "resolved", "dismissed"):
        raise HTTPException(400, "Choose a valid status")
    if body.status in ("resolved", "dismissed") and not (body.resolution or "").strip():
        raise HTTPException(400, "Add a resolution note")
    r = db.execute(text("SELECT id, reporter_id FROM user_reports WHERE id = CAST(:id AS uuid)"), {"id": report_id}).mappings().first()
    if not r:
        raise HTTPException(404, "Report not found")
    db.execute(
        text(
            """
            UPDATE user_reports SET status = :s, resolution = COALESCE(:res, resolution), handled_by = CAST(:u AS uuid),
              updated_at = NOW(), resolved_at = CASE WHEN :s IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END
            WHERE id = :id
            """
        ),
        {"s": body.status, "res": (body.resolution or "").strip() or None, "u": str(user["id"]), "id": r["id"]},
    )
    db.execute(
        text("INSERT INTO user_report_events (report_id, actor_id, actor_name, action, note) VALUES (:id, CAST(:a AS uuid), :n, :act, :note)"),
        {"id": r["id"], "a": str(user["id"]), "n": str(user.get("name") or "Admin"), "act": body.status,
         "note": (body.note or body.resolution or "").strip() or None},
    )
    try:
        from app.routers.notifications import create_notification, notify_super_admins

        if body.status in ("resolved", "dismissed"):
            create_notification(db, user_id=str(r["reporter_id"]), title="Your Report Was Reviewed",
                                body="Thank you. We reviewed your report and closed it.", category="support")
        if body.status == "escalated":
            notify_super_admins(db, title="Report Escalated", body="A user report needs Super Admin attention.",
                                category="ops", link=f"/admin/reports-queue?id={report_id}")
    except Exception:
        pass
    db.commit()
    return {"ok": True}
