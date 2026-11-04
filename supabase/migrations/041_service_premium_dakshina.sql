-- Separate pujari dakshina for Premium bookings. NULL means Premium uses the Standard setting.
--   premium_dakshina_amount_paise: fixed amount, used only when dakshina_amount_paise (Standard fixed) is set.
--   premium_dakshina_share_percent: percentage of the Premium puja price, used in percentage mode.
ALTER TABLE services ADD COLUMN IF NOT EXISTS premium_dakshina_amount_paise INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS premium_dakshina_share_percent NUMERIC
  CHECK (premium_dakshina_share_percent IS NULL OR (premium_dakshina_share_percent >= 0 AND premium_dakshina_share_percent <= 100));
