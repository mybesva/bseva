-- Customer saved addresses (multiple per customer)
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  district TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  location_label TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id ON customer_addresses (user_id);

DROP TRIGGER IF EXISTS customer_addresses_set_updated_at ON customer_addresses;
CREATE TRIGGER customer_addresses_set_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migrate existing single profile addresses into the first saved address (idempotent)
INSERT INTO customer_addresses (
  user_id,
  label,
  address_line1,
  address_line2,
  city,
  district,
  state,
  pincode,
  country,
  location_label,
  latitude,
  longitude,
  address,
  created_at,
  updated_at
)
SELECT
  cp.user_id,
  NULL,
  cp.address_line1,
  cp.address_line2,
  cp.city,
  cp.district,
  cp.state,
  cp.pincode,
  COALESCE(cp.country, 'India'),
  cp.location_label,
  cp.latitude,
  cp.longitude,
  cp.address,
  COALESCE(cp.created_at, NOW()),
  COALESCE(cp.updated_at, NOW())
FROM customer_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM customer_addresses ca WHERE ca.user_id = cp.user_id
)
AND (
  COALESCE(TRIM(cp.address_line1), '') <> ''
  OR COALESCE(TRIM(cp.city), '') <> ''
  OR COALESCE(TRIM(cp.address), '') <> ''
  OR (cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL)
);
