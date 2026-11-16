-- Customer payments other than a new booking go through the payment gateway too ("online charges"):
-- reschedule fees, Muhurtham consultation fees, paid Seva event registrations and the later dates of a
-- recurring booking. They reuse `payments` (one row per gateway order attempt, verified server-side):
--   purpose     'reschedule_fee' | 'consultation' | 'seva_registration' | 'booking_payment'
--   subject_id  the thing being paid for (booking, consultation or registration id)
--   meta        what the charge needs to finish (e.g. the new reschedule slot) and its attempt group
-- booking_id stays NULL except for 'booking_payment', where the payment is the booking's own payment
-- (so cancellation refunds find it).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_payments_charge_group ON payments ((meta->>'group')) WHERE purpose <> 'booking';
CREATE INDEX IF NOT EXISTS idx_payments_subject ON payments (purpose, subject_id) WHERE subject_id IS NOT NULL;

-- Customer wallet switched off: balances customers already had are settled outside the app (bank / UPI)
-- by a Super Admin, then recorded here and debited from the wallet so the balance shows as refunded.
CREATE TABLE IF NOT EXISTS wallet_manual_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  method TEXT NOT NULL CHECK (method IN ('upi', 'bank_transfer', 'other')),
  reference TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_wallet_manual_refunds_user ON wallet_manual_refunds (user_id, created_at DESC);
