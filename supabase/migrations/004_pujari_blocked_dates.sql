CREATE TABLE IF NOT EXISTS pujari_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pujari_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_pujari_blocked_dates_pujari_date
  ON pujari_blocked_dates (pujari_id, blocked_date);
