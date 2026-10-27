-- Optional fixed pujari dakshina per booking (paise). When set (> 0) it replaces
-- dakshina_share_percent for that puja; NULL keeps the percentage behaviour.
ALTER TABLE services ADD COLUMN IF NOT EXISTS dakshina_amount_paise INTEGER;
