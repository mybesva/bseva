from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.domain import apply_wallet, row_dict
from app.rbac import require_super_admin
from app.schemas import WalletAdminCreditIn, WalletLoadIn
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
    return {
        "wallet": row_dict(w),
        "transactions": out,
        "self_topup_enabled": settings.wallet_self_topup_allowed,
    }


@router.post("/load")
def load_wallet(body: WalletLoadIn, user=Depends(current_user), db: Session = Depends(get_db)):
    # There is no payment gateway behind this endpoint, so it may only credit money where that is
    # explicitly allowed (development/QA, or WALLET_SELF_TOPUP=unverified).
    if not settings.wallet_self_topup_allowed:
        raise HTTPException(403, SELF_TOPUP_DISABLED)
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
    admin=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Super Admin credits a wallet after receiving an offline payment (UPI / bank / cash).

    The payment reference is mandatory and may be used only once per wallet, so a retried
    request can never credit the same payment twice."""
    reference = body.reference.strip()
    target = db.execute(
        text("SELECT id, role FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).mappings().first()
    if not target:
        raise HTTPException(404, "User not found")
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
        raise HTTPException(400, str(e))
    write_audit(db, str(admin["id"]), "wallet_admin_credit", "user", user_id, reason=reference)
    db.commit()
    return {"ok": True, "balance_paise": bal}
