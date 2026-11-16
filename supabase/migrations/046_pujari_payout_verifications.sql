-- Pujari bank account / UPI ID checks before payouts (Cashfree Secure ID). One row per check of one set of
-- payout details; details_fingerprint is the same fingerprint payouts bind the Super Admin's OTP to, so a check
-- only counts for exactly the details that were checked. Any change to the details needs a new check.
CREATE TABLE IF NOT EXISTS pujari_payout_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id),
  instrument TEXT NOT NULL CHECK (instrument IN ('bank', 'upi')),
  details_fingerprint TEXT NOT NULL,
  masked_details TEXT,
  -- verified: valid and the name matches; name_mismatch: valid but the bank's name differs (a Super Admin may
  -- approve it after checking documents); invalid: the account / UPI ID is not usable; failed: the check itself
  -- could not complete (bank offline, etc.) and can be retried.
  status TEXT NOT NULL CHECK (status IN ('verified', 'name_mismatch', 'invalid', 'failed')),
  name_at_bank TEXT,
  name_match_result TEXT,
  name_match_score TEXT,
  provider TEXT NOT NULL DEFAULT 'cashfree',
  provider_reference TEXT,
  provider_status TEXT,
  failure_reason TEXT,
  checked_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approval_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pujari_payout_verifications_pujari
  ON pujari_payout_verifications (pujari_id, created_at DESC);

-- When the pujari last saved their payout details, agreeing that B-Seva may verify them (a UPI check sends Rs 1).
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS payout_details_consent_at TIMESTAMPTZ;

-- How the pujari chooses to receive payouts: 'upi' or 'bank'. NULL = automatic (bank account when complete, else UPI).
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE pujari_profiles DROP CONSTRAINT IF EXISTS pujari_profiles_payout_method_check;
ALTER TABLE pujari_profiles ADD CONSTRAINT pujari_profiles_payout_method_check
  CHECK (payout_method IS NULL OR payout_method IN ('upi', 'bank')) NOT VALID;
