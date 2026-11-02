-- Super Admin CAPTCHA switches for registration and password sign-in. Additive only (one new table, one new
-- nullable column). Safe to run more than once. The release still running ignores both.

-- One row per switchable form, ON by default. Contact Us and Custom Puja always require the CAPTCHA, so the
-- CHECK keeps any row for them out of this table: there is nothing in the database that could turn them off.
-- Who changed a switch, and from what to what, is also written to security_audit_log (append-only).
CREATE TABLE IF NOT EXISTS captcha_settings (
  feature TEXT PRIMARY KEY CHECK (feature IN ('customer_register', 'pujari_register', 'customer_login', 'pujari_login')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO captcha_settings (feature, enabled)
VALUES ('customer_register', TRUE), ('pujari_register', TRUE), ('customer_login', TRUE), ('pujari_login', TRUE)
ON CONFLICT (feature) DO NOTHING;
ALTER TABLE captcha_settings ENABLE ROW LEVEL SECURITY;

-- The account type a registration code was requested for (and its CAPTCHA answered for), so a code issued
-- for one account type cannot register the other. NULL for codes issued before this release or for sign-in.
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS account_type TEXT;
