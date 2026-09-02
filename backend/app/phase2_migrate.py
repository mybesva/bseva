"""Schema additions for reqs 41–53 (additive)."""

_PHASE2_STMTS = [
    # Location-based pricing
    """
    CREATE TABLE IF NOT EXISTS location_prices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID REFERENCES services(id) ON DELETE CASCADE,
      city TEXT NOT NULL,
      area TEXT,
      adjustment_paise INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_location_prices_city ON location_prices (lower(city))",
    # Surge rules
    """
    CREATE TABLE IF NOT EXISTS surge_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL DEFAULT 'Surge',
      service_id UUID REFERENCES services(id) ON DELETE CASCADE,
      city TEXT,
      percent_increase DOUBLE PRECISION NOT NULL DEFAULT 0,
      fixed_paise INTEGER NOT NULL DEFAULT 0,
      applies_weekend BOOLEAN,
      valid_from DATE,
      valid_to DATE,
      priority INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Head pujari flag on profile (role stays pujari; head is elevation)
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS is_head_pujari BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS head_scope_cities JSONB NOT NULL DEFAULT '[]'::jsonb",
    # Referral code unique
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL",
    # Head pujari assessments (history, not overwrite)
    """
    CREATE TABLE IF NOT EXISTS head_pujari_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      head_pujari_id UUID NOT NULL REFERENCES users(id),
      pujari_id UUID NOT NULL REFERENCES users(id),
      booking_id UUID REFERENCES bookings(id),
      stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
      comments TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Recurring booking series
    """
    CREATE TABLE IF NOT EXISTS recurring_series (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES users(id),
      pujari_id UUID REFERENCES users(id),
      service_id UUID NOT NULL REFERENCES services(id),
      package_type TEXT NOT NULL DEFAULT 'standard',
      mode TEXT NOT NULL DEFAULT 'in_person',
      recurrence TEXT NOT NULL,
      interval_count INTEGER NOT NULL DEFAULT 1,
      selected_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
      start_date DATE NOT NULL,
      end_date DATE,
      start_time TIME NOT NULL,
      location_label TEXT,
      address TEXT,
      city TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_series_id UUID REFERENCES recurring_series(id)",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS special_instructions TEXT",
    "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS related_payment_id UUID",
    # Role: allow head_pujari as user.role alternative OR use flag — we use flag + optional role
    """
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    """,
    """
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'pujari', 'admin', 'super_admin', 'head_pujari'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
]
