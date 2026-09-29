-- Virtual Puja timezone, dual pricing, and booking metadata.
ALTER TABLE services ADD COLUMN IF NOT EXISTS virtual_domestic_price_paise INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS virtual_international_price_paise INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'online_nri_price_paise'
  ) THEN
    UPDATE services
    SET virtual_domestic_price_paise = COALESCE(virtual_domestic_price_paise, online_nri_price_paise)
    WHERE virtual_domestic_price_paise IS NULL;

    UPDATE services
    SET virtual_international_price_paise = COALESCE(virtual_international_price_paise, online_nri_price_paise)
    WHERE virtual_international_price_paise IS NULL;
  END IF;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_timezone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_country TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_at_utc TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS virtual_price_tier TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_mode_status ON bookings (mode, status);
