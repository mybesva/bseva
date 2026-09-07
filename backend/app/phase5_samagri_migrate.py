"""Phase 5: Post-booking preparation / Samagri localization + richer snapshots."""

_PHASE5_STMTS = [
    "ALTER TABLE samagri_items ADD COLUMN IF NOT EXISTS item_key TEXT",
    "ALTER TABLE samagri_items ADD COLUMN IF NOT EXISTS default_unit TEXT DEFAULT 'pcs'",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_samagri_items_item_key ON samagri_items (item_key) WHERE item_key IS NOT NULL",
    """
    CREATE TABLE IF NOT EXISTS samagri_item_translations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      samagri_item_id UUID NOT NULL REFERENCES samagri_items(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      notes TEXT,
      UNIQUE (samagri_item_id, language_code)
    )
    """,
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2)",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS unit TEXT",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'PUJA_SAMAGRI'",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS provided_by TEXT NOT NULL DEFAULT 'CUSTOMER'",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS notes TEXT",
    """
    CREATE TABLE IF NOT EXISTS service_preparation_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL,
      display_name TEXT,
      short_description TEXT,
      preparation_notes TEXT,
      special_instructions TEXT,
      prasadam_notes TEXT,
      venue_notes TEXT,
      disclaimer TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (service_id, language_code)
    )
    """,
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS samagri_review_status TEXT NOT NULL DEFAULT 'UNVERIFIED'",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS samagri_last_reviewed_at TIMESTAMPTZ",
    # Expand booking snapshot rows
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2)",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS unit TEXT",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS category TEXT",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS provided_by TEXT",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS language_code TEXT",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS item_key TEXT",
    "ALTER TABLE booking_samagri_snapshot ADD COLUMN IF NOT EXISTS section TEXT",
    """
    CREATE TABLE IF NOT EXISTS booking_preparation_snapshot (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL DEFAULT 'en',
      service_name TEXT,
      review_status TEXT,
      samagri_purchased BOOLEAN NOT NULL DEFAULT FALSE,
      alankaram_purchased BOOLEAN NOT NULL DEFAULT FALSE,
      food_purchased BOOLEAN NOT NULL DEFAULT FALSE,
      preparation_notes TEXT,
      special_instructions TEXT,
      prasadam_notes TEXT,
      venue_notes TEXT,
      disclaimer TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
]
