-- B-Seva service expansion: Puja events, Chadhava, Pravachan, Family Sankalp, packages

-- Service classification (backward compatible: existing rows remain puja)
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'puja';
DO $$ BEGIN
  ALTER TABLE services ADD CONSTRAINT services_service_type_check
    CHECK (service_type IN ('puja', 'chadhava', 'pravachan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services (service_type, active);

-- Configurable packages per service (Individual, Couple, Family, etc.)
CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  price_paise INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  max_members INTEGER NOT NULL DEFAULT 1 CHECK (max_members >= 1),
  prasad_included BOOLEAN NOT NULL DEFAULT FALSE,
  inclusions TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_service_packages_service ON service_packages (service_id, active, sort_order);

-- Family Sankalp — reusable saved family members
CREATE TABLE IF NOT EXISTS customer_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gotra TEXT,
  gotra_unknown BOOLEAN NOT NULL DEFAULT FALSE,
  relationship TEXT NOT NULL DEFAULT 'self'
    CHECK (relationship IN ('self', 'spouse', 'parent', 'child', 'other')),
  date_of_birth DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_family_members_customer ON customer_family_members (customer_id);

-- Shared scheduled Seva events
CREATE TABLE IF NOT EXISTS seva_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id),
  assigned_pujari_id UUID REFERENCES users(id),
  temple_id UUID REFERENCES temples(id),
  title TEXT,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  booking_cutoff_at TIMESTAMPTZ,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  registration_count INTEGER NOT NULL DEFAULT 0 CHECK (registration_count >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'live')),
  participation_mode TEXT NOT NULL DEFAULT 'offline'
    CHECK (participation_mode IN ('offline', 'online', 'hybrid')),
  puja_event_kind TEXT
    CHECK (puja_event_kind IS NULL OR puja_event_kind IN ('group_live', 'proxy')),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  price_paise INTEGER CHECK (price_paise IS NULL OR price_paise >= 0),
  online_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_url TEXT,
  google_calendar_event_id TEXT,
  meeting_invite_token TEXT,
  language_code TEXT,
  tithi TEXT,
  festival_slug TEXT,
  series_id UUID,
  session_number INTEGER,
  proof_image_path TEXT,
  proof_video_path TEXT,
  proof_released BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seva_events_service ON seva_events (service_id);
CREATE INDEX IF NOT EXISTS idx_seva_events_start ON seva_events (start_at);
CREATE INDEX IF NOT EXISTS idx_seva_events_status ON seva_events (status, published);
CREATE INDEX IF NOT EXISTS idx_seva_events_pujari ON seva_events (assigned_pujari_id);
CREATE INDEX IF NOT EXISTS idx_seva_events_temple ON seva_events (temple_id);
CREATE INDEX IF NOT EXISTS idx_seva_events_series ON seva_events (series_id, session_number);

-- Lightweight registration layer (separate from puja booking lifecycle)
CREATE TABLE IF NOT EXISTS seva_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE,
  event_id UUID NOT NULL REFERENCES seva_events(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  service_type TEXT NOT NULL DEFAULT 'puja'
    CHECK (service_type IN ('puja', 'chadhava', 'pravachan')),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'refunded')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'free', 'refunded', 'failed')),
  total_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_paise >= 0),
  package_id UUID REFERENCES service_packages(id),
  package_slug TEXT,
  package_name TEXT,
  participation_mode TEXT NOT NULL DEFAULT 'offline'
    CHECK (participation_mode IN ('offline', 'online')),
  primary_name TEXT,
  gotra TEXT,
  gotra_unknown BOOLEAN NOT NULL DEFAULT FALSE,
  sankalp_text TEXT,
  family_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  prasad_address_id UUID REFERENCES customer_addresses(id),
  join_token TEXT,
  proof_image_path TEXT,
  proof_released BOOLEAN NOT NULL DEFAULT FALSE,
  prasad_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (prasad_status IN ('not_applicable', 'preparing', 'ready', 'shipped', 'delivered')),
  prasad_courier TEXT,
  prasad_tracking TEXT,
  idempotency_key TEXT UNIQUE,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_seva_event_registrations_customer ON seva_event_registrations (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seva_event_registrations_event ON seva_event_registrations (event_id, status);
CREATE INDEX IF NOT EXISTS idx_seva_event_registrations_join ON seva_event_registrations (join_token) WHERE join_token IS NOT NULL;

-- Panchang / festival discovery links (admin-configured)
CREATE TABLE IF NOT EXISTS seva_discovery_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type TEXT NOT NULL
    CHECK (link_type IN ('puja', 'chadhava', 'pravachan', 'festival', 'tithi', 'deity_day')),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  event_id UUID REFERENCES seva_events(id) ON DELETE CASCADE,
  festival_slug TEXT,
  tithi TEXT,
  month_number INTEGER CHECK (month_number IS NULL OR (month_number >= 1 AND month_number <= 12)),
  day_number INTEGER CHECK (day_number IS NULL OR (day_number >= 1 AND day_number <= 31)),
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seva_discovery_active ON seva_discovery_links (active, link_type, sort_order);
