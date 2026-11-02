-- Account deletion (14-day process), session revocation, and customer/pujari reports.
-- Additive only: new columns with defaults, new tables, a widened OTP purpose check. The running release ignores them.

-- Account state is enforced by the API on every request. deleted = personal data removed, row kept for records.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_state TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_state_check;
ALTER TABLE users ADD CONSTRAINT users_account_state_check
  CHECK (account_state IN ('active', 'deletion_requested', 'deleted'));
-- Tokens issued before this moment are refused (password change or reset, deletion request).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone',
    'start_puja', 'complete_puja', 'sensitive_action', 'delete_account', 'cancel_deletion'
  ));

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  -- Kept only until the final confirmation email is sent, then cleared.
  contact_email TEXT,
  reason TEXT NOT NULL,
  explanation TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested', 'pending_resolution', 'ready', 'deleted', 'cancelled', 'escalated')),
  source TEXT NOT NULL DEFAULT 'app',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  otp_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  obligations JSONB NOT NULL DEFAULT '{}',
  review_completed_at TIMESTAMPTZ,
  review_completed_by UUID REFERENCES users(id),
  assigned_admin_id UUID REFERENCES users(id),
  escalated_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retention_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One open request per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_open
  ON account_deletion_requests (user_id) WHERE state IN ('requested', 'pending_resolution', 'ready', 'escalated');
CREATE INDEX IF NOT EXISTS idx_account_deletion_state ON account_deletion_requests (state, deadline_at);
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Append-only history of every action on a request. Actor names are copied so records stay readable.
CREATE TABLE IF NOT EXISTS account_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES account_deletion_requests(id),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_events_request ON account_deletion_events (request_id, created_at);
ALTER TABLE account_deletion_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION account_deletion_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'account_deletion_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_deletion_events_no_change ON account_deletion_events;
CREATE TRIGGER account_deletion_events_no_change
  BEFORE UPDATE OR DELETE ON account_deletion_events
  FOR EACH ROW EXECUTE FUNCTION account_deletion_events_immutable();

-- Reports (complaints) about a pujari, a customer or a booking.
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reporter_role TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('pujari', 'customer', 'booking')),
  target_user_id UUID REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'escalated', 'resolved', 'dismissed')),
  resolution TEXT,
  handled_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports (reporter_id, created_at DESC);
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS user_report_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES user_reports(id),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_report_events_report ON user_report_events (report_id, created_at);
ALTER TABLE user_report_events ENABLE ROW LEVEL SECURITY;

-- Retention settings for the daily privacy job. Days; admins can change them in Settings.
INSERT INTO platform_settings (key, value)
VALUES
  ('location_history_retention_days', '30'::jsonb),
  ('account_deletion_period_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;
