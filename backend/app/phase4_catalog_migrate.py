"""Phase 4: Puja catalog — categories, multi-category, discovery fields, draft pricing."""

_PHASE4_STMTS = [
    # Draft pricing: allow NULL prices for inactive services awaiting Admin pricing
    "ALTER TABLE services ALTER COLUMN standard_price_paise DROP NOT NULL",
    "ALTER TABLE services ALTER COLUMN premium_price_paise DROP NOT NULL",
    # Catalog metadata
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS local_name TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS short_description TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS full_description TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS benefits TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS pujaris_required INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS samagri_available BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS alankaram_available BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS food_available BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS image_path TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS search_aliases JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS is_featured_home BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS is_seasonal BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 1000",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS homepage_rank INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_status TEXT NOT NULL DEFAULT 'priced'",
    # Categories
    """
    CREATE TABLE IF NOT EXISTS service_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS service_category_map (
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      PRIMARY KEY (service_id, category_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_service_category_map_cat ON service_category_map (category_id)",
    # URL slug aliases (canonical service.slug remains; aliases redirect/resolve)
    """
    CREATE TABLE IF NOT EXISTS service_slug_aliases (
      alias_slug TEXT PRIMARY KEY,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_services_featured ON services (is_featured_home, homepage_rank) WHERE is_featured_home = TRUE",
    "CREATE INDEX IF NOT EXISTS idx_services_popular ON services (is_popular) WHERE is_popular = TRUE",
    "CREATE INDEX IF NOT EXISTS idx_services_active_order ON services (active, display_order, name)",
]
