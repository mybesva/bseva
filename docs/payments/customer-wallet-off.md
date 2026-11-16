# Customer wallet off: customers pay only online

Super Admin setting **Customer wallet** (`customer_wallet_enabled`). **By default it is off wherever online payment
works**: `PAYMENT_GATEWAY` defaults to `cashfree`, so any server with Cashfree keys (QA, Production) takes payments
online only, with nobody having to switch anything. Only a server with no online gateway keeps the wallet on, so
customers can always pay. A Super Admin can still switch it on or off explicitly in Settings → Payments.
Pujari wallets (settlements, penalties, joining fee) are not affected.

## What changes for customers when it is off
| Payment | Before (wallet on) | Wallet off |
|---|---|---|
| New booking | Wallet or online | Online only (wallet option hidden; API refuses wallet with 400) |
| Reschedule fee | Taken from the wallet | Paid online first; the booking moves only after the payment is verified |
| Muhurtham consultation fee | Taken from the wallet | Paid online first; the request reaches the team only after payment |
| Paid Seva event registration | Taken from the wallet | Paid online; the seat is held as `pending` while the payment is open |
| "Pay now" on later dates of a recurring booking | Taken from the wallet | Paid online |
| Wallet top-up | Allowed where configured | Refused |
| Customer referral reward (wallet credit) | Credited | Not given |
| Refunds | To where the money came from | Unchanged: online payments go back to the original method |

Free reschedules, free consultations and free Seva events work as before.

## How online charges work (`backend/app/payments/charges.py`)
- They reuse the `payments` table: `purpose` (`reschedule_fee`, `consultation`, `seva_registration`,
  `booking_payment`), `subject_id` (the booking, consultation or registration) and `meta` (what the charge needs,
  and `group`, the id shared by all attempts of one charge). Migration `045_customer_online_charges.sql`.
- Same safety rules as booking payments: amounts come from the server, state is applied only from Cashfree's
  records fetched server-side (webhooks only say "look again"), and each change locks the payment row.
- Money that cannot be used is refunded in full to the original method: a second successful attempt, a payment
  that arrives after the charge was closed, or a charge whose subject is no longer possible (for example the
  booking was cancelled before its reschedule fee was paid, or the new slot was taken).
- The worker's `payments` job closes unpaid charges (`expire_open_charges`): consultation requests are cancelled
  and Seva seats are released. A payment still pending at the bank gets a 30-minute grace period.
- Customer endpoints: `GET /payments/charges/{payment_id}/status`, `POST .../checkout` (retry) and
  `POST .../abandon`. Cashfree returns customers to `/payment/return?payment_id=…`.

## Balances customers already have
Super Admin → Payments → Customer wallet balances lists customers with money left. B-Seva pays them back
outside the app (UPI or bank transfer), then records it with **Mark refunded**
(`POST /admin/wallets/{user_id}/manual-refund`). That only records the payment and takes it off the wallet: it
never moves money. The reference must be unique per customer and the amount can't exceed the balance.

## Gateway fee settings
One name and percentage per gateway, editable by admins: `cashfree_fee_name` / `cashfree_fee_percent` and the
Razorpay entry (`payment_gateway_name` / `payment_gateway_fee_percent`, the original keys).
`customer_fee_gateway` picks which one customers pay: `auto` (the gateway that collects payments, so Cashfree
once `PAYMENT_GATEWAY=cashfree`; Razorpay when none is configured), `cashfree` or `razorpay`. The fee is
saved on each booking when it is created, so changes never alter existing bookings or invoices.

## Going live in Production
Production already has the live Cashfree keys, so **releasing this code turns on live online payments with the
customer wallet off**. To hold that back, set `PAYMENT_GATEWAY` to an empty value in Production before the release.
After the release:
1. Super Admin → Settings → Payments: check the Cashfree fee name and percentage.
2. Make one small real payment and refund it.
3. Super Admin → Payments → Customer wallet balances: pay back and mark refunded any balances.
4. Optionally also switch off customer referrals (no rewards are given while the wallet is off anyway).
