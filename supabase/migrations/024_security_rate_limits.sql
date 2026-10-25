-- Security PR 2: fixed-window rate-limit counters (login, OTP request, contact form).
-- Keys are SHA-256 hashes of the email / phone / IP, never the raw value.
-- Safe to run more than once. Apply BEFORE deploying the code that uses it.
CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_window ON security_rate_limits (window_start);

-- Same row-level-security stance as the other server-only tables: no client access.
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;
