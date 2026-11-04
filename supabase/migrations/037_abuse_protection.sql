-- Bot and spam protection: rolling OTP send counters and durable contact-form records.
-- Additive only (new tables and indexes). Safe to run more than once. Apply BEFORE deploying the code that uses it;
-- the release still running ignores both tables.

-- One row per accepted OTP send request, counted over a rolling window. Keys are SHA-256 hashes of the
-- email (never the raw address). Rows are written for unknown addresses too, so limits do not reveal
-- whether an account exists.
CREATE TABLE IF NOT EXISTS otp_send_events (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_send_events_lookup ON otp_send_events (scope, key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_send_events_created ON otp_send_events (created_at);
ALTER TABLE otp_send_events ENABLE ROW LEVEL SECURITY;

-- Every public contact / custom puja submission, including the ones refused as spam, so nothing a
-- real visitor sends is lost when email is held back, and abuse can be investigated.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'web',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  -- accepted: team emailed; held: stored, team email withheld by the volume limit; duplicate; spam
  status TEXT NOT NULL,
  spam_reason TEXT,
  team_emailed_at TIMESTAMPTZ,
  client_ip TEXT,
  user_agent TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('accepted', 'held', 'duplicate', 'spam'))
);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_hash ON contact_submissions (content_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status, created_at DESC);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
