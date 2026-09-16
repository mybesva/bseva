CREATE TABLE IF NOT EXISTS temples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deity TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  timings TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  pujari_name TEXT,
  website TEXT,
  image_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temples_city ON temples (city);
CREATE INDEX IF NOT EXISTS idx_temples_name ON temples (lower(name));
