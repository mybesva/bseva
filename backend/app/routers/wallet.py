from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user
from app.domain import apply_wallet, row_dict
from app.schemas import WalletLoadIn

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("")
def get_wallet(user=Depends(current_user), db: Session = Depends(get_db)):
    w = db.execute(text("SELECT * FROM wallets WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
    if not w:
        raise HTTPException(404, "Wallet not found")
    txs = db.execute(
        text("SELECT * FROM wallet_transactions WHERE wallet_id = :wid ORDER BY created_at DESC LIMIT 50"),
        {"wid": w["id"]},
    ).mappings().all()
    return {"wallet": row_dict(w), "transactions": [row_dict(t) for t in txs]}


@router.post("/load")
def load_wallet(body: WalletLoadIn, user=Depends(current_user), db: Session = Depends(get_db)):
    try:
        bal = apply_wallet(db, str(user["id"]), body.amount_paise, "credit", "Wallet load (demo gateway)")
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.commit()
    return {"ok": True, "balance_paise": bal}
