-- Add Level 5 (Chava Seva) and Level 6 (Pravachana Seva).
-- Does not update, renumber, or delete Level 1–4 rows.

ALTER TABLE pujari_roles ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pujari_roles_code
  ON pujari_roles (code)
  WHERE code IS NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'pujari_profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* 'requested_level'
  LOOP
    EXECUTE format('ALTER TABLE pujari_profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE pujari_profiles
    ADD CONSTRAINT pujari_profiles_requested_level_check
    CHECK (requested_level BETWEEN 1 AND 6);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'pujari_profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* 'approved_level'
  LOOP
    EXECUTE format('ALTER TABLE pujari_profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE pujari_profiles
    ADD CONSTRAINT pujari_profiles_approved_level_check
    CHECK (approved_level IS NULL OR approved_level BETWEEN 1 AND 6);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'services'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* 'required_level'
  LOOP
    EXECUTE format('ALTER TABLE services DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE services
    ADD CONSTRAINT services_required_level_check
    CHECK (required_level BETWEEN 1 AND 6);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO pujari_roles (level, title, summary, examples, code)
SELECT 5,
       'Chava Seva',
       'Specialized Chava Seva. Eligible only for Chava Seva services configured by Admin.',
       '["Chava Seva"]'::jsonb,
       'chava_seva'
WHERE NOT EXISTS (
  SELECT 1 FROM pujari_roles WHERE level = 5 OR code = 'chava_seva'
);

INSERT INTO pujari_roles (level, title, summary, examples, code)
SELECT 6,
       'Pravachana Seva',
       'Specialized Pravachana Seva. Eligible only for Pravachana Seva services configured by Admin.',
       '["Pravachana Seva"]'::jsonb,
       'pravachana_seva'
WHERE NOT EXISTS (
  SELECT 1 FROM pujari_roles WHERE level = 6 OR code = 'pravachana_seva'
);
