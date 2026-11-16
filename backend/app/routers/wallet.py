from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import rate_limit, sensitive_auth as sa
from app.audit import write_audit
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.domain import apply_wallet, row_dict
from app.rbac import require_super_admin
from app.schemas import WalletAdminCreditIn, WalletLoadIn, WalletManualRefundIn
from app.wallet_copy import public_wallet_description

router = APIRouter(prefix="/wallet", tags=["wallet"])
admin_router = APIRouter(prefix="/admin/wallets", tags=["wallet"])

SELF_TOPUP_DISABLED = (
    "Adding money to the wallet online is not available yet. "
    "Please contact BSeva support to add funds."
)
ADMIN_CREDIT_PREFIX = "Admin credit"


@router.get("")
def get_wallet(user=Depends(current_user), db: Session = Depends(get_db)):
    w = db.execute(text("SELECT * FROM wallets WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
    if not w:
        raise HTTPException(404, "Wallet not found")
    txs = db.execute(
        text("SELECT * FROM wallet_transactions WHERE wallet_id = :wid ORDER BY created_at DESC LIMIT 50"),
        {"wid": w["id"]},
    ).mappings().all()
    out = []
    for t in txs:
        d = row_dict(t)
        d["description"] = public_wallet_description(d.get("description"))
        if d.get("note"):
            d["note"] = public_wallet_description(d.get("note"))
        out.append(d)
    from app.customer_wallet import customer_wallet_enabled

    wallet_on = customer_wallet_enabled(db) or user.get("role") != "customer"
    return {
        "wallet": row_dict(w),
        "transactions": out,
        "self_topup_enabled": settings.wallet_self_topup_allowed and wallet_on,
        # Customer wallet switched off: customers pay online; any balance left is refunded by B-Seva.
        "customer_wallet_enabled": wallet_on,
    }


@router.post("/load")
def load_wallet(body: WalletLoadIn, user=Depends(current_user), db: Session = Depends(get_db)):
    # There is no payment gateway behind this endpoint, so it may only credit money where that is
    # explicitly allowed (development/QA, or WALLET_SELF_TOPUP=unverified).
    if not settings.wallet_self_topup_allowed:
        raise HTTPException(403, SELF_TOPUP_DISABLED)
    if user.get("role") == "customer":
        from app.customer_wallet import require_customer_wallet

        require_customer_wallet(db)
    try:
        bal = apply_wallet(db, str(user["id"]), body.amount_paise, "credit", "Wallet load")
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.commit()
    return {"ok": True, "balance_paise": bal}


@admin_router.post("/{user_id}/credit")
def admin_credit_wallet(
    user_id: str,
    body: WalletAdminCreditIn,
    request: Request,
    admin=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Super Admin credits a wallet after receiving an offline payment (UPI / bank / cash).

    The payment reference is mandatory and may be used only once per wallet, so a retried
    request can never credit the same payment twice."""
    reference = body.reference.strip()
    bound_reference = sa.wallet_credit_reference(user_id, reference)
    ip = rate_limit.client_ip(request)
    target = db.execute(
        text("SELECT id, role FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not target:
        raise HTTPException(404, "User not found")
    if target["role"] == "customer":
        from app.customer_wallet import customer_wallet_enabled

        if not customer_wallet_enabled(db):
            raise HTTPException(400, "The customer wallet is switched off, so customer wallets cannot be credited.")
    sa.verify_challenge(
        db,
        admin,
        challenge_id=str(body.challenge_id),
        otp=body.otp,
        mpin=body.mpin,
        action="wallet_credit",
        audit_action="wallet_credit",
        ip=ip,
        amount_paise=body.amount_paise,
        reference=bound_reference,
    )
    # Lock the wallet first so two concurrent requests with the same reference serialise here.
    wallet = db.execute(
        text("SELECT id FROM wallets WHERE user_id = CAST(:uid AS uuid) FOR UPDATE"),
        {"uid": user_id},
    ).first()
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    duplicate = db.execute(
        text(
            """
            SELECT t.id FROM wallet_transactions t
            JOIN wallets w ON w.id = t.wallet_id
            WHERE w.user_id = CAST(:uid AS uuid) AND t.reference = :ref
              AND t.description LIKE :prefix
            LIMIT 1
            """
        ),
        {"uid": user_id, "ref": reference, "prefix": f"{ADMIN_CREDIT_PREFIX}%"},
    ).first()
    if duplicate:
        sa.log_failure(db, admin, "wallet_credit", "duplicate_reference", amount_paise=body.amount_paise, reference=bound_reference, ip=ip)
        raise HTTPException(409, "This payment reference has already been credited to this wallet")
    note = (body.note or "").strip() or "Offline payment"
    try:
        bal = apply_wallet(
            db,
            user_id,
            body.amount_paise,
            "credit",
            f"{ADMIN_CREDIT_PREFIX}: {note}",
            reference=reference,
        )
    except ValueError as e:
        sa.log_failure(db, admin, "wallet_credit", str(e), amount_paise=body.amount_paise, reference=bound_reference, ip=ip)
        raise HTTPException(400, str(e))
    write_audit(db, str(admin["id"]), "wallet_admin_credit", "user", user_id, reason=reference)
    sa.log_event(db, admin, "wallet_credit", "success", amount_paise=body.amount_paise, reference=bound_reference, ip=ip)
    db.commit()
    return {"ok": True, "balance_paise": bal}


# ---------------------------------------------------------------- customer wallet switched off: balances left


@admin_router.get("/customer-balances")
def customer_balances(admin=Depends(require_super_admin), db: Session = Depends(get_db)):
    """Customers who still hold wallet money, to be paid back outside the app."""
    rows = db.execute(
        text(
            """
            SELECT u.id AS user_id, u.name, u.email, u.phone, w.balance_paise, w.status,
                   (SELECT MAX(t.created_at) FROM wallet_transactions t WHERE t.wallet_id = w.id) AS last_activity_at,
                   (SELECT COALESCE(SUM(r.amount_paise), 0) FROM wallet_manual_refunds r WHERE r.user_id = u.id) AS refunded_paise
            FROM wallets w JOIN users u ON u.id = w.user_id
            WHERE u.role = 'customer' AND w.balance_paise > 0
            ORDER BY w.balance_paise DESC
            LIMIT 500
            """
        )
    ).mappings().all()
    return {"items": [row_dict(r) for r in rows], "total_paise": sum(int(r["balance_paise"]) for r in rows)}


@admin_router.get("/{user_id}/manual-refunds")
def manual_refunds(user_id: str, admin=Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM wallet_manual_refunds WHERE user_id = CAST(:u AS uuid) ORDER BY created_at DESC"),
        {"u": user_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@admin_router.post("/{user_id}/manual-refund")
def record_manual_refund(
    user_id: str,
    body: WalletManualRefundIn,
    admin=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Record that B-Seva paid a customer's wallet balance back (UPI / bank) and take it off the wallet.

    Never moves money itself. The reference is unique per customer, so a retried request cannot record the same
    payment twice, and the amount can never exceed the balance."""
    reference = body.reference.strip()
    target = db.execute(
        text("SELECT id, role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}
    ).mappings().first()
    if not target or target["role"] != "customer":
        raise HTTPException(404, "Customer not found")
    wallet = db.execute(
        text("SELECT id, balance_paise FROM wallets WHERE user_id = CAST(:uid AS uuid) FOR UPDATE"), {"uid": user_id}
    ).mappings().first()
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    if body.amount_paise > int(wallet["balance_paise"]):
        raise HTTPException(400, "The amount is more than the customer's wallet balance")
    duplicate = db.execute(
        text("SELECT 1 FROM wallet_manual_refunds WHERE user_id = CAST(:u AS uuid) AND reference = :r"),
        {"u": user_id, "r": reference},
    ).first()
    if duplicate:
        raise HTTPException(409, "This payment reference is already recorded for this customer")
    method_label = {"upi": "UPI", "bank_transfer": "bank transfer", "other": "offline payment"}[body.method]
    try:
        bal = apply_wallet(
            db, user_id, -body.amount_paise, "debit", f"Wallet balance refunded by {method_label}", reference=reference,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.execute(
        text(
            """
            INSERT INTO wallet_manual_refunds (user_id, amount_paise, method, reference, note, created_by)
            VALUES (CAST(:u AS uuid), :amt, :m, :r, :n, CAST(:by AS uuid))
            """
        ),
        {"u": user_id, "amt": body.amount_paise, "m": body.method, "r": reference,
         "n": (body.note or "").strip() or None, "by": str(admin["id"])},
    )
    write_audit(db, str(admin["id"]), "wallet_manual_refund", "user", user_id, reason=reference)
    db.commit()
    return {"ok": True, "balance_paise": bal}
