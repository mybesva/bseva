# Known issue: wallet-mode settlement can stall when a pujari owes a penalty

Status: open, existing behaviour, not changed by the Cashfree work. Found 2026-11-03.

## What happens
In `settlement_payout_mode = wallet` (the default), the payday sweep `run_due_settlements`
(`backend/app/settlement_cycle.py`) credits each due settlement to the pujari's B-Seva wallet with
`apply_wallet(...)`, without `allow_overdraft`.

Pujari cancel and no-show penalties are wallet debits that may take the wallet below zero
(migration `030_wallet_pujari_penalty_overdraft.sql`). `apply_wallet` refuses any change whose result is
still below zero unless `allow_overdraft=True`, even a credit that reduces the debt.

So when a pujari owes more than one settlement is worth (for example wallet −₹800, settlement ₹500):

1. The credit is refused with "Insufficient wallet balance".
2. The sweep catches the error and leaves the settlement `eligible`.
3. The next sweep repeats this. The settlement never settles, the debt is never reduced, and nobody is told.

A settlement that is larger than the debt is credited normally and clears it.

## Not affected
- Bank payout mode (Cashfree Payouts): `app/payouts/service.py` keeps the debt back from the transfer and
  credits it to the wallet with `allow_overdraft=True`. If the debt is larger than the settlement, the whole
  settlement pays it down and no transfer is made.

## Possible fix (needs approval: it moves pujari money)
Pass `allow_overdraft=True` to the settlement credit in `run_due_settlements` (a credit only ever reduces what
is owed), and add a PG check with a wallet below −(settlement). Alternatively, alert ops when a settlement
stays `eligible` past its due date.
