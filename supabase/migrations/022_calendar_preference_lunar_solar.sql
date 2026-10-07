-- Align users.calendar_preference with app values (lunar | solar).
-- Legacy constraint allowed north/south/lunar and blocked registration with "solar".
-- Drop the old check first, then remap values, then add the new check.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%calendar_preference%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE users
SET calendar_preference = CASE
  WHEN lower(calendar_preference) = 'lunar' THEN 'lunar'
  ELSE 'solar'
END
WHERE calendar_preference IS NULL
   OR lower(calendar_preference) NOT IN ('lunar', 'solar');

UPDATE customer_profiles
SET calendar_preference = CASE
  WHEN lower(calendar_preference) = 'lunar' THEN 'lunar'
  ELSE 'solar'
END
WHERE calendar_preference IS NOT NULL
  AND lower(calendar_preference) NOT IN ('lunar', 'solar');

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_calendar_preference_check
    CHECK (calendar_preference IN ('lunar', 'solar'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ALTER COLUMN calendar_preference SET DEFAULT 'solar';
