-- Six-language catalog translations without duplicating business records.
-- English source remains on services / service_categories / samagri_items.

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.service_translations') IS NOT NULL THEN
    FOR r IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'service_translations'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%language_code%'
    LOOP
      EXECUTE format('ALTER TABLE service_translations DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
    BEGIN
      ALTER TABLE service_translations
        ADD CONSTRAINT service_translations_language_code_check
        CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS customer_instructions TEXT;
ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS pujari_instructions TEXT;

CREATE TABLE IF NOT EXISTS category_translations (
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn')),
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category_id, language_code)
);

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.samagri_item_translations') IS NOT NULL THEN
    FOR r IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'samagri_item_translations'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%language_code%'
    LOOP
      EXECUTE format('ALTER TABLE samagri_item_translations DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
    ALTER TABLE samagri_item_translations
      ADD CONSTRAINT samagri_item_translations_language_code_check
      CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn'));
  END IF;
END $$;
