-- Customer-paid platform fee and payment gateway fee, frozen on each booking.
-- platform_fee_paise stays as it was: B-Seva's share of the puja price, not an extra charge.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_platform_fee_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gateway_fee_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gateway_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gateway_name TEXT;

ALTER TABLE gst_rate_config DROP CONSTRAINT IF EXISTS gst_rate_config_line_type_check;
ALTER TABLE gst_rate_config ADD CONSTRAINT gst_rate_config_line_type_check
  CHECK (line_type IN ('puja', 'surge', 'samagri', 'alankaram', 'food', 'platform_fee', 'gateway_fee'));

INSERT INTO gst_rate_config (line_type, hsn_sac, gst_rate, classification, effective_from, note)
SELECT t.line_type, NULL, p.gst_percent, 'taxable', DATE '2017-07-01',
       'Seeded from the existing flat GST rate. Confirm SAC, classification and rate with your CA.'
FROM pricing_config p
CROSS JOIN (VALUES ('platform_fee'), ('gateway_fee')) AS t(line_type)
WHERE p.id = 1
  AND NOT EXISTS (SELECT 1 FROM gst_rate_config g WHERE g.line_type = t.line_type);

INSERT INTO platform_settings (key, value)
VALUES
  ('customer_platform_fee_paise', '900'::jsonb),
  ('payment_gateway_name', '"Razorpay"'::jsonb),
  ('payment_gateway_fee_percent', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;
