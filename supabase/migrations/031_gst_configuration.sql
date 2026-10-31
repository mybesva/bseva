-- GST configuration: rates and HSN/SAC by line type, optionally per puja and package.
-- Rows are never updated: a change is a new row with a later effective_from, so history
-- survives and issued invoices (which hold their own snapshot) are untouched.
CREATE TABLE IF NOT EXISTS gst_rate_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_type TEXT NOT NULL CHECK (line_type IN ('puja', 'surge', 'samagri', 'alankaram', 'food')),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  package_type TEXT,
  hsn_sac TEXT,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (gst_rate >= 0 AND gst_rate <= 100),
  classification TEXT NOT NULL DEFAULT 'taxable' CHECK (classification IN ('taxable', 'exempt', 'nil_rated')),
  effective_from DATE NOT NULL,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gst_rate_lookup ON gst_rate_config (line_type, service_id, effective_from DESC);

-- What was charged on a booking, frozen when it was paid. The invoice is built from this.
CREATE TABLE IF NOT EXISTS booking_tax_snapshots (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Starting point keeps today's charge unchanged until Super Admin confirms the real treatment.
INSERT INTO gst_rate_config (line_type, hsn_sac, gst_rate, classification, effective_from, note)
SELECT t.line_type, t.code, p.gst_percent, 'taxable', DATE '2017-07-01',
       'Seeded from the existing flat GST rate. Confirm classification and rate with your CA.'
FROM pricing_config p
CROSS JOIN (VALUES ('puja', '999591'), ('surge', '999591'), ('samagri', NULL), ('alankaram', NULL), ('food', NULL))
  AS t(line_type, code)
WHERE p.id = 1
  AND NOT EXISTS (SELECT 1 FROM gst_rate_config);
