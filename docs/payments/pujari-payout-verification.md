# Pujari payouts: verify bank / UPI details first

Pujari settlements are paid from the app by a Super Admin, one settlement at a time, through Cashfree Payouts
(Settings → Settlement Payout Mode = `bank`; Settlements → Pay → MPIN + email OTP). Before money goes out, the
pujari's bank account or UPI ID is checked with **Cashfree Secure ID**, and payouts go only to verified details.

## How it works
- **Verify:** Super Admin → Pujaris → open a pujari → *Payout details verification* → **Verify with bank** (also
  shown in the Pay dialog). The app sends the details to Cashfree Secure ID:
  - bank account → [Bank Account Verification v2](https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/bank-account-verification-sync-v2)
    (`POST /verification/bank-account/sync`): valid or invalid, and the account holder's name at the bank;
  - UPI ID (only when there is no complete bank account) → [UPI penny drop](https://www.cashfree.com/docs/api-reference/vrs/v2/upi-penny-drop/create-upi-penny-drop-request)
    (`POST /verification/upi/penny-drop`): sends ₹1 and returns the name at the bank. It needs the pujari's
    consent, recorded when they save their details on the Bank & UPI screen (the screen says so next to Save).
- **Result** (`pujari_payout_verifications`, migration `046`):
  - **verified**: valid, and the bank's name matches the profile name (direct or good partial match);
  - **name mismatch**: valid, but the name differs. Payouts stay blocked until a Super Admin checks the pujari's
    documents and clicks **Approve mismatch** with a reason;
  - **invalid**: the account or UPI ID cannot receive money. Ask the pujari to fix it;
  - **failed**: the check didn't complete (bank offline, timeout). Try again.
- A check counts only for the exact details checked. **If the pujari changes their bank or UPI details, payouts
  are blocked again until the new details are verified.** Details already verified are never re-checked (and
  billed) again.
- The server refuses both the payout OTP and the payout itself for unverified details, so it can't be bypassed
  from the UI. Setting `payout_require_verified_details` (Super Admin) can turn the requirement off; keep it on.

## Setup
1. Cashfree dashboard → Secure ID → Developers → **API Keys** (Test first, then Prod) and **Two-Factor
   Authentication** (Public Key, as for Payouts) or IP whitelisting.
2. Server settings: `CASHFREE_VRS_ENV` (`sandbox` / `production`), `CASHFREE_VRS_CLIENT_ID`,
   `CASHFREE_VRS_CLIENT_SECRET`, and `CASHFREE_VRS_PUBLIC_KEY_FILE` (or `CASHFREE_VRS_PUBLIC_KEY`). Production
   mode is refused outside `ENVIRONMENT=production`.
3. Cost: Cashfree bills each verification (and a UPI check sends ₹1). Checks run only when a Super Admin clicks
   Verify.

## Sandbox test data (Cashfree)
Bank: `026291800001191` / `YESB0000262` valid; `026291800001190` / `YESB0000262` invalid account.
UPI: `success@upi`, `valid@upi` valid; `invalid@upi` invalid; `expired@upi` expired.
See [Secure ID sandbox test data](https://www.cashfree.com/docs/api-reference/vrs/data-to-test-integration).
