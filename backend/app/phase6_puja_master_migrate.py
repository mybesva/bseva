"""Phase 6 — full puja master fields, translations, gallery, samagri scale quantities."""

_PHASE6_STMTS = [
    # --- services master enrichment ---
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS spiritual_meaning TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS common_occasions TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS deity TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS tradition_notes TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS location_notes TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS priests_min INT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS priests_max INT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS process_steps JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS homa_included BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS prasadam_included BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS sankalpa_required BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '[\"en\",\"hi\",\"te\"]'::jsonb",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS online_nri_price_paise INT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS admin_notes TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS whats_included TEXT",
    # --- samagri scale quantities (base = small 1-4) ---
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS qty_small TEXT",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS qty_medium TEXT",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS qty_large TEXT",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS qty_grand TEXT",
    "ALTER TABLE service_samagri ADD COLUMN IF NOT EXISTS scale_override BOOLEAN NOT NULL DEFAULT FALSE",
    # --- translations (no duplicate service rows) ---
    """
    CREATE TABLE IF NOT EXISTS service_translations (
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL CHECK (language_code IN ('en','hi','te')),
      short_description TEXT,
      full_description TEXT,
      spiritual_meaning TEXT,
      common_occasions TEXT,
      benefits TEXT,
      whats_included TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (service_id, language_code)
    )
    """,
    # --- gallery images ---
    """
    CREATE TABLE IF NOT EXISTS service_gallery_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      image_path TEXT,
      image_url TEXT,
      caption TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_service_gallery_svc ON service_gallery_images(service_id, sort_order)",
]
