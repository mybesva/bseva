ALTER TABLE services ADD COLUMN IF NOT EXISTS basic_pujaris_required INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS standard_pujaris_required INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS premium_pujaris_required INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pujaris_required INTEGER NOT NULL DEFAULT 1;

UPDATE bookings b
SET pujaris_required = COALESCE(
  CASE LOWER(COALESCE(b.package_type, 'standard'))
    WHEN 'basic' THEN s.basic_pujaris_required
    WHEN 'premium' THEN s.premium_pujaris_required
    ELSE s.standard_pujaris_required
  END,
  s.pujaris_required,
  1
)
FROM services s
WHERE s.id = b.service_id
  AND (b.pujaris_required IS NULL OR b.pujaris_required <= 1);
