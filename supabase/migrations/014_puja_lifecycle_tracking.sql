-- Puja lifecycle: 20h location reveal, start/complete OTP, live tracking stop/arrival.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS complete_otp_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS complete_otp_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tracking_stop_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrival_hit_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

ALTER TABLE pujari_location_pings ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION;

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone',
    'start_puja', 'complete_puja'
  ));

INSERT INTO platform_settings (key, value)
VALUES
  ('pujari_full_booking_details_before_hours', '20'::jsonb),
  ('pujari_gps_update_interval_seconds', '60'::jsonb),
  ('customer_tracking_refresh_seconds', '60'::jsonb),
  ('pujari_arrival_radius_meters', '100'::jsonb),
  ('pujari_arrival_confirm_pings', '2'::jsonb),
  ('puja_complete_otp_before_minutes', '15'::jsonb),
  ('puja_otp_expiry_minutes', '240'::jsonb),
  ('puja_complete_otp_expiry_minutes', '480'::jsonb),
  ('puja_otp_resend_cooldown_seconds', '60'::jsonb),
  ('puja_otp_max_requests_per_hour', '5'::jsonb),
  ('puja_otp_max_verify_attempts', '5'::jsonb),
  ('puja_otp_lock_minutes', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = '20'::jsonb
WHERE key = 'pujari_full_booking_details_before_hours'
  AND (
    value = '24'::jsonb
    OR btrim(COALESCE(value #>> '{}', '')) = '24'
  );
