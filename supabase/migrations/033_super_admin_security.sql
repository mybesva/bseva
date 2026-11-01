-- Super Admin 2FA, MPIN and settlement audit trail.

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone',
    'start_puja', 'complete_puja', 'sensitive_action'
  ));

-- MPINs are stored only as salted bcrypt hashes.
CREATE TABLE IF NOT EXISTS admin_mpins (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mpin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One OTP request, bound to exactly one action, amount and reference.
CREATE TABLE IF NOT EXISTS security_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  settlement_id UUID,
  amount_paise BIGINT,
  reference TEXT,
  binding TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_challenges_open
  ON security_challenges (user_id) WHERE consumed_at IS NULL;

-- Append-only. Names are copied in so a record stays readable if the account later changes.
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  settlement_id UUID,
  amount_paise BIGINT,
  transaction_reference TEXT,
  reason TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_audit_settlement
  ON security_audit_log (settlement_id, created_at DESC) WHERE settlement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION security_audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_audit_log_no_change ON security_audit_log;
CREATE TRIGGER security_audit_log_no_change
  BEFORE UPDATE OR DELETE ON security_audit_log
  FOR EACH ROW EXECUTE FUNCTION security_audit_log_immutable();

DROP TRIGGER IF EXISTS security_audit_log_no_truncate ON security_audit_log;
CREATE TRIGGER security_audit_log_no_truncate
  BEFORE TRUNCATE ON security_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION security_audit_log_immutable();
