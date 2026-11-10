-- Online payment collection (Cashfree), gateway refunds and pujari bank/UPI payouts.
-- Additive only: existing wallet payments, settlements and invoices are not rewritten.

-- A booking waiting for a gateway payment: no pujari offer, notification or invoice until it is paid.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending', 'pending_acceptance', 'confirmed', 'in_progress',
    'completed', 'cancelled', 'rejected', 'awaiting_payment'
  )) NOT VALID;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partial_refund', 'failed', 'refund_pending')) NOT VALID;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
-- Set once, by the single transaction that turns a verified payment into a live booking.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bookings_awaiting_payment
  ON bookings (payment_expires_at) WHERE status = 'awaiting_payment';

-- Durable post-payment work for each paid booking (app.booking_finalize). Planned in the transaction that makes
-- the booking paid; each task is marked done in the same savepoint as its own writes, retried with back-off,
-- and left "failed" for Super Admin review after repeated errors. One row per booking and task.
CREATE TABLE IF NOT EXISTS booking_side_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  effect TEXT NOT NULL CHECK (effect IN ('meeting', 'preparation', 'offers', 'notifications', 'confirmation_email', 'invoice')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result JSONB,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, effect)
);
CREATE INDEX IF NOT EXISTS idx_booking_side_effects_due
  ON booking_side_effects (next_attempt_at) WHERE status = 'pending';

-- payments: one row per gateway order (attempt) or wallet charge. `provider` routes every later
-- status check, refund and webhook for the row, whatever gateway is selected today.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'refunded', 'cancelled', 'expired')) NOT VALID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'booking';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_session_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS attempt_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS check_attempts INTEGER NOT NULL DEFAULT 0;
-- A second successful payment for a booking that was already paid (it is refunded in full).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES payments(id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_uq
  ON payments (provider, provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_open ON payments (status, last_checked_at)
  WHERE status IN ('pending', 'processing');

-- Every webhook received, verified or not. The unique key makes a redelivered event a no-op.
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'pg' CHECK (channel IN ('pg', 'payouts')),
  event_key TEXT NOT NULL,
  event_type TEXT,
  reference TEXT,
  signature_valid BOOLEAN NOT NULL,
  payload JSONB,
  outcome TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, channel, event_key)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_reference ON payment_events (reference, received_at DESC);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  booking_id UUID REFERENCES bookings(id),
  provider TEXT NOT NULL,
  -- Our id, sent to the provider: retries reuse it, so the provider can never refund twice.
  refund_id TEXT NOT NULL UNIQUE,
  provider_refund_id TEXT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  kind TEXT NOT NULL DEFAULT 'cancellation' CHECK (kind IN ('cancellation', 'duplicate_payment', 'late_payment', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled', 'manual_review')),
  provider_status TEXT,
  reason TEXT,
  failure_reason TEXT,
  initiated_by UUID REFERENCES users(id),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refunds_open ON refunds (status, last_attempt_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds (booking_id);

-- Pujari bank account / UPI registered with the payouts provider. A details change makes a new row.
CREATE TABLE IF NOT EXISTS payout_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  beneficiary_id TEXT NOT NULL UNIQUE,
  instrument TEXT NOT NULL CHECK (instrument IN ('bank', 'upi')),
  details_fingerprint TEXT NOT NULL,
  masked_details TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'failed', 'superseded')),
  provider_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, pujari_id, details_fingerprint)
);

-- One row per transfer attempt for a settlement. "successful" only after the provider reports it.
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlements(id),
  pujari_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  transfer_id TEXT NOT NULL UNIQUE,
  provider_transfer_id TEXT,
  beneficiary_id TEXT NOT NULL,
  transfer_mode TEXT,
  -- Net sent to the bank = settlement amount - penalty_recovered_paise (the pujari's negative wallet balance
  -- at approval). The recovered part is credited to the wallet only when the transfer succeeds.
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  settlement_amount_paise INTEGER NOT NULL,
  penalty_recovered_paise INTEGER NOT NULL DEFAULT 0 CHECK (penalty_recovered_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'pending', 'successful', 'failed', 'reversed')),
  provider_status TEXT,
  status_detail TEXT,
  utr TEXT,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  initiated_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  check_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- At most one live or successful transfer per settlement: a second request cannot pay twice.
CREATE UNIQUE INDEX IF NOT EXISTS payouts_one_live_per_settlement
  ON payouts (settlement_id) WHERE status IN ('initiated', 'pending', 'successful');
CREATE INDEX IF NOT EXISTS idx_payouts_open ON payouts (status, last_checked_at)
  WHERE status IN ('initiated', 'pending');

-- Settlement payout mode: "wallet" keeps today's behaviour (credit the pujari's B-Seva wallet);
-- "bank" leaves due settlements eligible for a Super Admin approved bank/UPI payout instead.
INSERT INTO platform_settings (key, value)
VALUES ('settlement_payout_mode', '"wallet"'::jsonb)
ON CONFLICT (key) DO NOTHING;
