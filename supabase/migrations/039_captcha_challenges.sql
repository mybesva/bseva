-- Self-hosted image CAPTCHA for public web forms. Additive only (one new table). Safe to run more than once.
-- The release still running ignores it.

-- One row per issued challenge. Neither the challenge id nor the answer is stored: id_hash is SHA-256 of the
-- id the browser holds, answer_hash an HMAC of the id and the answer. A row is used at most once.
CREATE TABLE IF NOT EXISTS captcha_challenges (
  id_hash TEXT PRIMARY KEY,
  answer_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_challenges_expires ON captcha_challenges (expires_at);
ALTER TABLE captcha_challenges ENABLE ROW LEVEL SECURITY;
