-- Final booking requirements: public service-area copy and retry-safe bookings.
-- Idempotent; safe to re-run.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_request_hash TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_response JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_kind TEXT NOT NULL DEFAULT 'puja';

UPDATE bookings SET booking_kind = 'puja' WHERE booking_kind IS NULL;

CREATE INDEX IF NOT EXISTS bookings_physical_puja_idx
  ON bookings (booking_date, start_time)
  WHERE booking_kind = 'puja' AND mode <> 'virtual';

CREATE INDEX IF NOT EXISTS bookings_virtual_puja_idx
  ON bookings (booking_date, start_time)
  WHERE booking_kind = 'puja' AND mode = 'virtual';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_customer_idempotency_key_uq
  ON bookings (customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO platform_settings (key, value, description)
VALUES
  (
    'service_area_unavailable_heading',
    to_jsonb('BSeva is not available in this area yet'::text),
    'Public heading shown when a booking address is outside the current service area'
  ),
  (
    'service_area_unavailable_description',
    to_jsonb('We could not find an eligible BSeva pujari near this location. Please try another address or check again soon.'::text),
    'Public description shown when a booking address is outside the current service area'
  )
ON CONFLICT (key) DO NOTHING;
