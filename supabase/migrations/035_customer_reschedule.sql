-- Customer puja rescheduling: count per booking, append-only history, Super Admin rules.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS booking_reschedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  old_date DATE NOT NULL,
  old_start_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  previous_pujari_id UUID,
  previous_pujari_name TEXT,
  previous_pujari_rating NUMERIC(3, 1),
  fee_paise INTEGER NOT NULL DEFAULT 0,
  fee_rule TEXT NOT NULL DEFAULT 'free',
  offers_sent INTEGER NOT NULL DEFAULT 0,
  initiated_by UUID,
  initiated_by_name TEXT NOT NULL,
  initiated_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, sequence)
);

CREATE OR REPLACE FUNCTION booking_reschedules_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'booking_reschedules is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_reschedules_no_change ON booking_reschedules;
CREATE TRIGGER booking_reschedules_no_change
  BEFORE UPDATE ON booking_reschedules
  FOR EACH ROW EXECUTE FUNCTION booking_reschedules_immutable();

INSERT INTO platform_settings (key, value)
VALUES
  ('reschedule_enabled', 'true'::jsonb),
  ('reschedule_cutoff_hours', '48'::jsonb),
  ('reschedule_fee_enabled', 'false'::jsonb),
  ('reschedule_first_fee_paise', '0'::jsonb),
  ('reschedule_subsequent_fee_paise', '0'::jsonb),
  ('reschedule_performance_rule_enabled', 'false'::jsonb),
  ('reschedule_performance_min_rating', '4'::jsonb),
  ('reschedule_performance_fee_paise', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;
