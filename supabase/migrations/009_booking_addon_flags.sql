-- Additive booking add-on flags used by create_booking.
-- Idempotent; safe if already applied via schema_migrate.ensure_schema().

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS samagri_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS alankaram_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS food_requested BOOLEAN NOT NULL DEFAULT FALSE;
